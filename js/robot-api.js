/* SignatureRobotMapper — on-device robot mapping library (no cloud, no account).
   Any robot controller (or Manon's AI in a Signature robot body) can adopt it:
   feed scans, get the live occupancy grid, save/load maps, experimental localization.
   Honest framing: this is a client-side mapping library + open map format, not a
   cloud service and not a hardware driver. Works in browsers and in Node. */
(function (root, factory) {
  var M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.SignatureRobotMapper = M;
  if (typeof window !== 'undefined') window.SigGrid = M.Grid;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- pure occupancy-grid helpers (shared with the mapper UI) ---------- */
  var Grid = {};

  // Create a log-odds grid. resolution = meters per cell.
  Grid.create = function (width, height, resolution, originX, originY) {
    return {
      width: width, height: height,
      resolution: resolution || 0.05,
      origin: [originX || 0, originY || 0],
      logOdds: new Float32Array(width * height) // 0 = unknown
    };
  };

  Grid.worldToCell = function (g, x, y) {
    var cx = Math.floor((x - g.origin[0]) / g.resolution);
    var cy = Math.floor((y - g.origin[1]) / g.resolution);
    if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return -1;
    return cy * g.width + cx;
  };

  // Bresenham ray: mark free along the ray, occupied at the hit cell.
  Grid.integrateRay = function (g, x0, y0, x1, y1, hit, lFree, lOcc) {
    lFree = (lFree === undefined) ? -0.4 : lFree;
    lOcc = (lOcc === undefined) ? 0.85 : lOcc;
    var x0c = Math.floor((x0 - g.origin[0]) / g.resolution),
        y0c = Math.floor((y0 - g.origin[1]) / g.resolution),
        x1c = Math.floor((x1 - g.origin[0]) / g.resolution),
        y1c = Math.floor((y1 - g.origin[1]) / g.resolution);
    var dx = Math.abs(x1c - x0c), dy = Math.abs(y1c - y0c),
        sx = x0c < x1c ? 1 : -1, sy = y0c < y1c ? 1 : -1,
        err = dx - dy, x = x0c, y = y0c, guard = 0;
    while (guard++ < 10000) {
      var atEnd = (x === x1c && y === y1c);
      if (x >= 0 && y >= 0 && x < g.width && y < g.height) {
        var i = y * g.width + x;
        if (atEnd) { if (hit) g.logOdds[i] = clamp(g.logOdds[i] + lOcc); }
        else g.logOdds[i] = clamp(g.logOdds[i] + lFree);
      }
      if (atEnd) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  };
  function clamp(v) { return v > 4 ? 4 : (v < -4 ? -4 : v); }

  // Convert to ROS-style probability grid: -1 unknown, 0..100.
  Grid.toProb = function (g) {
    var out = new Int16Array(g.width * g.height);
    for (var i = 0; i < out.length; i++) {
      var l = g.logOdds[i];
      if (l === 0) { out[i] = -1; continue; }
      var p = 1 - 1 / (1 + Math.exp(l));
      out[i] = Math.round(p * 100);
    }
    return out;
  };

  // P5 binary PGM bytes as a JS string (char codes 0-255). 0=occupied, 205=unknown, 254=free.
  Grid.toPGM = function (g) {
    var header = 'P5\n# Signature Space Mapping occupancy grid\n' + g.width + ' ' + g.height + '\n255\n';
    var px = new Array(g.width * g.height);
    for (var i = 0; i < px.length; i++) {
      var l = g.logOdds[i];
      px[i] = l === 0 ? 205 : (l > 0 ? 0 : 254);
    }
    var s = header;
    for (var j = 0; j < px.length; j++) s += String.fromCharCode(px[j]);
    return s;
  };

  // ROS map_server YAML.
  Grid.toYAML = function (g, imageName) {
    return 'image: ' + (imageName || 'map.pgm') + '\n' +
      'resolution: ' + g.resolution + '\n' +
      'origin: [' + g.origin[0] + ', ' + g.origin[1] + ', 0.0]\n' +
      'negate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196\n';
  };

  /* ---------- the robot-facing mapper ---------- */
  function SignatureRobotMapper(opts) {
    opts = opts || {};
    this.grid = Grid.create(opts.width || 200, opts.height || 200,
      opts.resolution || 0.05, opts.originX || -5, opts.originY || -5);
    this.path = [];       // [{x,y,theta}]
    this.scans = 0;
    this._store = (opts.store) || ((typeof localStorage !== 'undefined') ? localStorage : null);
  }

  // pose: {x,y,theta} in meters/radians (map frame). ranges: [{angle, dist}] angle
  // relative to robot heading, dist in meters; use dist<0 or >=maxRange for "no hit".
  SignatureRobotMapper.prototype.ingestScan = function (pose, ranges, maxRange) {
    maxRange = maxRange || 8;
    var updated = 0, self = this;
    ranges.forEach(function (r) {
      var d = (r.dist < 0 || r.dist >= maxRange) ? maxRange : r.dist;
      var hit = (r.dist >= 0 && r.dist < maxRange);
      var a = pose.theta + r.angle;
      var x1 = pose.x + Math.cos(a) * d, y1 = pose.y + Math.sin(a) * d;
      var before = updated;
      Grid.integrateRay(self.grid, pose.x, pose.y, x1, y1, hit);
      updated = before + 1;
    });
    this.path.push({ x: pose.x, y: pose.y, theta: pose.theta });
    this.scans++;
    return { rays: ranges.length, scans: this.scans };
  };

  SignatureRobotMapper.prototype.getOccupancyGrid = function () {
    return {
      width: this.grid.width, height: this.grid.height,
      resolution: this.grid.resolution, origin: this.grid.origin.slice(),
      data: Grid.toProb(this.grid) // Int16Array: -1 unknown, 0..100
    };
  };

  SignatureRobotMapper.prototype.coverage = function () {
    var n = 0, total = this.grid.width * this.grid.height;
    for (var i = 0; i < total; i++) if (this.grid.logOdds[i] !== 0) n++;
    return total ? n / total : 0;
  };

  SignatureRobotMapper.prototype.saveMap = function (id) {
    id = id || ('JAH-MAP-R' + Date.now().toString(36).toUpperCase());
    var rec = {
      id: id, kind: 'robot', exported_at: new Date().toISOString(),
      width: this.grid.width, height: this.grid.height,
      resolution: this.grid.resolution, origin: this.grid.origin.slice(),
      logOdds: Array.from(this.grid.logOdds),
      path: this.path, scans: this.scans
    };
    if (!this._store) throw new Error('no storage available');
    this._store.setItem('sigmap-robot-' + id, JSON.stringify(rec));
    return id;
  };

  SignatureRobotMapper.prototype.loadMap = function (id) {
    if (!this._store) throw new Error('no storage available');
    var raw = this._store.getItem('sigmap-robot-' + id);
    if (!raw) throw new Error('map not found: ' + id);
    var rec = JSON.parse(raw);
    this.grid = Grid.create(rec.width, rec.height, rec.resolution, rec.origin[0], rec.origin[1]);
    this.grid.logOdds = Float32Array.from(rec.logOdds);
    this.path = rec.path || []; this.scans = rec.scans || 0;
    return rec;
  };

  // EXPERIMENTAL localization: score candidate poses by how well an observation's
  // hit endpoints agree with the current grid. Returns ranked candidates.
  // observation: {ranges:[{angle,dist}]}. candidates: [{x,y,theta}].
  SignatureRobotMapper.prototype.localize = function (observation, candidates, maxRange) {
    maxRange = maxRange || 8;
    var self = this;
    function score(c) {
      var s = 0, n = 0;
      observation.ranges.forEach(function (r) {
        if (r.dist < 0 || r.dist >= maxRange) return;
        var a = c.theta + r.angle;
        var x = c.x + Math.cos(a) * r.dist, y = c.y + Math.sin(a) * r.dist;
        var i = Grid.worldToCell(self.grid, x, y);
        if (i < 0) return;
        n++;
        var l = self.grid.logOdds[i];
        s += l > 0.5 ? 1 : (l < -0.5 ? -1 : 0);
      });
      return { pose: c, score: n ? s / n : -2, rays: n };
    }
    return candidates.map(score).sort(function (a, b) { return b.score - a.score; });
  };

  return { Mapper: SignatureRobotMapper, Grid: Grid };
});
