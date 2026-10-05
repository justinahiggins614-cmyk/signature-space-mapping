/* Signature Space Mapping — archive page: samples A–Z, search, Ask the AI,
   Best of the Best, device-local My maps, ?map= deep links. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var SAMPLES = [];

  // Render a sample layout (unit coords, feet) as a top-down SVG plan.
  function sampleSVG(s, W, H) {
    W = W || 420; H = H || 300;
    var xs = [], ys = [];
    (s.rooms || []).forEach(function (r) { xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.h); });
    var x0 = Math.min.apply(0, xs.concat([0])), y0 = Math.min.apply(0, ys.concat([0]));
    var x1 = Math.max.apply(0, xs.concat([10])), y1 = Math.max.apply(0, ys.concat([10]));
    var sc = Math.min((W - 20) / (x1 - x0), (H - 20) / (y1 - y0));
    function X(x) { return (10 + (x - x0) * sc).toFixed(1); }
    function Y(y) { return (10 + (y - y0) * sc).toFixed(1); }
    var o = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Plan: ' + esc(s.name) + '">';
    o += '<rect width="' + W + '" height="' + H + '" fill="#0a1628"/>';
    (s.rooms || []).forEach(function (r) {
      o += '<rect x="' + X(r.x) + '" y="' + Y(r.y) + '" width="' + (r.w * sc).toFixed(1) + '" height="' + (r.h * sc).toFixed(1) +
           '" fill="none" stroke="#35c8e6" stroke-width="4"/>';
      if (r.label) o += '<text x="' + X(r.x + r.w / 2) + '" y="' + Y(r.y + r.h / 2) + '" text-anchor="middle" fill="#9be8fa" font-size="12" font-family="sans-serif">' + esc(r.label) + '</text>';
    });
    (s.doors || []).forEach(function (d) {
      o += '<circle cx="' + X(d.x) + '" cy="' + Y(d.y) + '" r="4" fill="#e6a335"/>';
    });
    return o + '</svg>';
  }

  function myMaps() {
    try { return JSON.parse(localStorage.getItem('sigmap-mymaps') || '[]'); }
    catch (e) { return []; }
  }

  function renderBest() {
    var box = $('bestBox');
    if (!SAMPLES.length) { box.innerHTML = '<p class="hint">Loading…</p>'; return; }
    var d = new Date(), seed = d.getFullYear() * 1000 + Math.floor(d.getTime() / 864e5);
    var s = SAMPLES[seed % SAMPLES.length];
    box.innerHTML = '<h4 style="margin:.2em 0">' + esc(s.name) + ' <span class="badge sample">SAMPLE</span></h4>' +
      '<p class="hint">' + esc(s.id) + ' &middot; ' + esc(s.blurb) + '</p>' +
      sampleSVG(s) +
      '<p><a class="btn ghost" href="archive.html?map=' + s.id + '">Open this layout &rarr;</a> ' +
      '<a class="btn ghost" href="mapper.html">Map your own room</a></p>';
  }

  function cardHTML(s) {
    return '<div class="row"><b>' + esc(s.name) + '</b> <span class="badge sample">SAMPLE</span><br>' +
      '<span class="hint">' + esc(s.id) + ' &middot; ' + esc(s.blurb) + '</span><br>' +
      '<a style="color:var(--cy2)" href="archive.html?map=' + s.id + '">View plan &rarr;</a></div>';
  }

  function renderAZ(filter) {
    var el = $('azList');
    var list = SAMPLES.filter(function (s) {
      if (!filter) return true;
      var q = filter.toLowerCase();
      return (s.name + ' ' + s.blurb + ' ' + s.id).toLowerCase().indexOf(q) >= 0;
    });
    var groups = {};
    list.forEach(function (s) {
      var L = (s.name[0] || '#').toUpperCase();
      (groups[L] = groups[L] || []).push(s);
    });
    var letters = Object.keys(groups).sort();
    if (!letters.length) { el.innerHTML = '<p class="hint">No matches.</p>'; return; }
    el.innerHTML = letters.map(function (L) {
      return '<details class="az"><summary>' + L + ' (' + groups[L].length + ')</summary>' +
        groups[L].slice(0, 60).map(cardHTML).join('') +
        (groups[L].length > 60 ? '<p class="hint">…and ' + (groups[L].length - 60) + ' more — refine your search.</p>' : '') +
        '</details>';
    }).join('');
  }

  function renderMine() {
    var mine = myMaps(), el = $('myMaps');
    if (!mine.length) { el.innerHTML = '<p class="hint">No saved maps yet — save one from the Mapper.</p>'; return; }
    el.innerHTML = mine.map(function (m) {
      var nW = (m.map.walls || []).length;
      return '<div class="row"><b>' + esc(m.name) + '</b> <span class="badge ok">YOURS</span><br>' +
        '<span class="hint">' + esc(m.id) + ' &middot; ' + nW + ' wall runs &middot; saved ' + esc((m.saved_at || '').slice(0, 10)) + '</span></div>';
    }).join('');
  }

  function askAI() {
    var q = $('aiAsk').value.trim().toLowerCase(), box = $('aiAnswer');
    if (!q) { box.textContent = 'Type what you are looking for.'; return; }
    var words = q.split(/\s+/);
    function score(s) {
      var t = (s.name + ' ' + s.blurb + ' ' + s.id).toLowerCase(), sc = 0;
      words.forEach(function (w) { if (t.indexOf(w) >= 0) sc++; });
      return sc;
    }
    var mine = myMaps().map(function (m) {
      return { id: m.id, name: m.name + ' (your map)', blurb: 'saved on this device', _mine: 1 };
    });
    var pool = SAMPLES.concat(mine).map(function (s) { return { s: s, sc: score(s) }; })
      .filter(function (r) { return r.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc; }).slice(0, 5);
    if (!pool.length) {
      box.innerHTML = 'No matches for &ldquo;' + esc(q) + '&rdquo;. Try "garage", "studio", or "office". I only search this archive — I never invent maps.';
      return;
    }
    box.innerHTML = 'Top matches: ' + pool.map(function (r) {
      var link = r.s._mine ? 'mapper.html' : 'archive.html?map=' + r.s.id;
      return '<a style="color:var(--cy2)" href="' + link + '">' + esc(r.s.name) + '</a>';
    }).join(' · ');
  }

  function deepLink() {
    var m = /[?&]map=(JAH-MAP-[A-Z0-9]+)/.exec(location.search || '');
    if (!m || !SAMPLES.length) return;
    var s = SAMPLES.filter(function (x) { return x.id === m[1]; })[0];
    if (!s) return;
    var box = $('bestBox');
    box.innerHTML = '<h4 style="margin:.2em 0">' + esc(s.name) + ' <span class="badge sample">SAMPLE</span></h4>' +
      '<p class="hint">' + esc(s.id) + ' &middot; ' + esc(s.blurb) + '</p>' + sampleSVG(s, 640, 420) +
      '<p><a class="btn ghost" href="mapper.html">Map your own room</a></p>';
    box.scrollIntoView();
  }

  fetch('data/maps.json').then(function (r) { return r.json(); }).then(function (j) {
    SAMPLES = j.maps || [];
    var total = j.total || SAMPLES.length;
    $('mapCount').textContent = total.toLocaleString('en-US');
    document.title = total.toLocaleString('en-US') + ' Mapped Spaces — Signature Space Mapping';
    renderBest(); renderAZ(); renderMine(); deepLink();
  }).catch(function () {
    $('mapCount').textContent = 'unavailable';
    $('bestBox').innerHTML = '<p class="hint">Archive data failed to load. Check your connection and reload.</p>';
  });

  $('archSearch').addEventListener('input', function () { renderAZ(this.value.trim()); });
  $('aiAskBtn').addEventListener('click', askAI);
  $('aiAsk').addEventListener('keydown', function (e) { if (e.key === 'Enter') askAI(); });
})();
