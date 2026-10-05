/* Signature Space Mapping — studio core.
   Pure geometry + export functions live on window.SigMap (and module.exports in
   Node) so they can be unit-tested. All DOM wiring runs only in the browser. */
(function (root, factory) {
  var M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.SigMap = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SigMap = {};

  /* ================= geometry ================= */
  SigMap.dist = function (a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 2D similarity transform (uniform scale + rotation + translation) via
  // closed-form least squares (2D Umeyama). srcPts/dstPts: [[x,y],...], >=2 pts.
  // Returns {s, thetaDeg, tx, ty, rmse}.
  SigMap.similarityTransform = function (srcPts, dstPts) {
    var n = Math.min(srcPts.length, dstPts.length);
    if (n < 2) return null;
    var scx = 0, scy = 0, dcx = 0, dcy = 0, i;
    for (i = 0; i < n; i++) {
      scx += srcPts[i][0]; scy += srcPts[i][1];
      dcx += dstPts[i][0]; dcy += dstPts[i][1];
    }
    scx /= n; scy /= n; dcx /= n; dcy /= n;
    var A = 0, B = 0, C = 0;
    for (i = 0; i < n; i++) {
      var ux = srcPts[i][0] - scx, uy = srcPts[i][1] - scy;
      var vx = dstPts[i][0] - dcx, vy = dstPts[i][1] - dcy;
      A += ux * vx + uy * vy;      // dot
      B += ux * vy - uy * vx;      // cross
      C += ux * ux + uy * uy;
    }
    if (C < 1e-9) return null;
    var s = Math.sqrt(A * A + B * B) / C;
    var th = Math.atan2(B, A);
    var tx = dcx - s * (Math.cos(th) * scx - Math.sin(th) * scy);
    var ty = dcy - s * (Math.sin(th) * scx + Math.cos(th) * scy);
    var err = 0;
    for (i = 0; i < n; i++) {
      var p = SigMap.applySim({ s: s, thetaDeg: th * 180 / Math.PI, tx: tx, ty: ty }, srcPts[i]);
      err += SigMap.dist(p, dstPts[i]) * SigMap.dist(p, dstPts[i]);
    }
    return { s: s, thetaDeg: th * 180 / Math.PI, tx: tx, ty: ty, rmse: Math.sqrt(err / n) };
  };

  SigMap.applySim = function (t, pt) {
    var r = t.thetaDeg * Math.PI / 180;
    return [t.s * (Math.cos(r) * pt[0] - Math.sin(r) * pt[1]) + t.tx,
            t.s * (Math.sin(r) * pt[0] + Math.cos(r) * pt[1]) + t.ty];
  };

  /* ================= motion estimation (robot track mode) ================= */
  // Downsample an {data:Uint8ClampedArray (RGBA), w, h} frame to tw×th grayscale.
  SigMap.downsampleGray = function (frame, tw, th) {
    var out = new Uint8Array(tw * th);
    var sw = frame.w / tw, sh = frame.h / th, x, y;
    for (y = 0; y < th; y++) for (x = 0; x < tw; x++) {
      var sx = Math.min(frame.w - 1, Math.floor(x * sw)),
          sy = Math.min(frame.h - 1, Math.floor(y * sh));
      var o = (sy * frame.w + sx) * 4, d = frame.data;
      out[y * tw + x] = Math.round(0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]);
    }
    return out;
  };

  // Block-match curr against prev over ±maxShift; returns dominant {dx,dy}
  // (how much the SCENE moved in curr vs prev) + mean SAD confidence.
  SigMap.estimateMotion = function (prev, curr, w, h, maxShift) {
    maxShift = maxShift || 10;
    var best = { dx: 0, dy: 0, sad: Infinity }, dx, dy, x, y, sad;
    for (dy = -maxShift; dy <= maxShift; dy++) for (dx = -maxShift; dx <= maxShift; dx++) {
      sad = 0;
      for (y = maxShift; y < h - maxShift; y++) for (x = maxShift; x < w - maxShift; x++) {
        var px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) { sad += 255; continue; }
        sad += Math.abs(curr[y * w + x] - prev[py * w + px]);
      }
      if (sad < best.sad) best = { dx: dx, dy: dy, sad: sad };
    }
    var n = (w - 2 * maxShift) * (h - 2 * maxShift);
    best.meanSad = best.sad / Math.max(1, n);
    // best.dx is the offset such that curr(x) ~= prev(x+best.dx): that offset
    // IS the camera's own motion in image pixels (camera right => scene appears
    // left => curr(x)=prev(x+dx) with dx>0). Return it directly.
    return { dx: best.dx, dy: best.dy, meanSad: best.meanSad };
  };

  /* ================= stitching (photo flow) ================= */
  // photos: [{refPoints:[{x,y,label}], trace:[[x,y]..]}]. Photo 0 defines the
  // global frame; later photos align via >=2 shared labels (least squares).
  // Returns {walls:[{pts}], placed:[bool], notes:[str]}.
  SigMap.stitchPhotos = function (photos) {
    var placed = [], notes = [], walls = [];
    var globalPts = {}; // label -> [x,y] in global frame
    photos.forEach(function (ph, idx) {
      if (idx === 0 || !ph.refPoints || ph.refPoints.length === 0) {
        if (idx === 0) {
          (ph.refPoints || []).forEach(function (p) { globalPts[p.label] = [p.x, p.y]; });
          (ph.trace || []).forEach(function (seg) { walls.push({ pts: seg.slice() }); });
          placed.push(true); notes.push('photo 1 anchors the map');
        } else { placed.push(false); notes.push('photo ' + (idx + 1) + ': no reference points — skipped'); }
        return;
      }
      var src = [], dst = [];
      ph.refPoints.forEach(function (p) {
        if (globalPts[p.label]) { src.push([p.x, p.y]); dst.push(globalPts[p.label]); }
      });
      if (src.length < 2) {
        placed.push(false);
        notes.push('photo ' + (idx + 1) + ': only ' + src.length + ' shared point(s) — need 2+');
        return;
      }
      var t = SigMap.similarityTransform(src, dst);
      if (!t) { placed.push(false); notes.push('photo ' + (idx + 1) + ': alignment failed'); return; }
      ph.refPoints.forEach(function (p) {
        if (!globalPts[p.label]) globalPts[p.label] = SigMap.applySim(t, [p.x, p.y]);
      });
      (ph.trace || []).forEach(function (seg) {
        walls.push({ pts: seg.map(function (pt) { return SigMap.applySim(t, pt); }) });
      });
      placed.push(true);
      notes.push('photo ' + (idx + 1) + ': stitched (' + src.length + ' shared points, rmse ' + t.rmse.toFixed(1) + 'px)');
    });
    return { walls: walls, placed: placed, notes: notes };
  };

  /* ================= exports ================= */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // map: {units, pxPerUnit, walls, doors, windows, obstacles, labels, name}
  SigMap.mapBounds = function (map) {
    var xs = [], ys = [];
    function push(x, y) { xs.push(x); ys.push(y); }
    map.walls.forEach(function (w) { w.pts.forEach(function (p) { push(p[0], p[1]); }); });
    map.doors.forEach(function (d) { push(d.x, d.y); });
    map.windows.forEach(function (w) { push(w.x1, w.y1); push(w.x2, w.y2); });
    map.obstacles.forEach(function (o) { push(o.x, o.y); push(o.x + o.w, o.y + o.h); });
    if (!xs.length) return { x0: 0, y0: 0, x1: 100, y1: 100 };
    return { x0: Math.min.apply(0, xs) - 20, y0: Math.min.apply(0, ys) - 20,
             x1: Math.max.apply(0, xs) + 20, y1: Math.max.apply(0, ys) + 20 };
  };

  SigMap.buildSVG = function (map) {
    var b = SigMap.mapBounds(map), u = map.units || 'ft';
    var W = Math.ceil(b.x1 - b.x0), H = Math.ceil(b.y1 - b.y0);
    var wallPx = Math.max(4, (map.pxPerUnit || 40) * 0.4);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Top-down map: ' + esc(map.name || 'room') + '">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0a1628"/>';
    function X(x) { return (x - b.x0).toFixed(1); }
    function Y(y) { return (y - b.y0).toFixed(1); }
    map.obstacles.forEach(function (o) {
      s += '<rect x="' + X(o.x) + '" y="' + Y(o.y) + '" width="' + o.w.toFixed(1) + '" height="' + o.h.toFixed(1) +
           '" fill="#12324a" stroke="#35c8e6" stroke-width="1.5"/>';
      if (o.label) s += '<text x="' + X(o.x + o.w / 2) + '" y="' + Y(o.y + o.h / 2) + '" text-anchor="middle" fill="#9be8fa" font-size="11" font-family="sans-serif">' + esc(o.label) + '</text>';
    });
    map.walls.forEach(function (w) {
      var d = w.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]) + ',' + Y(p[1]); }).join(' ');
      s += '<path d="' + d + '" fill="none" stroke="#35c8e6" stroke-width="' + wallPx.toFixed(1) + '" stroke-linecap="round"/>';
    });
    map.windows.forEach(function (w) {
      s += '<line x1="' + X(w.x1) + '" y1="' + Y(w.y1) + '" x2="' + X(w.x2) + '" y2="' + Y(w.y2) + '" stroke="#9be8fa" stroke-width="3"/>';
    });
    map.doors.forEach(function (d) {
      var wr = (d.wUnits || 3) * (map.pxPerUnit || 40), a = (d.angleDeg || 0) * Math.PI / 180;
      var x2 = d.x + Math.cos(a) * wr, y2 = d.y + Math.sin(a) * wr;
      s += '<path d="M' + X(d.x) + ',' + Y(d.y) + ' A' + wr.toFixed(1) + ',' + wr.toFixed(1) + ' 0 0 1 ' + X(x2) + ',' + Y(y2) +
           '" fill="none" stroke="#e6a335" stroke-width="2" stroke-dasharray="5,3"/>';
      s += '<circle cx="' + X(d.x) + '" cy="' + Y(d.y) + '" r="3" fill="#e6a335"/>';
    });
    map.labels.forEach(function (l) {
      s += '<text x="' + X(l.x) + '" y="' + Y(l.y) + '" fill="#eef6ff" font-size="13" font-family="sans-serif">' + esc(l.text) + '</text>';
    });
    // scale bar: 5 units
    var sb = 5 * (map.pxPerUnit || 40);
    s += '<g><line x1="20" y1="' + (H - 24) + '" x2="' + (20 + sb) + '" y2="' + (H - 24) + '" stroke="#eef6ff" stroke-width="3"/>' +
         '<text x="20" y="' + (H - 30) + '" fill="#eef6ff" font-size="11" font-family="sans-serif">5 ' + u + '</text></g>';
    s += '<text x="' + (W - 8) + '" y="' + (H - 8) + '" text-anchor="end" fill="#5f7d99" font-size="10" font-family="sans-serif">Signature Space Mapping</text>';
    return s + '</svg>';
  };

  // Rasterize walls+obstacles into a rows×cols grid over bounds. Returns {px:Uint8Array, resM, oxM, oyM}.
  // Values: 0 occupied, 205 unknown, 254 free.
  SigMap.rasterize = function (map, cols, rows) {
    var b = SigMap.mapBounds(map);
    var unitM = (map.units === 'm') ? 1 : 0.3048;
    var wM = (b.x1 - b.x0) / (map.pxPerUnit || 40) * unitM;
    var hM = (b.y1 - b.y0) / (map.pxPerUnit || 40) * unitM;
    var resM = Math.max(wM / cols, hM / rows, 0.01);
    var px = new Uint8Array(cols * rows).fill(205);
    function cell(x, y) {
      var cx = Math.floor((x - b.x0) / (b.x1 - b.x0) * cols),
          cy = Math.floor((y - b.y0) / (b.y1 - b.y0) * rows);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return cy * cols + cx;
    }
    function thick(x0, y0, x1, y1, r) {
      var n = Math.ceil(SigMap.dist([x0, y0], [x1, y1]) / 2) || 1, i, j, k;
      for (i = 0; i <= n; i++) {
        var x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        for (j = -r; j <= r; j++) for (k = -r; k <= r; k++) {
          var c = cell(x + j * 2, y + k * 2);
          if (c >= 0) px[c] = 0;
        }
      }
    }
    var wallR = Math.max(1, Math.round(((map.pxPerUnit || 40) * 0.2) / ((b.x1 - b.x0) / cols)));
    map.walls.forEach(function (w) {
      for (var i = 0; i + 1 < w.pts.length; i++)
        thick(w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1], wallR);
    });
    map.obstacles.forEach(function (o) {
      var x, y;
      for (x = o.x; x <= o.x + o.w; x += 4) for (y = o.y; y <= o.y + o.h; y += 4) {
        var c = cell(x, y); if (c >= 0) px[c] = 0;
      }
    });
    // interior guess: flood from center is overkill; mark cells inside wall bbox ring as free
    return { px: px, cols: cols, rows: rows, resM: resM,
             oxM: b.x0 / (map.pxPerUnit || 40) * unitM, oyM: b.y0 / (map.pxPerUnit || 40) * unitM };
  };

  SigMap.buildPGM = function (map, cols, rows) {
    cols = cols || 200; rows = rows || 200;
    var r = SigMap.rasterize(map, cols, rows);
    var header = 'P5\n# Signature Space Mapping occupancy grid\n' + cols + ' ' + rows + '\n255\n';
    var s = header;
    for (var i = 0; i < r.px.length; i++) s += String.fromCharCode(r.px[i]);
    return { pgm: s, meta: r };
  };

  SigMap.buildYAML = function (map, imageName, cols, rows) {
    var r = SigMap.buildPGM(map, cols, rows).meta;
    return 'image: ' + (imageName || 'map.pgm') + '\n' +
      'resolution: ' + r.resM.toFixed(4) + '\n' +
      'origin: [' + r.oxM.toFixed(3) + ', ' + r.oyM.toFixed(3) + ', 0.0]\n' +
      'negate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196\n';
  };

  SigMap.buildCoveragePGM = function (track, cols, rows) {
    cols = cols || 160; rows = rows || 160;
    var header = 'P5\n# Signature Space Mapping coverage grid (0=unseen,255=seen)\n' + cols + ' ' + rows + '\n255\n';
    var s = header, i;
    if (track && track.cov) {
      var gw = track.gw, gh = track.gh;
      for (i = 0; i < cols * rows; i++) {
        var sx = Math.floor(i % cols / cols * gw), sy = Math.floor(Math.floor(i / cols) / rows * gh);
        s += String.fromCharCode(track.cov[sy * gw + sx] ? 255 : 0);
      }
    } else {
      for (i = 0; i < cols * rows; i++) s += String.fromCharCode(0);
    }
    return s;
  };

  SigMap.buildRobotJSON = function (map, track) {
    var unitM = (map.units === 'm') ? 1 : 0.3048;
    function U(px) { return +(px / (map.pxPerUnit || 40) * unitM).toFixed(3); }
    var rec = {
      format: 'signature-robot-map/1.0',
      id: map.id || null, name: map.name || 'room',
      units: map.units || 'ft', exported_at: new Date().toISOString(),
      scale: { pxPerUnit: map.pxPerUnit || 40, set: !!map.scaleSet },
      walls_m: map.walls.map(function (w) { return w.pts.map(function (p) { return [U(p[0]), U(p[1])]; }); }),
      doors: (map.doors || []).map(function (d) { return { x_m: U(d.x), y_m: U(d.y), width_m: +((d.wUnits || 3) * unitM).toFixed(3), angle_deg: d.angleDeg || 0 }; }),
      obstacles_m: (map.obstacles || []).map(function (o) { return { x_m: U(o.x), y_m: U(o.y), w_m: U(o.w), h_m: U(o.h), label: o.label || '' }; }),
      labels: map.labels || []
    };
    if (track && track.path && track.path.length) {
      rec.track = { steps: track.path.length, coverage_pct: +(track.coveragePct || 0).toFixed(1),
                    path_m: track.path.map(function (p) { return [U(p[0]), U(p[1])]; }) };
    }
    return JSON.stringify(rec, null, 1);
  };

  return SigMap;
});

/* ==================== BROWSER APP (runs only with DOM) ==================== */
(function () {
if (typeof document === 'undefined') return;

var SigMapNS = (typeof SigMap !== 'undefined') ? SigMap : null;
if (!SigMapNS) { document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('exportHint').textContent = 'Mapper engine failed to load. Reload the page.'; }); return; }

var S = {
  units: 'ft', pxPerUnit: 40, scaleSet: false, name: 'My room', id: null,
  walls: [], doors: [], windows: [], obstacles: [], labels: [], measures: [],
  captures: [], photos: [], track: null,
  tool: 'select', snap: true,
  view: { ox: 40, oy: 40, z: 1 }
};
var hist = [];
function snapState() {
  hist.push(JSON.stringify({ walls: S.walls, doors: S.doors, windows: S.windows,
    obstacles: S.obstacles, labels: S.labels, measures: S.measures }));
  if (hist.length > 50) hist.shift();
}
function undo() {
  var h = hist.pop(); if (!h) return;
  var o = JSON.parse(h);
  S.walls = o.walls; S.doors = o.doors; S.windows = o.windows;
  S.obstacles = o.obstacles; S.labels = o.labels; S.measures = o.measures;
  draw();
}
function $(id) { return document.getElementById(id); }
function escH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- canvas ---------- */
var cv = $('mapCanvas'), ctx = cv.getContext('2d');
var W2S = function (p) { return [p[0] * S.view.z + S.view.ox, p[1] * S.view.z + S.view.oy]; };
var S2W = function (x, y) { return [(x - S.view.ox) / S.view.z, (y - S.view.oy) / S.view.z]; };
function snapPt(p) {
  if (!S.snap) return p;
  var g = 10, best = null, bd = 14 / S.view.z;
  S.walls.forEach(function (w) { w.pts.forEach(function (q) {
    var d = SigMapNS.dist(p, q); if (d < bd) { bd = d; best = q.slice(); } }); });
  if (best) return best;
  return [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g];
}

function draw() {
  var w = cv.width, h = cv.height;
  ctx.fillStyle = '#050b14'; ctx.fillRect(0, 0, w, h);
  // grid
  ctx.strokeStyle = '#0d2038'; ctx.lineWidth = 1;
  var gs = 40 * S.view.z, ox = S.view.ox % gs, oy = S.view.oy % gs, x, y;
  ctx.beginPath();
  for (x = ox; x < w; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (y = oy; y < h; y += gs) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  // track coverage
  var tr = S.track;
  if (tr && tr.cov) {
    ctx.fillStyle = 'rgba(53,200,120,0.20)';
    for (var cy = 0; cy < tr.gh; cy++) for (var cx = 0; cx < tr.gw; cx++) {
      if (tr.cov[cy * tr.gw + cx]) {
        var p = W2S([tr.ox + cx * tr.cellPx, tr.oy + cy * tr.cellPx]);
        ctx.fillRect(p[0], p[1], tr.cellPx * S.view.z, tr.cellPx * S.view.z);
      }
    }
    if (tr.path.length > 1) {
      ctx.strokeStyle = '#35c878'; ctx.lineWidth = 3; ctx.beginPath();
      tr.path.forEach(function (p, i) { var q = W2S(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.stroke();
    }
  }
  // obstacles
  S.obstacles.forEach(function (o) {
    var a = W2S([o.x, o.y]);
    ctx.fillStyle = '#12324a'; ctx.strokeStyle = '#35c8e6'; ctx.lineWidth = 1.5;
    ctx.fillRect(a[0], a[1], o.w * S.view.z, o.h * S.view.z);
    ctx.strokeRect(a[0], a[1], o.w * S.view.z, o.h * S.view.z);
  });
  // walls
  ctx.strokeStyle = '#35c8e6'; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, S.pxPerUnit * 0.4 * S.view.z);
  S.walls.forEach(function (wl) {
    ctx.beginPath();
    wl.pts.forEach(function (p, i) { var q = W2S(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
  });
  // windows
  ctx.strokeStyle = '#9be8fa'; ctx.lineWidth = 3;
  S.windows.forEach(function (wn) {
    var a = W2S([wn.x1, wn.y1]), b = W2S([wn.x2, wn.y2]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  });
  // doors
  S.doors.forEach(function (d) {
    var c = W2S([d.x, d.y]), wr = (d.wUnits || 3) * S.pxPerUnit * S.view.z, a = (d.angleDeg || 0) * Math.PI / 180;
    ctx.strokeStyle = '#e6a335'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.arc(c[0], c[1], wr, a, a + Math.PI / 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#e6a335'; ctx.beginPath(); ctx.arc(c[0], c[1], 4, 0, 7); ctx.fill();
  });
  // measures
  ctx.strokeStyle = '#ffd97f'; ctx.fillStyle = '#ffd97f'; ctx.lineWidth = 1.5;
  S.measures.forEach(function (m) {
    var a = W2S([m.x1, m.y1]), b = W2S([m.x2, m.y2]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    var un = S.units === 'm' ? 1 : 1 / 0.3048;
    var distU = (SigMapNS.dist([m.x1, m.y1], [m.x2, m.y2]) / S.pxPerUnit).toFixed(1);
    ctx.font = '12px sans-serif';
    ctx.fillText(distU + ' ' + S.units, (a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 - 6);
  });
  // labels
  ctx.fillStyle = '#eef6ff'; ctx.font = '13px sans-serif';
  S.labels.forEach(function (l) { var p = W2S([l.x, l.y]); ctx.fillText(l.text, p[0] + 6, p[1] - 6); });
  // in-progress
  if (curPts.length) {
    ctx.strokeStyle = '#9be8fa'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
    curPts.forEach(function (p, i) { var q = W2S(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    if (hoverPt) { var hq = W2S(hoverPt); ctx.lineTo(hq[0], hq[1]); }
    ctx.stroke(); ctx.setLineDash([]);
  }
}

var curPts = [], hoverPt = null, dragStart = null, panning = false, labelInput = null;

function canvasPos(e) {
  var r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top].map(function (v, i) {
    return v * (i ? cv.height / r.height : cv.width / r.width);
  });
}

cv.addEventListener('pointerdown', function (e) {
  cv.setPointerCapture(e.pointerId);
  var cp = canvasPos(e), wp = S2W(cp[0], cp[1]);
  if (S.tool === 'select') { panning = true; dragStart = cp; return; }
  if (S.tool === 'wall') { curPts.push(snapPt(wp)); draw(); return; }
  if (S.tool === 'measure') {
    curPts.push(snapPt(wp));
    if (curPts.length === 2) {
      snapState();
      S.measures.push({ x1: curPts[0][0], y1: curPts[0][1], x2: curPts[1][0], y2: curPts[1][1] });
      curPts = []; draw();
    }
    return;
  }
  if (S.tool === 'door') { snapState(); placeDoor(snapPt(wp)); draw(); return; }
  if (S.tool === 'window') { curPts.push(snapPt(wp)); if (curPts.length === 2) { snapState(); placeWindow(curPts[0], curPts[1]); curPts = []; draw(); } return; }
  if (S.tool === 'obstacle') { curPts.push(snapPt(wp)); return; }
  if (S.tool === 'label') { showLabelInput(cp, wp); return; }
  if (S.tool === 'erase') { snapState(); eraseAt(wp); draw(); return; }
});
cv.addEventListener('pointermove', function (e) {
  var cp = canvasPos(e), wp = S2W(cp[0], cp[1]);
  if (panning && dragStart) {
    S.view.ox += cp[0] - dragStart[0]; S.view.oy += cp[1] - dragStart[1];
    dragStart = cp; draw(); return;
  }
  hoverPt = (S.tool === 'wall' || S.tool === 'window' || S.tool === 'measure' || S.tool === 'obstacle') ? snapPt(wp) : null;
  if ((S.tool === 'obstacle') && curPts.length === 1 && e.buttons) draw();
  else if (curPts.length || S.tool === 'wall') draw();
});
cv.addEventListener('pointerup', function (e) {
  panning = false;
  if (S.tool === 'obstacle' && curPts.length === 1) {
    var cp = canvasPos(e), wp = snapPt(S2W(cp[0], cp[1])), a = curPts[0];
    snapState();
    S.obstacles.push({ x: Math.min(a[0], wp[0]), y: Math.min(a[1], wp[1]),
      w: Math.abs(wp[0] - a[0]) || 10, h: Math.abs(wp[1] - a[1]) || 10, label: '' });
    curPts = []; draw();
  }
});
cv.addEventListener('dblclick', function () {
  if (S.tool === 'wall' && curPts.length > 1) {
    snapState(); S.walls.push({ pts: curPts.slice() }); curPts = []; draw();
  }
});
cv.addEventListener('wheel', function (e) {
  e.preventDefault();
  var cp = canvasPos(e), wp = S2W(cp[0], cp[1]);
  var nz = Math.min(4, Math.max(0.25, S.view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  S.view.ox = cp[0] - wp[0] * nz; S.view.oy = cp[1] - wp[1] * nz; S.view.z = nz;
  draw();
}, { passive: false });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { curPts = []; hideLabelInput(); draw(); }
  if (e.key === 'Enter' && S.tool === 'wall' && curPts.length > 1) {
    snapState(); S.walls.push({ pts: curPts.slice() }); curPts = []; draw();
  }
});

function nearestWallSeg(p) {
  var best = null, bd = 1e9;
  S.walls.forEach(function (w) {
    for (var i = 0; i + 1 < w.pts.length; i++) {
      var a = w.pts[i], b = w.pts[i + 1];
      var abx = b[0] - a[0], aby = b[1] - a[1];
      var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1)));
      var q = [a[0] + abx * t, a[1] + aby * t], d = SigMapNS.dist(p, q);
      if (d < bd) { bd = d; best = { q: q, ang: Math.atan2(aby, abx) * 180 / Math.PI }; }
    }
  });
  return { seg: best, dist: bd };
}
function placeDoor(p) {
  var n = nearestWallSeg(p), ang = 0;
  if (n.seg && n.dist < 60 / S.view.z) { p = n.seg.q; ang = n.seg.ang; }
  S.doors.push({ x: p[0], y: p[1], angleDeg: ang, wUnits: 3 });
}
function placeWindow(a, b) {
  var n = nearestWallSeg([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  if (n.seg && n.dist < 80 / S.view.z) {
    var d = SigMapNS.dist(a, b) / 2, ux = Math.cos(n.seg.ang * Math.PI / 180), uy = Math.sin(n.seg.ang * Math.PI / 180);
    a = [n.seg.q[0] - ux * d, n.seg.q[1] - uy * d]; b = [n.seg.q[0] + ux * d, n.seg.q[1] + uy * d];
  }
  S.windows.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
}
function eraseAt(p) {
  var bd = 14 / S.view.z, bi = -1, bk = '';
  function near(pts) { for (var i = 0; i < pts.length; i++) if (SigMapNS.dist(p, pts[i]) < bd) return true; return false; }
  S.walls.forEach(function (w, i) { if (near(w.pts)) { bi = i; bk = 'walls'; } });
  S.doors.forEach(function (d, i) { if (SigMapNS.dist(p, [d.x, d.y]) < bd) { bi = i; bk = 'doors'; } });
  S.obstacles.forEach(function (o, i) {
    if (p[0] > o.x - 6 && p[0] < o.x + o.w + 6 && p[1] > o.y - 6 && p[1] < o.y + o.h + 6) { bi = i; bk = 'obstacles'; } });
  if (bk) S[bk].splice(bi, 1);
}
function showLabelInput(cp, wp) {
  hideLabelInput();
  var wrap = $('mapCanvasWrap');
  labelInput = document.createElement('input');
  labelInput.type = 'text'; labelInput.maxLength = 40; labelInput.placeholder = 'Label…';
  labelInput.setAttribute('aria-label', 'Label text');
  labelInput.style.cssText = 'position:absolute;left:' + cp[0] + 'px;top:' + cp[1] + 'px;z-index:5;width:160px';
  wrap.appendChild(labelInput); labelInput.focus();
  labelInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && labelInput.value.trim()) {
      snapState(); S.labels.push({ x: wp[0], y: wp[1], text: labelInput.value.trim() });
      hideLabelInput(); draw();
    }
    if (e.key === 'Escape') hideLabelInput();
    e.stopPropagation();
  });
}
function hideLabelInput() { if (labelInput) { labelInput.remove(); labelInput = null; } }

var HINTS = {
  select: 'Select: drag to pan, wheel to zoom.',
  wall: 'Wall: click points, double-click or Enter to finish, Esc to cancel.',
  door: 'Door: click on (or near) a wall — it snaps to the wall.',
  window: 'Window: click-drag along a wall.',
  obstacle: 'Obstacle: drag a rectangle (e.g. sofa, table).',
  label: 'Label: click, then type the room/item name.',
  measure: 'Measure: click two points. Use "Set from last measure" for scale.',
  erase: 'Erase: click a wall, door, or obstacle to remove it.'
};
document.querySelectorAll('[data-tool]').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('[data-tool]').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on'); S.tool = b.dataset.tool; curPts = [];
    $('toolHint').textContent = HINTS[S.tool] || '';
    draw();
  });
});
$('snapBtn').addEventListener('click', function () {
  S.snap = !S.snap;
  this.textContent = '🧲 Snap: ' + (S.snap ? 'on' : 'off');
  this.setAttribute('aria-pressed', S.snap);
  this.classList.toggle('on', S.snap);
});
$('undoBtn').addEventListener('click', undo);
$('clearBtn').addEventListener('click', function () {
  snapState();
  S.walls = []; S.doors = []; S.windows = []; S.obstacles = []; S.labels = []; S.measures = [];
  draw();
});
$('scaleBtn').addEventListener('click', function () {
  var m = S.measures[S.measures.length - 1];
  if (!m) { $('scaleState').textContent = 'Measure something first (📏 tool), then set scale.'; return; }
  var px = SigMapNS.dist([m.x1, m.y1], [m.x2, m.y2]);
  var len = parseFloat($('scaleLen').value);
  if (!(len > 0) || !(px > 0)) { $('scaleState').textContent = 'Enter a valid known length.'; return; }
  S.units = $('scaleUnit').value; S.pxPerUnit = px / len; S.scaleSet = true;
  $('scaleState').innerHTML = 'Scale set: <b>1 ' + escH(S.units) + ' = ' + S.pxPerUnit.toFixed(1) + ' px</b>';
  draw();
});
$('mapName').addEventListener('input', function () { S.name = this.value; });

/* ---------- capture tabs ---------- */
document.querySelectorAll('[data-cap]').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('[data-cap]').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    ['photos', 'video', 'stream', 'track'].forEach(function (k) {
      $('cap-' + k).style.display = (k === b.dataset.cap) ? '' : 'none';
    });
    var steps = document.querySelectorAll('#flowbar .step');
    steps[0].classList.add('on');
  });
});

function addCapture(kind, dataURL, name) {
  var c = { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 999), kind: kind, dataURL: dataURL, name: name };
  S.captures.push(c); renderCaptures(); return c;
}
function renderCaptures() {
  var el = $('capStrip');
  if (!S.captures.length) { el.innerHTML = '<p class="hint">Nothing captured yet.</p>'; return; }
  el.innerHTML = '';
  S.captures.forEach(function (c) {
    var f = document.createElement('figure');
    f.innerHTML = '<img alt="' + escH(c.name) + '"><figcaption>' + escH(c.name) + '</figcaption>';
    f.querySelector('img').src = c.dataURL;
    el.appendChild(f);
  });
}

/* ---------- photos: first-class flow ---------- */
var photoSeq = 0;
$('photoInput').addEventListener('change', function () {
  Array.prototype.forEach.call(this.files, function (file) {
    if (!file.type.match(/^image\//)) return;
    var rd = new FileReader();
    rd.onload = function () { addPhoto(file.name, rd.result); };
    rd.readAsDataURL(file);
  });
  this.value = '';
});
function addPhoto(name, dataURL) {
  var ph = { id: 'p' + (++photoSeq), name: name, dataURL: dataURL, refPoints: [], trace: [] };
  S.photos.push(ph); renderPhotos(); addCapture('photo', dataURL, name);
  return ph;
}
function allLabels() {
  var s = {};
  S.photos.forEach(function (p) { p.refPoints.forEach(function (r) { s[r.label] = 1; }); });
  return Object.keys(s);
}
function renderPhotos() {
  var el = $('photoList'); el.innerHTML = '';
  if (!S.photos.length) { el.innerHTML = '<p class="hint">No photos yet — add 2 or 3 for a full room.</p>'; updateStitch(); return; }
  S.photos.forEach(function (ph, idx) {
    var card = document.createElement('div');
    card.className = 'photocard'; card.dataset.pid = ph.id;
    var shared = {};
    ph.refPoints.forEach(function (r) {
      var n = 0;
      S.photos.forEach(function (q) { if (q !== ph && q.refPoints.some(function (x) { return x.label === r.label; })) n++; });
      if (n) shared[r.label] = 1;
    });
    card.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<b>' + (idx + 1) + '. ' + escH(ph.name) + '</b>' +
      '<button class="tbtn" data-act="up" ' + (idx === 0 ? 'disabled' : '') + '>↑</button>' +
      '<button class="tbtn" data-act="down" ' + (idx === S.photos.length - 1 ? 'disabled' : '') + '>↓</button>' +
      '<button class="tbtn" data-act="mark">📍 Mark points</button>' +
      '<button class="tbtn" data-act="trace">✏ Trace walls</button>' +
      '<button class="tbtn danger" data-act="del">✕</button></div>' +
      '<div class="phimgwrap" style="position:relative;margin-top:8px">' +
      '<img src="' + ph.dataURL + '" alt="' + escH(ph.name) + '" style="width:100%;border-radius:8px;display:block">' +
      '<svg class="phtrace" viewBox="0 0 1000 1000" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"></svg>' +
      '<div class="phdots" style="position:absolute;inset:0"></div></div>' +
      '<div class="phpts" style="margin-top:6px"></div>';
    el.appendChild(card);
    var img = card.querySelector('img'), dots = card.querySelector('.phdots'), svg = card.querySelector('.phtrace');
    function drawPhotoMarks() {
      dots.innerHTML = '';
      ph.refPoints.forEach(function (r) {
        var d = document.createElement('span');
        d.className = 'ptag' + (shared[r.label] ? ' shared' : '');
        d.textContent = '📍' + r.label;
        d.title = Math.round(r.x) + ',' + Math.round(r.y) + 'px';
        d.style.cssText = 'position:absolute;left:' + (r.x / img.naturalWidth * 100) + '%;top:' + (r.y / img.naturalHeight * 100) + '%;transform:translate(-50%,-120%)';
        dots.appendChild(d);
      });
      var vb = img.naturalWidth + ' ' + img.naturalHeight;
      svg.setAttribute('viewBox', '0 0 ' + vb);
      svg.innerHTML = ph.trace.map(function (seg) {
        return '<polyline points="' + seg.map(function (p) { return p[0].toFixed(0) + ',' + p[1].toFixed(0); }).join(' ') +
               '" fill="none" stroke="#35c8e6" stroke-width="' + Math.max(6, img.naturalWidth / 200) + '"/>';
      }).join('');
    }
    if (img.complete && img.naturalWidth) drawPhotoMarks();
    else img.onload = drawPhotoMarks;
    var mode = null, curSeg = [];
    function imgPt(e) {
      var r = img.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * img.naturalWidth,
              (e.clientY - r.top) / r.height * img.naturalHeight];
    }
    card.querySelector('.phimgwrap').addEventListener('click', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      var p = imgPt(e);
      if (mode === 'mark') {
        var labels = allLabels();
        var sug = labels.filter(function (l) { return !ph.refPoints.some(function (r) { return r.label === l; }); })[0] ||
                  String.fromCharCode(65 + ph.refPoints.length);
        ph.refPoints.push({ x: Math.round(p[0]), y: Math.round(p[1]), label: sug });
        renderPhotos(); updateStitch();
      } else if (mode === 'trace') {
        curSeg.push([Math.round(p[0]), Math.round(p[1])]);
        if (curSeg.length > 1) { /* live preview on next render */ }
        drawPhotoMarks();
        var vb2 = img.naturalWidth + ' ' + img.naturalHeight;
        svg.setAttribute('viewBox', '0 0 ' + vb2);
        svg.innerHTML = ph.trace.map(function (seg) {
          return '<polyline points="' + seg.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '" fill="none" stroke="#35c8e6" stroke-width="8"/>';
        }).join('') + (curSeg.length ? '<polyline points="' + curSeg.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '" fill="none" stroke="#9be8fa" stroke-width="8" stroke-dasharray="12,8"/>' : '');
      }
    });
    card.querySelector('.phimgwrap').addEventListener('dblclick', function () {
      if (mode === 'trace' && curSeg.length > 1) { ph.trace.push(curSeg); curSeg = []; drawPhotoMarks(); updateStitch(); }
    });
    function renderPtList() {
      var box = card.querySelector('.phpts'); box.innerHTML = '';
      var dlid = 'dl-' + ph.id;
      var dl = document.createElement('datalist'); dl.id = dlid;
      allLabels().forEach(function (l) { var o = document.createElement('option'); o.value = l; dl.appendChild(o); });
      box.appendChild(dl);
      ph.refPoints.forEach(function (r, ri) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center;margin:4px 0';
        row.innerHTML = '<span class="ptag' + (shared[r.label] ? ' shared' : '') + '">📍</span>';
        var inp = document.createElement('input');
        inp.type = 'text'; inp.value = r.label; inp.maxLength = 24;
        inp.setAttribute('list', dlid); inp.setAttribute('aria-label', 'Point label');
        inp.style.width = '130px';
        inp.addEventListener('change', function () {
          r.label = inp.value.trim() || r.label; renderPhotos(); updateStitch();
        });
        var del = document.createElement('button');
        del.className = 'tbtn danger'; del.textContent = '✕';
        del.addEventListener('click', function () { ph.refPoints.splice(ri, 1); renderPhotos(); updateStitch(); });
        row.appendChild(inp); row.appendChild(del); box.appendChild(row);
      });
      if (ph.trace.length) {
        var t = document.createElement('p'); t.className = 'hint';
        t.textContent = ph.trace.length + ' wall segment(s) traced.';
        box.appendChild(t);
      }
    }
    renderPtList();
    card.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var act = b.dataset.act;
        if (act === 'up' && idx > 0) { S.photos.splice(idx, 1); S.photos.splice(idx - 1, 0, ph); }
        if (act === 'down' && idx < S.photos.length - 1) { S.photos.splice(idx, 1); S.photos.splice(idx + 1, 0, ph); }
        if (act === 'del') { S.photos.splice(idx, 1); }
        if (act === 'mark' || act === 'trace') {
          mode = (mode === act) ? null : act; curSeg = [];
          card.querySelectorAll('[data-act="mark"],[data-act="trace"]').forEach(function (x) { x.classList.remove('on'); });
          if (mode) b.classList.add('on');
          return;
        }
        renderPhotos(); updateStitch();
      });
    });
  });
  updateStitch();
}
function updateStitch() {
  var btn = $('stitchBtn'), hint = $('stitchHint');
  if (S.photos.length < 1) { btn.disabled = true; hint.textContent = 'Add photos to begin.'; return; }
  var counts = {};
  S.photos.forEach(function (p) { p.refPoints.forEach(function (r) { counts[r.label] = (counts[r.label] || 0) + 1; }); });
  var shared = Object.keys(counts).filter(function (l) { return counts[l] > 1; });
  btn.disabled = shared.length < 2 && S.photos.length > 1;
  hint.innerHTML = shared.length
    ? 'Shared reference points: <b>' + shared.map(escH).join(', ') + '</b> — ready to stitch.'
    : (S.photos.length === 1
      ? 'Single photo: trace walls, then stitch to place it on the map.'
      : 'Mark at least <b>2 shared reference points</b> (same label in 2+ photos) to stitch.');
}
$('stitchBtn').addEventListener('click', function () {
  var res = SigMapNS.stitchPhotos(S.photos);
  if (!res.walls.length) { $('stitchHint').textContent = 'Nothing to place — trace walls on at least one photo.'; return; }
  snapState();
  res.walls.forEach(function (w) { S.walls.push(w); });
  $('stitchHint').innerHTML = res.notes.map(escH).join('<br>');
  document.querySelectorAll('#flowbar .step').forEach(function (s, i) {
    s.classList.toggle('done', i === 0); s.classList.toggle('on', i === 1);
  });
  draw();
});

/* ---------- video frames ---------- */
$('videoInput').addEventListener('change', function () {
  var f = this.files[0]; if (!f) return;
  $('videoEl').src = URL.createObjectURL(f);
});
function captureFrame(video, label) {
  if (!video.videoWidth) return null;
  var c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  var url = c.toDataURL('image/jpeg', 0.85);
  addCapture('frame', url, label || ('frame ' + (S.captures.length + 1)));
  return url;
}
// test hook: pure wiring check
if (typeof window !== 'undefined') window.__sigCaptureFrame = captureFrame;
$('frameBtn').addEventListener('click', function () { captureFrame($('videoEl'), 'video frame'); });

/* ---------- live stream ---------- */
var streamObj = null;
$('streamBtn').addEventListener('click', function () {
  var msg = $('streamMsg');
  if (streamObj) {
    streamObj.getTracks().forEach(function (t) { t.stop(); });
    streamObj = null; $('streamEl').srcObject = null;
    this.textContent = '📹 Start camera'; $('streamCapBtn').disabled = true;
    msg.textContent = ''; return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'Camera not available in this browser. Use photo upload instead.';
    return;
  }
  var btn = this;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function (st) {
      streamObj = st; $('streamEl').srcObject = st; $('streamEl').play();
      btn.textContent = '⏹ Stop camera'; $('streamCapBtn').disabled = false;
      msg.textContent = '';
    })
    .catch(function (err) {
      msg.textContent = 'Camera unavailable (' + (err && err.name ? err.name : 'denied') +
        '). Your photos stay private — use photo upload instead.';
    });
});
$('streamCapBtn').addEventListener('click', function () { captureFrame($('streamEl'), 'live capture'); });

/* ---------- robot vacuum track mode ---------- */
var TR = null; // {video, timer, prev, x, y, path, cov, gw, gh, cellPx, ox, oy, steps, active, paused}
var TRACK_FPS_MS = 350, TRACK_PX = 3, TRACK_GW = 160, TRACK_GH = 160, TRACK_CELL = 8;

function trackEnsureStream(cb) {
  if (streamObj) return cb(true);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return cb(false, 'no camera API');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function (st) {
      streamObj = st; var v = document.createElement('video');
      v.muted = true; v.playsinline = true; v.srcObject = st; v.play();
      TR.video = v; cb(true);
    })
    .catch(function (e) { cb(false, (e && e.name) || 'denied'); });
}
function trackTick() {
  if (!TR || !TR.active || TR.paused || !TR.video || !TR.video.videoWidth) return;
  var tw = 64, th = 48;
  if (!TR.work) { TR.work = document.createElement('canvas'); TR.work.width = tw; TR.work.height = th; }
  var wctx = TR.work.getContext('2d');
  wctx.drawImage(TR.video, 0, 0, tw, th);
  var img = wctx.getImageData(0, 0, tw, th);
  var gray = SigMapNS.downsampleGray({ data: img.data, w: tw, h: th }, tw, th);
  if (TR.prev) {
    var m = SigMapNS.estimateMotion(TR.prev, gray, tw, th, 10);
    if (m.meanSad < 60) {
      TR.x += m.dx * TRACK_PX; TR.y += m.dy * TRACK_PX;
      TR.path.push([TR.x, TR.y]); TR.steps++;
      paintCoverage(TR.x, TR.y);
      $('trackLen').textContent = TR.steps;
      $('trackCov').textContent = trackCoveragePct().toFixed(0) + '%';
      draw();
    } else {
      $('trackState').textContent = 'low texture — hold steady';
    }
  }
  TR.prev = gray;
}
function paintCoverage(x, y) {
  var cx = Math.round((x - TR.ox) / TR.cellPx), cy = Math.round((y - TR.oy) / TR.cellPx), r = 5, i, j;
  for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
    if (i * i + j * j > r * r) continue;
    var gx = cx + i, gy = cy + j;
    if (gx >= 0 && gy >= 0 && gx < TR.gw && gy < TR.gh) TR.cov[gy * TR.gw + gx] = 1;
  }
}
function trackCoveragePct() {
  if (!TR.path.length) return 0;
  var xs = TR.path.map(function (p) { return p[0]; }), ys = TR.path.map(function (p) { return p[1]; });
  var x0 = Math.floor((Math.min.apply(0, xs) - 40 - TR.ox) / TR.cellPx),
      x1 = Math.ceil((Math.max.apply(0, xs) + 40 - TR.ox) / TR.cellPx),
      y0 = Math.floor((Math.min.apply(0, ys) - 40 - TR.oy) / TR.cellPx),
      y1 = Math.ceil((Math.max.apply(0, ys) + 40 - TR.oy) / TR.cellPx);
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(TR.gw - 1, x1); y1 = Math.min(TR.gh - 1, y1);
  var seen = 0, total = 0;
  for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) { total++; if (TR.cov[cy * TR.gw + cx]) seen++; }
  return total ? seen / total * 100 : 0;
}
$('trackStart').addEventListener('click', function () {
  if (TR && TR.active) return;
  TR = { video: null, timer: null, prev: null, x: 0, y: 0, path: [[0, 0]],
         cov: new Uint8Array(TRACK_GW * TRACK_GH), gw: TRACK_GW, gh: TRACK_GH,
         cellPx: TRACK_CELL, ox: -TRACK_GW * TRACK_CELL / 2, oy: -TRACK_GH * TRACK_CELL / 2,
         steps: 0, active: false, paused: false, work: null };
  paintCoverage(0, 0);
  $('trackState').textContent = 'starting camera…';
  var btn = this;
  trackEnsureStream(function (ok, why) {
    if (!ok) {
      $('trackState').textContent = 'Camera unavailable (' + why + '). Use photo mode instead.';
      TR = null; return;
    }
    TR.active = true;
    TR.timer = setInterval(trackTick, TRACK_FPS_MS);
    btn.disabled = true; $('trackPause').disabled = false; $('trackFinish').disabled = false;
    $('trackState').textContent = 'tracking — move slowly through the room';
    document.querySelectorAll('#flowbar .step').forEach(function (s, i) {
      s.classList.toggle('done', i === 0); s.classList.toggle('on', i === 1);
    });
    draw();
  });
});
$('trackPause').addEventListener('click', function () {
  if (!TR) return;
  TR.paused = !TR.paused;
  this.textContent = TR.paused ? '▶ Resume' : '⏸ Pause';
  $('trackState').textContent = TR.paused ? 'paused' : 'tracking — move slowly through the room';
});
$('trackFinish').addEventListener('click', function () {
  if (!TR) return;
  clearInterval(TR.timer);
  var pct = trackCoveragePct();
  S.track = { path: TR.path.slice(), cov: TR.cov, gw: TR.gw, gh: TR.gh,
              cellPx: TR.cellPx, ox: TR.ox, oy: TR.oy, coveragePct: pct, steps: TR.steps };
  $('trackState').innerHTML = 'finished — <b>' + TR.steps + '</b> steps, coverage <b>' + pct.toFixed(0) + '%</b> of explored area. Set scale, then export.';
  $('trackCov').textContent = pct.toFixed(0) + '%';
  $('trackStart').disabled = false; $('trackPause').disabled = true; this.disabled = true;
  TR.active = false;
  document.querySelectorAll('#flowbar .step').forEach(function (s, i) {
    s.classList.toggle('done', i < 2); s.classList.toggle('on', i === 2);
  });
  draw();
});

/* ---------- exports ---------- */
function mapObj() {
  return { id: S.id, name: $('mapName').value || 'My room', units: S.units,
           pxPerUnit: S.pxPerUnit, scaleSet: S.scaleSet,
           walls: S.walls, doors: S.doors, windows: S.windows,
           obstacles: S.obstacles, labels: S.labels };
}
function blobDownload(name, content, mime) {
  var b = new Blob([content], { type: mime || 'application/octet-stream' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function slug() { return (S.name || 'room').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room'; }
$('dlSVG').addEventListener('click', function () {
  if (!S.walls.length) { $('exportHint').textContent = 'Draw at least one wall first.'; return; }
  blobDownload(slug() + '-map.svg', SigMapNS.buildSVG(mapObj()), 'image/svg+xml');
});
$('dlPGM').addEventListener('click', function () {
  if (!S.walls.length) { $('exportHint').textContent = 'Draw at least one wall first.'; return; }
  blobDownload(slug() + '-map.pgm', SigMapNS.buildPGM(mapObj(), 200, 200).pgm, 'image/x-portable-graymap');
});
$('dlYAML').addEventListener('click', function () {
  if (!S.walls.length) { $('exportHint').textContent = 'Draw at least one wall first.'; return; }
  blobDownload(slug() + '-map.yaml', SigMapNS.buildYAML(mapObj(), slug() + '-map.pgm', 200, 200), 'text/yaml');
});
$('dlJSON').addEventListener('click', function () {
  if (!S.walls.length) { $('exportHint').textContent = 'Draw at least one wall first.'; return; }
  blobDownload(slug() + '-robot.json', SigMapNS.buildRobotJSON(mapObj(), S.track), 'application/json');
  if (S.track && S.track.cov)
    blobDownload(slug() + '-coverage.pgm', SigMapNS.buildCoveragePGM(S.track, 160, 160), 'image/x-portable-graymap');
  $('exportHint').textContent = S.track
    ? 'Robot pack exported (coverage ' + S.track.coveragePct.toFixed(0) + '% included).'
    : 'Robot pack exported.';
});

/* ---------- save to archive (device-local) ---------- */
$('saveMapBtn').addEventListener('click', function () {
  if (!S.walls.length) return;
  var id = S.id || ('JAH-MAP-U' + Date.now().toString(36).toUpperCase());
  S.id = id;
  var rec = { id: id, name: $('mapName').value || 'My room', kind: 'user',
              saved_at: new Date().toISOString(), map: mapObj() };
  var all = [];
  try { all = JSON.parse(localStorage.getItem('sigmap-mymaps') || '[]'); } catch (e) {}
  var ix = all.findIndex(function (r) { return r.id === id; });
  if (ix >= 0) all[ix] = rec; else all.push(rec);
  try { localStorage.setItem('sigmap-mymaps', JSON.stringify(all)); } catch (e) {}
  $('saveMapBtn').textContent = '✓ Saved (' + id + ')';
  setTimeout(function () { $('saveMapBtn').textContent = '💾 Save to archive (this device)'; }, 2500);
});

/* deep link: ?photo=N opens photos tab */
(function () {
  var m = /[?&]tab=(photos|video|stream|track)/.exec(location.search || '');
  if (m) {
    var b = document.querySelector('[data-cap="' + m[1] + '"]');
    if (b) b.click();
  }
})();

draw();
renderPhotos();
})();
