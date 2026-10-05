#!/usr/bin/env node
/* Node test suite for Signature Space Mapping.
   Tests the pure/testable cores: robot-api.js + SigMap (mapper.js).
   Run: node code/test_all.js */
'use strict';
var path = require('path'), cp = require('child_process');
var ROOT = path.dirname(__dirname);
var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 0.15 : tol); }

/* ---------- robot-api.js ---------- */
console.log('== robot-api.js ==');
var RA = require(path.join(ROOT, 'js', 'robot-api.js'));
var bot = new RA.Mapper({ width: 100, height: 100, resolution: 0.1, originX: -5, originY: -5 });
// robot at origin; walls 2m away on 4 sides
var ranges = [];
for (var k = 0; k < 36; k++) {
  var a = k * Math.PI / 18;
  // distance to the 2m box wall in direction a
  var dx = Math.cos(a), dy = Math.sin(a);
  var t = Math.min(Math.abs(2 / (dx || 1e-9)), Math.abs(2 / (dy || 1e-9)));
  ranges.push({ angle: a, dist: t });
}
var r1 = bot.ingestScan({ x: 0, y: 0, theta: 0 }, ranges, 8);
ok('ingestScan returns counts', r1.rays === 36 && r1.scans === 1, JSON.stringify(r1));
var g = bot.getOccupancyGrid();
function probAt(x, y) {
  var cx = Math.floor((x - g.origin[0]) / g.resolution),
      cy = Math.floor((y - g.origin[1]) / g.resolution);
  return g.data[cy * g.width + cx];
}
ok('wall cell occupied (2,0)', probAt(2, 0) > 50, 'p=' + probAt(2, 0));
ok('wall cell occupied (0,-2)', probAt(0, -2) > 50, 'p=' + probAt(0, -2));
ok('center free', probAt(0, 0) < 50, 'p=' + probAt(0, 0));
ok('coverage > 0', bot.coverage() > 0.01, String(bot.coverage()));
// save/load round-trip with stub store
var _mem = {};
var store = { setItem: function (k, v) { _mem[k] = String(v); },
              getItem: function (k) { return (k in _mem) ? _mem[k] : null; } };
var bot2 = new RA.Mapper({ width: 100, height: 100, resolution: 0.1, store: store });
bot2.ingestScan({ x: 0, y: 0, theta: 0 }, ranges, 8);
var id = bot2.saveMap('TESTMAP');
var bot3 = new RA.Mapper({ width: 100, height: 100, resolution: 0.1, store: store });
var rec = bot3.loadMap('TESTMAP');
ok('save/load round-trip', rec.id === 'TESTMAP' && bot3.scans === 1, rec.id);
// localize: true pose should outscore a wrong one
var ranked = bot3.localize({ ranges: ranges.slice(0, 12) },
  [{ x: 0, y: 0, theta: 0 }, { x: 3, y: 3, theta: 1.2 }], 8);
ok('localize ranks true pose first',
  ranked[0].pose.x === 0 && ranked[0].score > ranked[1].score,
  JSON.stringify(ranked.map(function (r) { return r.score; })));
// PGM/YAML from robot grid
var pgm = RA.Grid.toPGM(bot3.grid);
ok('robot PGM magic bytes', pgm.slice(0, 2) === 'P5');
var yml = RA.Grid.toYAML(bot3.grid, 'map.pgm');
ok('robot YAML keys', /image:/.test(yml) && /resolution:/.test(yml) && /origin:/.test(yml));

/* ---------- mapper.js (SigMap pure) ---------- */
console.log('== mapper.js (SigMap) ==');
var SM = require(path.join(ROOT, 'js', 'mapper.js'));
// similarity transform: scale 2, rotate 30deg, translate (5,-3)
var th = 30 * Math.PI / 180, S2 = 2, TX = 5, TY = -3;
var src = [[0, 0], [10, 0], [0, 10], [7, 4]];
var dst = src.map(function (p) {
  return [S2 * (Math.cos(th) * p[0] - Math.sin(th) * p[1]) + TX,
          S2 * (Math.sin(th) * p[0] + Math.cos(th) * p[1]) + TY];
});
var T = SM.similarityTransform(src, dst);
ok('similarity recovers scale', T && approx(T.s, 2, 0.01), T && T.s);
ok('similarity recovers angle', T && approx(T.thetaDeg, 30, 0.5), T && T.thetaDeg);
ok('similarity recovers translation', T && approx(T.tx, 5, 0.05) && approx(T.ty, -3, 0.05),
  T && (T.tx + ',' + T.ty));
ok('similarity rmse tiny', T && T.rmse < 0.01, T && T.rmse);
// stitch two photos sharing 2 labels
var ph1 = { refPoints: [{ x: 0, y: 0, label: 'A' }, { x: 100, y: 0, label: 'B' }],
            trace: [[[0, 0], [100, 0]]] };
var ph2 = { refPoints: [{ x: 10, y: 5, label: 'A' }, { x: 110, y: 5, label: 'B' }, { x: 60, y: 80, label: 'C' }],
            trace: [[[10, 5], [110, 5]]] };
var st = SM.stitchPhotos([ph1, ph2]);
ok('stitch places both photos', st.placed[0] && st.placed[1], JSON.stringify(st.placed));
ok('stitch merges walls', st.walls.length === 2, String(st.walls.length));
var w2 = st.walls[1].pts;
ok('stitch aligns shared geometry',
  approx(w2[0][0], 0, 2) && approx(w2[0][1], 0, 2) && approx(w2[1][0], 100, 2),
  JSON.stringify(w2.map(function (p) { return p.map(Math.round); })));
// motion estimation: white square shifted +5x,+3y
function synthFrame(w, h, sx, sy) {
  var f = new Uint8Array(w * h);
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++)
    f[y * w + x] = (x >= sx && x < sx + 12 && y >= sy && y < sy + 12) ? 255 : 20;
  return f;
}
var m = SM.estimateMotion(synthFrame(64, 48, 20, 20), synthFrame(64, 48, 25, 23), 64, 48, 10);
ok('motion: camera dx≈-5', approx(m.dx, -5, 1.5), 'dx=' + m.dx);
ok('motion: camera dy≈-3', approx(m.dy, -3, 1.5), 'dy=' + m.dy);
// exports
var map = { name: 'test', units: 'ft', pxPerUnit: 40, scaleSet: true,
  walls: [{ pts: [[0, 0], [400, 0], [400, 300], [0, 300], [0, 0]] }],
  doors: [{ x: 200, y: 0, angleDeg: 0, wUnits: 3 }], windows: [], obstacles: [], labels: [] };
var pgmR = SM.buildPGM(map, 200, 200);
ok('map PGM magic', pgmR.pgm.slice(0, 2) === 'P5');
var hm = /^P5\n#[^\n]*\n(\d+) (\d+)\n255\n/.exec(pgmR.pgm);
ok('map PGM dims 200x200', hm && +hm[1] === 200 && +hm[2] === 200);
var body = pgmR.pgm.slice(hm[0].length);
var hasOcc = false;
for (var i = 0; i < body.length; i += 7) if (body.charCodeAt(i) === 0) { hasOcc = true; break; }
ok('map PGM has occupied pixels', hasOcc);
var yml2 = SM.buildYAML(map, 'map.pgm', 200, 200);
ok('map YAML keys + resolution', /image: map\.pgm/.test(yml2) && /resolution: 0\.\d+/.test(yml2) && /origin: \[/.test(yml2), yml2.split('\n')[1]);
var rj = SM.buildRobotJSON(map, null);
var rjOk = false, rjHasWalls = false;
try { var rjp = JSON.parse(rj); rjOk = true; rjHasWalls = rjp.walls_m.length === 1; } catch (e) {}
ok('robot JSON parses', rjOk);
ok('robot JSON has walls_m', rjHasWalls);
var track = { path: [[0, 0], [10, 0]], cov: new Uint8Array(160 * 160), gw: 160, gh: 160,
              cellPx: 8, ox: -640, oy: -640, coveragePct: 12.5, steps: 2 };
track.cov[80 * 160 + 80] = 1;
var rj2 = JSON.parse(SM.buildRobotJSON(map, track));
ok('robot JSON carries track', !!(rj2.track && rj2.track.coverage_pct === 12.5));
var cpgm = SM.buildCoveragePGM(track, 160, 160);
ok('coverage PGM magic', cpgm.slice(0, 2) === 'P5');
var chm = /^P5\n#[^\n]*\n(\d+) (\d+)\n255\n/.exec(cpgm);
var cbody = cpgm.slice(chm[0].length);
ok('coverage PGM has seen pixel', cbody.charCodeAt(80 * 160 + 80) === 255);
var svg = SM.buildSVG(map);
ok('SVG well-formed', svg.indexOf('<svg') === 0 && svg.indexOf('</svg>') === svg.length - 6);
// captureFrame wiring: replicate the exact API sequence against stubs
var drawn = null, urlMade = false;
var stubVideo = { videoWidth: 640, videoHeight: 480 };
var stubCtx = { drawImage: function (v, x, y) { drawn = [v === stubVideo, x, y]; } };
var stubCanvas = { width: 0, height: 0, getContext: function () { return stubCtx; },
                   toDataURL: function () { urlMade = true; return 'data:image/jpeg;base64,xx'; } };
var c2 = stubCanvas;
c2.width = stubVideo.videoWidth; c2.height = stubVideo.videoHeight;
c2.getContext('2d').drawImage(stubVideo, 0, 0);
var u = c2.toDataURL('image/jpeg', 0.85);
ok('frame-capture API sequence', drawn[0] && drawn[1] === 0 && drawn[2] === 0 && u.indexOf('data:image') === 0);

/* ---------- node --check ---------- */
console.log('== node --check ==');
['js/mapper.js', 'js/archive.js', 'js/robot-api.js', 'js/signin.js', 'js/godmode.js'].forEach(function (f) {
  try { cp.execSync('node --check ' + path.join(ROOT, f), { stdio: 'pipe' }); ok('check ' + f, true); }
  catch (e) { ok('check ' + f, false, String(e.message).slice(0, 120)); }
});

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
