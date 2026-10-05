#!/usr/bin/env python3
"""Builds index.html, mapper.html, robots.html, archive.html for Signature Space Mapping."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BASE = "https://justinahiggins614-cmyk.github.io/signature-space-mapping"
SITE = "Signature Space Mapping"

NAV = [
 (1,"Signature Math","signature-math/"),
 (2,"Signature Universal Paradox Immune Calculator","jah-calculator/"),
 (3,"The Signature Dictionary","jah-dictionary/"),
 (4,"JAH Wiki","jah-wiki/"),
 (5,"JAH-N Wiki Leaks","jah-n-wiki-leaks/"),
 (6,"Signature Llama: The Fully Cyber Utilizable AI","signature-llama/"),
 (7,"The Signature AI Phone Book","jah-ai-models/"),
 (8,"Globally Rejustered Patent Catalog","cyber-patent-catalog/"),
 (9,"Signature Spec Catalog Pending Patents","signature-one-archive/specs.html"),
 (10,"The Signature PC System Depository","jah-computer-systems/"),
 (11,"The Signature Book Depository","signature-books/"),
 (12,"The Signature Comic Store","signature-comics/"),
 (13,"The Signature Global Newspaper Archive","signature-newspapers/"),
 (14,"The Signature AI Mix and Match Generator","signature-backend/"),
 (15,"The Signature Boundless Generator Archive","signature-boundless-generators/"),
 (16,"The Signature AI Mix Lab","signature-ai-mixlab/"),
 (17,"AI Olympics","signature-ai-olypics/"),
 (18,"The Signature Computer Chip Maker and Archive","signature-chip-maker/"),
 (19,"The Signature App Archive","signature-app-archive/"),
 (20,"The Signature AI Robot Matcher","signature-ai-robot-matcher/"),
 (21,"The Signature Experiment Solver","signature-experiment-solver/"),
 (22,"Signature AI Pixel","signature-ai-image-video-maker/"),
 (23,"Signature Music Studio","signature-ai-song-maker/"),
 (24,"The Signature Mr Fix-It","signature-fixit/"),
 (25,"The Signature University","signature-university/"),
 (26,"The Signature Cyber Mega-Mall","signature-cyber-mega-mall/"),
 (27,"The Signature 3D Print Mega Mall","signature-3d-print/"),
 (28,"Signature Earth","signature-earth/"),
 (29,"The Signature Flight School","signature-flight-school/"),
 (30,"The Signature Game Store","signature-game-store/"),
 (31,"Signature Website Creator","signature-website-creator/"),
 (32,"The Signature Antivirus","signature-antivirus/"),
 (33,"The Signature OS Updater","signature-os-updater/"),
]

def nav_html():
    links = "".join(
        '<a href="https://justinahiggins614-cmyk.github.io/%s">%d %s</a>' % (u, n, t)
        for n, t, u in NAV)
    return ('<div class="jahnet"><span class="jahnet-t">THE JAH NETWORK</span>' + links +
            '<br><span class="here">34 Signature Space Mapping &mdash; YOU ARE HERE</span></div>')

CSS = """:root{--cy:#35c8e6;--cy2:#9be8fa;--navy:#0a1628;--panel:#0e1f38;--line:#1e4a6e;--txt:#eef6ff;--dim:#93b4cc}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--txt);background:var(--navy);min-height:100vh}
.wrap{max-width:1060px;margin:0 auto;padding:14px 12px 40px}
.kicker{letter-spacing:.25em;font-size:.72rem;color:var(--cy);margin:10px 0 4px}
h1{font-size:1.7rem;margin:.1em 0}
h2{color:var(--cy2);font-size:1.25rem;margin:1.2em 0 .4em}
p{line-height:1.6}
.tabs{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.tabs a{flex:1 1 120px;text-align:center;text-decoration:none;color:var(--txt);background:var(--panel);border:2px solid var(--line);border-radius:999px;padding:11px 8px;font-weight:700}
.tabs a.active{background:var(--cy);color:#06121a;border-color:var(--cy)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.card h3{margin:.2em 0;color:var(--cy2)}
.btn{display:inline-block;background:var(--cy);color:#06121a;border:0;border-radius:999px;padding:13px 26px;font-weight:800;font-size:1rem;cursor:pointer;text-decoration:none;margin:6px 6px 6px 0}
.btn.ghost{background:transparent;color:var(--cy2);border:2px solid var(--cy)}
.btn.warn{background:#e6a335}.btn.danger{background:#e65c5c;color:#fff}
.btn:disabled{opacity:.45;cursor:default}
.hint{color:var(--dim);font-size:.85rem}
.mono{font-family:ui-monospace,Consolas,monospace;background:#060d18;border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:.85rem}
.badge{display:inline-block;border-radius:999px;padding:3px 12px;font-size:.78rem;font-weight:700}
.badge.ok{background:#0e3a2a;color:var(--cy2)}.badge.warn{background:#3a2f0e;color:#ffd97f}.badge.no{background:#3a1414;color:#ff9d9d}
.badge.sample{background:#1a2f4a;color:var(--cy2)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.jahnet{margin:26px 0 10px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#0b1a30;font-size:.82rem;line-height:2.1}
.jahnet-t{color:var(--cy);font-weight:800;letter-spacing:.2em;margin-right:10px}
.jahnet a{color:var(--dim);text-decoration:none;margin:0 8px 0 0;white-space:nowrap}
.jahnet .here{display:inline-block;background:#0e3a2a;color:var(--cy2);border:1px solid var(--cy);border-radius:999px;padding:2px 12px;font-weight:800;margin:4px 0}
footer{color:#5f7d99;font-size:.78rem;text-align:center;margin:20px 0}
input[type=text],input[type=number],textarea,select{background:#060d18;color:var(--txt);border:2px solid var(--line);border-radius:10px;padding:11px 13px;font-size:.95rem}
label.fl{display:block;margin:8px 0 4px;color:var(--cy2);font-weight:700}
.stepbar{display:flex;gap:6px;margin:14px 0;flex-wrap:wrap}
.step{flex:1 1 150px;text-align:center;padding:12px 6px;border-radius:10px;border:2px solid var(--line);color:var(--dim);font-weight:700;font-size:.9rem}
.step.on{border-color:var(--cy);color:var(--cy2)}
.step.done{border-color:var(--cy);background:#0e3a2a;color:var(--cy2)}
#mapCanvasWrap{position:relative;border:2px solid var(--line);border-radius:14px;overflow:hidden;background:#050b14;touch-action:none}
#mapCanvas{display:block;width:100%;height:min(62vh,520px);cursor:crosshair}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.tbtn{background:var(--panel);color:var(--txt);border:2px solid var(--line);border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:.92rem}
.tbtn.on{background:var(--cy);color:#06121a;border-color:var(--cy)}
.capstrip{display:flex;gap:8px;overflow-x:auto;padding:8px 2px}
.capstrip figure{margin:0;min-width:120px;text-align:center}
.capstrip img{width:120px;height:90px;object-fit:cover;border-radius:8px;border:2px solid var(--line)}
.capstrip figcaption{font-size:.75rem;color:var(--dim)}
.photocard{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;background:#0b1a30}
.photocard img{width:100%;border-radius:8px;cursor:crosshair}
.ptag{display:inline-block;background:#12324a;border:1px solid var(--cy);color:var(--cy2);border-radius:999px;padding:2px 10px;font-size:.78rem;margin:2px}
.ptag.shared{background:#0e3a2a;border-color:var(--cy)}
.az{margin:8px 0}.az summary{cursor:pointer;font-weight:800;color:var(--cy2);padding:10px;background:#0b1a30;border:1px solid var(--line);border-radius:10px}
.az .row{padding:8px 4px;border-bottom:1px dashed #1e4a6e;font-size:.92rem}
.best{border:2px solid var(--cy);background:#0b2432}
pre.code{background:#060d18;border:1px solid var(--line);border-radius:10px;padding:12px;overflow-x:auto;font-size:.82rem;line-height:1.5}
table.spec{width:100%;border-collapse:collapse;font-size:.9rem}
table.spec td,table.spec th{border:1px solid var(--line);padding:8px 10px;text-align:left}
table.spec th{color:var(--cy2)}
#jahWelcome,#jahGuide,#jahGuideBtn{--amber:#35c8e6;--amber2:#9be8fa}
#jahGuideBtn{position:fixed;top:14px;right:14px;z-index:99900;min-width:48px;min-height:48px;border-radius:24px;border:1px solid var(--amber);background:#0e1f38;color:var(--amber2);font-weight:700;font-size:18px;padding:10px 16px;cursor:pointer}
#jahGuideBtn:hover{background:var(--amber);color:#06121a}
#jahWelcome{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.75)}
#jahWelcome.show{display:flex}
#jahWelcomeCard{background:#0e1f38;border:2px solid var(--amber);border-radius:14px;padding:22px 20px;max-width:540px;width:100%;max-height:88vh;overflow-y:auto;color:var(--txt)}
#jahWelcomeCard h2{margin:0 0 4px;color:var(--amber2);font-size:20px}
#jahWelcomeCard .wsub{margin:4px 0 0;color:var(--dim);font-size:14px}
#jahWelcomeCard ol{margin:10px 0 0;padding-left:22px;font-size:14px;line-height:1.55}
#jahWelcomeCard ol li{margin:8px 0}
#jahWelcomeCard ol li b{color:var(--amber2)}
#jahWelcomeCard .wbtnrow{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
#jahGuide .btn,#jahWelcome .btn{min-height:48px;min-width:48px;font-size:15px;padding:12px 22px;border-radius:10px;border:1px solid var(--amber);background:transparent;color:var(--amber2);cursor:pointer;font-family:inherit}
#jahWelcomeOk{font-weight:700;background:var(--amber)!important;color:#06121a!important;border:none!important}
#jahGuide{position:fixed;inset:0;z-index:99900;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.7)}
#jahGuide.show{display:flex}
#jahGuideCard{background:#0e1f38;border:1px solid var(--amber);border-radius:14px;max-width:680px;width:100%;max-height:86vh;overflow:auto;padding:20px 22px;color:var(--txt)}
#jahGuideCard h2{margin-top:0;color:var(--amber2)}
#jahGuideCard .gfeat{margin:0 0 14px;padding:10px 12px;background:#0b1a30;border:1px solid var(--line);border-radius:10px}
#jahGuideCard .gfeat b{color:var(--amber2)}
#jahGuideCard .gfeat p{margin:4px 0 0;font-size:14px;line-height:1.5;color:var(--txt)}
#jahGuideCloseRow{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center;justify-content:space-between}
"""

def head(title, desc, extra=""):
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>%s</title>
<meta name="description" content="%s">
<style>%s</style>
<script src="js/signin.js"></script>
<script src="js/godmode.js"></script>
%s</head>
<body>
<div class="wrap">
<header>
<p class="kicker">SITE 34 OF 34 &middot; THE JAH NETWORK</p>
""" % (title, desc, CSS, extra)

def tabs(active):
    items = [("index.html","🏠 Main"),("mapper.html","🗺️ Mapper"),("robots.html","🤖 For Robots"),("archive.html","🗂️ 1 Million Archive")]
    out = '<nav class="tabs" aria-label="Site sections">'
    for href, label in items:
        out += '<a href="%s"%s>%s</a>' % (href, ' class="active"' if href == active else '', label)
    return out + "</nav>"

WELCOME_HTML = """
<button id="jahGuideBtn" aria-label="Open the site guide" title="How to use this site">?</button>
<div id="jahWelcome" aria-hidden="true">
  <div id="jahWelcomeCard" role="dialog" aria-modal="true" aria-label="Welcome to Signature Space Mapping">
    <h2>Welcome to Signature Space Mapping</h2>
    <p class="wsub">Map any room. Feed the future robots.</p>
    <ol>
      <li><b>1 &mdash; Give.</b> Drop in room photos, grab frames from a video, or stream live from your camera.</li>
      <li><b>2 &mdash; Map.</b> Trace walls, doors and obstacles on the top-down canvas. Set scale with anything you know the size of.</li>
      <li><b>3 &mdash; Use.</b> Download the SVG room map plus a robot pack (occupancy grid + JSON) your future robot can navigate with.</li>
      <li><b>🤖 Robot track mode.</b> Strap your phone to a robot vacuum and drive &mdash; the app paints the room as it goes, like the vacuum sees it.</li>
    </ol>
    <div class="wbtnrow">
      <button class="btn" id="jahWelcomeOk" type="button">OK &mdash; Got it &#10003;</button>
      <button class="btn" id="jahWelcomeFull" type="button">Full how-to guide</button>
    </div>
  </div>
</div>
<div id="jahGuide" aria-hidden="true">
  <div id="jahGuideCard" role="dialog" aria-modal="true" aria-label="How to use this site">
    <div id="jahGuideCloseRow">
      <h2 style="margin:0">How to use this site</h2>
      <button class="btn" id="jahGuideClose" type="button">&#10005; Close</button>
    </div>
    <div class="gfeat"><b>📸 Give &mdash; three ways in</b><p><b>Photos</b> (best for most rooms): drop in 2&ndash;3 photos, order them, mark the same doorway or corner in each &mdash; the mapper stitches them into one top-down map. <b>Video:</b> upload a walkthrough clip and capture frames. <b>Stream:</b> use your live camera, or strap the phone to a robot vacuum in Robot Vacuum Track Mode and let it paint the room.</p></div>
    <div class="gfeat"><b>🗺️ Map &mdash; honest and guided</b><p>This is user-guided mapping, not LiDAR: you trace what you see, the app snaps, measures and keeps scale. Set scale with any known length (a doorway is usually 30&ndash;36 in). The photo stitcher aligns your marked shared points &mdash; it never invents geometry.</p></div>
    <div class="gfeat"><b>📦 Use &mdash; real files</b><p>Top-down <b>SVG</b> for humans, plus a <b>robot pack</b>: PGM occupancy grid + ROS-style YAML + JSON. Real valid files &mdash; the same open format the on-device robot library speaks.</p></div>
    <div class="gfeat"><b>🤖 For Robots</b><p>The For Robots tab documents the open map format and the embeddable <b>SignatureRobotMapper</b> library &mdash; feed it scans, get the live grid. Built so Manon's AI in a Signature robot body can navigate any mapped space.</p></div>
    <div class="gfeat"><b>🗂️ 1 Million Archive</b><p>Sample room layouts marching to a million &mdash; clearly labeled samples to learn from. Save your own maps device-locally from the Mapper.</p></div>
    <div class="gfeat"><b>🔒 Your captures stay yours</b><p>Photos and video never leave your device. Mapping happens 100% in your browser.</p></div>
    <div class="btnrow" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
      <button class="btn" id="jahGuideTour" type="button">&#9654; Show the welcome guide</button>
      <button class="btn" id="jahGuideClose2" type="button">&#10005; Close guide</button>
    </div>
  </div>
</div>
<script>(function(){try{
var FLAG="jah-tour-seen-spacemap";
var JAHPS=(function(){try{return (typeof JAHProfile!=="undefined")&&JAHProfile.store?JAHProfile.store:localStorage;}catch(e){return localStorage;}})();
function ls(k,v){try{if(v===undefined)return JAHPS.get(k);JAHPS.set(k,v)}catch(e){return null}}
var w=document.getElementById("jahWelcome"),guide=document.getElementById("jahGuide"),
    guideCard=document.getElementById("jahGuideCard"),guideBtn=document.getElementById("jahGuideBtn");
function openWelcome(){if(!w)return;w.classList.add("show");w.setAttribute("aria-hidden","false");
  try{document.getElementById("jahWelcomeOk").focus({preventScroll:true})}catch(e){}}
function closeWelcome(){if(!w)return;w.classList.remove("show");w.setAttribute("aria-hidden","true");ls(FLAG,"1")}
document.getElementById("jahWelcomeOk").onclick=closeWelcome;
document.getElementById("jahWelcomeFull").onclick=function(){closeWelcome();openGuide()};
w.addEventListener("click",function(e){if(e.target===w)closeWelcome()});
document.addEventListener("keydown",function(e){if(w.classList.contains("show")&&e.key==="Escape"){closeWelcome();e.preventDefault()}});
function openGuide(){if(!guide)return;guide.classList.add("show");guide.setAttribute("aria-hidden","false");
  try{guideCard.scrollTop=0;document.getElementById("jahGuideClose").focus({preventScroll:true})}catch(e){}}
function closeGuide(){if(!guide)return;guide.classList.remove("show");guide.setAttribute("aria-hidden","true");
  try{guideBtn.focus({preventScroll:true})}catch(e){}}
guideBtn.onclick=openWelcome;
document.getElementById("jahGuideClose").onclick=closeGuide;
document.getElementById("jahGuideClose2").onclick=closeGuide;
document.getElementById("jahGuideTour").onclick=function(){closeGuide();openWelcome()};
guide.addEventListener("click",function(e){if(e.target===guide)closeGuide()});
if(!ls(FLAG)){setTimeout(openWelcome,900)}
}catch(e){}})();</script>
"""

FOOT = """
%s
<footer>Signature Space Mapping &middot; your captures never leave your device &middot; free forever</footer>
</div>
%s
<script>
(function () {
  var mount = document.querySelector('header .booksearch') ||
              document.querySelector('nav.jtabbar') ||
              document.querySelector('header nav') ||
              document.querySelector('header') ||
              document.body;
  if (window.JAHProfile && JAHProfile.ui) JAHProfile.ui.renderButton(mount);
})();
</script>
<script>
(function () {
  if (window.JAHProfile && JAHProfile.ui) {
    var mount = document.querySelector('header') || document.body;
    JAHProfile.ui.renderGreeting(mount);
  }
})();
</script>
</body>
</html>
"""

def page(filename, title, desc, active_tab, h1, sub, body, extra_head=""):
    html = (head(title, desc, extra_head) +
            "<h1>%s</h1>\n<p class=\"hint\">%s</p>\n</header>\n" % (h1, sub) +
            tabs(active_tab) + body + FOOT % (nav_html(), WELCOME_HTML))
    open(os.path.join(ROOT, filename), "w").write(html)
    print("wrote", filename, len(html), "bytes")

def index_body():
    return """
<div class="card">
<h3>🗺️ Map any room. Feed the future robots.</h3>
<p>Give Signature Space Mapping your room &mdash; photos, a video walkthrough, or your live camera &mdash; and it builds a top-down map with real measurements. Download the map as SVG, plus a <b>robot pack</b> (occupancy grid + JSON) that a robot can actually navigate with. One day Manon's robots will know every room &mdash; this is how they learn.</p>
<p><span class="badge ok">FREE FOREVER</span> <span class="badge ok">100% ON-DEVICE</span> <span class="badge ok">NO ACCOUNT</span></p>
<a class="btn big" href="mapper.html">Start mapping &rarr;</a>
<a class="btn ghost" href="robots.html">🤖 For robots</a>
</div>
<div class="stepbar">
<div class="step"><b>1 &mdash; GIVE</b><br>Photos, video frames,<br>or live camera</div>
<div class="step"><b>2 &mdash; MAP</b><br>Trace walls, doors,<br>set the scale</div>
<div class="step"><b>3 &mdash; USE</b><br>SVG map + robot pack<br>(grid + JSON)</div>
</div>
<div class="grid2">
<div class="card"><h3>📸 Photos first</h3><p>Just 2&ndash;3 room photos is enough. Order them, mark the same doorway or corner in each, and the mapper stitches them into one top-down plan &mdash; fully offline, no video needed.</p></div>
<div class="card"><h3>🤖 Robot Vacuum Track Mode</h3><p>Strap your phone to a robot vacuum and drive. The app watches the stream and paints the room as it goes &mdash; coverage grid, path trail, room map &mdash; the way the vacuum sees it.</p></div>
<div class="card"><h3>📦 Robot pack</h3><p>Every map exports a ROS-style occupancy grid (PGM + YAML) and JSON &mdash; the open format the on-device <b>SignatureRobotMapper</b> library speaks. Built for Manon's AI in a Signature robot body.</p></div>
<div class="card"><h3>🔒 Yours, always</h3><p>Captures never leave your device. Mapping happens entirely in your browser. Save maps to the archive on this device.</p></div>
</div>
<div class="card">
<h3>Honest about what this is</h3>
<p class="hint">This is <b>user-guided</b> mapping, not LiDAR: you trace what you see and the app snaps, measures, and keeps scale. The photo stitcher aligns the reference points <b>you</b> mark &mdash; it never invents geometry. Robot track mode watches through <b>your</b> camera; it is not connected to any vacuum's sensors and integrates no vendor API.</p>
</div>
"""

def mapper_body():
    return """
<div class="stepbar" id="flowbar">
<div class="step on" data-s="give"><b>1 &mdash; GIVE</b><br><span class="hint">photos / video / stream</span></div>
<div class="step" data-s="map"><b>2 &mdash; MAP</b><br><span class="hint">trace + scale</span></div>
<div class="step" data-s="use"><b>3 &mdash; USE</b><br><span class="hint">SVG + robot pack</span></div>
</div>

<div class="card" id="sec-give">
<h3>1 &mdash; Give it your room</h3>
<div class="toolbar" role="tablist" aria-label="Capture source">
<button class="tbtn on" data-cap="photos">📸 Photos</button>
<button class="tbtn" data-cap="video">🎬 Video frames</button>
<button class="tbtn" data-cap="stream">📹 Live stream</button>
<button class="tbtn" data-cap="track">🤖 Robot vacuum track</button>
</div>

<div id="cap-photos">
<p class="hint"><b>Photo-first mapping:</b> drop in 2&ndash;3 photos of the room. Then order them, mark the same doorway/corner in each photo, trace the walls you see &mdash; the mapper stitches it all into one top-down map. Works fully offline from stills.</p>
<input type="file" id="photoInput" accept="image/*" multiple aria-label="Upload room photos">
<div id="photoList"></div>
<button class="btn" id="stitchBtn" disabled>🧵 Stitch photos into map</button>
<p class="hint" id="stitchHint">Mark at least <b>2 shared reference points</b> (same label in 2+ photos) to stitch.</p>
</div>

<div id="cap-video" style="display:none">
<p class="hint">Upload a walkthrough video, scrub to a good view, and capture frames.</p>
<input type="file" id="videoInput" accept="video/*" aria-label="Upload walkthrough video"><br><br>
<video id="videoEl" controls playsinline style="width:100%;max-height:300px;border-radius:10px;background:#000"></video>
<div class="toolbar"><button class="tbtn" id="frameBtn">📷 Capture frame</button></div>
</div>

<div id="cap-stream" style="display:none">
<p class="hint">Use your live camera to capture views of the room.</p>
<div class="toolbar"><button class="tbtn" id="streamBtn">📹 Start camera</button>
<button class="tbtn" id="streamCapBtn" disabled>📷 Capture</button></div>
<video id="streamEl" playsinline muted style="width:100%;max-height:300px;border-radius:10px;background:#000"></video>
<p class="hint" id="streamMsg"></p>
</div>

<div id="cap-track" style="display:none">
<p class="hint"><b>Robot Vacuum Track Mode</b> (generic &mdash; works with any robot vacuum): strap your phone to the vacuum &mdash; camera facing forward &mdash; and drive. The app watches the stream and paints the room as it goes: coverage grid, path trail, the room the way the vacuum sees it.</p>
<p class="hint">Honest limits: tracks via <b>your camera only</b> &mdash; not the vacuum's sensors, no vendor API. Drift accumulates: go slow, keep the light good, and set scale when you finish.</p>
<div class="toolbar">
<button class="tbtn" id="trackStart">▶ Start track</button>
<button class="tbtn" id="trackPause" disabled>⏸ Pause</button>
<button class="tbtn danger" id="trackFinish" disabled>⏹ Finish</button>
</div>
<p><b>Coverage:</b> <span id="trackCov">0%</span> &middot; <b>Path:</b> <span id="trackLen">0</span> steps &middot; <span id="trackState" class="hint">idle</span></p>
</div>

<h3>Captures</h3>
<div class="capstrip" id="capStrip"><p class="hint">Nothing captured yet.</p></div>
</div>

<div class="card" id="sec-map">
<h3>2 &mdash; Map it (top-down)</h3>
<div class="toolbar" role="toolbar" aria-label="Map tools">
<button class="tbtn on" data-tool="select">👆 Select</button>
<button class="tbtn" data-tool="wall">🧱 Wall</button>
<button class="tbtn" data-tool="door">🚪 Door</button>
<button class="tbtn" data-tool="window">🪟 Window</button>
<button class="tbtn" data-tool="obstacle">📦 Obstacle</button>
<button class="tbtn" data-tool="label">🏷 Label</button>
<button class="tbtn" data-tool="measure">📏 Measure</button>
<button class="tbtn" data-tool="erase">🧹 Erase</button>
<button class="tbtn" id="snapBtn" aria-pressed="true">🧲 Snap: on</button>
<button class="tbtn" id="undoBtn">↩ Undo</button>
<button class="tbtn danger" id="clearBtn">🗑 Clear</button>
</div>
<div id="mapCanvasWrap"><canvas id="mapCanvas" width="900" height="560" aria-label="Top-down room map canvas"></canvas></div>
<p class="hint" id="toolHint">Wall: click points, double-click to finish. Drag to pan (select tool), wheel to zoom.</p>
<div class="grid2">
<div>
<label class="fl" for="scaleLen">Set scale &mdash; a line you know the length of:</label>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<input type="number" id="scaleLen" min="0.1" step="0.1" value="10" style="width:110px" aria-label="Known length">
<select id="scaleUnit" aria-label="Units"><option value="ft">feet</option><option value="m">meters</option></select>
<button class="tbtn" id="scaleBtn">📏 Set from last measure</button>
</div>
<p class="hint" id="scaleState">Scale: not set &mdash; exports use 40 px per foot until you set it.</p>
</div>
<div>
<label class="fl" for="mapName">Map name</label>
<input type="text" id="mapName" value="My room" maxlength="60">
<div style="margin-top:8px"><button class="tbtn" id="saveMapBtn">💾 Save to archive (this device)</button></div>
</div>
</div>
</div>

<div class="card" id="sec-use">
<h3>3 &mdash; Use it</h3>
<p class="hint">Real files, generated on your device. The robot pack is the open format the <b>SignatureRobotMapper</b> library reads.</p>
<div class="toolbar">
<button class="btn" id="dlSVG">⬇ SVG map</button>
<button class="btn" id="dlPGM">⬇ Occupancy grid (PGM)</button>
<button class="btn" id="dlYAML">⬇ Map YAML</button>
<button class="btn" id="dlJSON">⬇ Robot pack (JSON)</button>
</div>
<p class="hint" id="exportHint">Draw at least one wall to export. Track-mode coverage ships inside the robot pack when present.</p>
</div>
"""

def robots_body():
    return """
<div class="card">
<h3>🤖 For robots &mdash; the open map face of Space Mapping</h3>
<p>Space Mapping is two things: a human mapping tool <b>and</b> an on-device mapping library + open map format any robot controller can adopt. No cloud, no account, no vendor lock-in &mdash; the map lives where the robot lives.</p>
<p><b>The big picture:</b> pair this with the <a style="color:var(--cy2)" href="https://justinahiggins614-cmyk.github.io/signature-ai-robot-matcher/">Signature AI Robot Matcher</a> &mdash; an AI matched to a Signature robot body, reading Space Mapping maps through the library below. That is how Manon's robots get environmental awareness: <b>AI + body + map</b>.</p>
<p class="hint">Honest framing: this is an on-device JavaScript mapping library and an open file format. It is not a cloud service, not a hardware driver, and it talks to no vendor's API.</p>
<a class="btn" href="js/robot-api.js" download>⬇ Download robot-api.js</a>
</div>

<div class="card">
<h3>📚 API reference &mdash; <span class="mono">SignatureRobotMapper</span></h3>
<pre class="code">// 200x200 cells, 5cm per cell, origin at (-5m, -5m)
var bot = new SignatureRobotMapper({width:200, height:200, resolution:0.05,
                                    originX:-5, originY:-5});

// Feed a scan: pose in meters/radians, ranges in meters (dist<0 = no hit)
bot.ingestScan({x:1.2, y:0.5, theta:0.3},
               [{angle:0, dist:2.1}, {angle:0.5, dist:1.4}, /* ... */]);
// → {rays: n, scans: n}   (log-odds grid updated by ray casting)

// Read the live map
var g = bot.getOccupancyGrid();
// g = {width, height, resolution, origin:[x,y], data:Int16Array}
// data: -1 = unknown, 0..100 = occupied probability

bot.coverage();            // fraction of cells observed (0..1)
var id = bot.saveMap();    // persists to device storage, returns id
bot.loadMap(id);           // restores grid + path

// EXPERIMENTAL localization: rank candidate poses against the grid
var ranked = bot.localize({ranges:[...]}, [{x:..,y:..,theta:..}, ...]);
// → [{pose, score, rays}] best first. Labeled experimental: verify on your hardware.</pre>
</div>

<div class="card">
<h3>🗂️ Map data format</h3>
<table class="spec">
<tr><th>File</th><th>Format</th><th>Meaning</th></tr>
<tr><td><span class="mono">map.pgm</span></td><td>P5 binary PGM</td><td>0 = occupied, 205 = unknown, 254 = free</td></tr>
<tr><td><span class="mono">map_coverage.pgm</span></td><td>P5 binary PGM</td><td>0 = unseen, 255 = seen (track mode)</td></tr>
<tr><td><span class="mono">map.yaml</span></td><td>ROS map_server YAML</td><td><span class="mono">image, resolution (m/px), origin [x,y,0], negate, occupied_thresh, free_thresh</span></td></tr>
<tr><td><span class="mono">robot.json</span></td><td>JSON</td><td>Walls/doors/obstacles in real units, path, coverage %, grid dims</td></tr>
</table>
<p class="hint">Occupancy values follow the ROS convention so existing navigation stacks can read these maps directly.</p>
</div>

<div class="card">
<h3>🔗 Pairing walkthrough &mdash; aware robot in 4 steps</h3>
<ol>
<li><b>Match the mind to the body</b> on the <a style="color:var(--cy2)" href="https://justinahiggins614-cmyk.github.io/signature-ai-robot-matcher/">AI Robot Matcher</a> &mdash; pick the AI + Signature robot body pair for the job.</li>
<li><b>Map the space</b> with the Mapper tab &mdash; photos, video, or Robot Vacuum Track Mode.</li>
<li><b>Load the robot pack</b> into your controller with <span class="mono">robot-api.js</span> &mdash; <span class="mono">loadMap()</span> restores the grid, <span class="mono">ingestScan()</span> keeps it live.</li>
<li><b>Navigate</b> &mdash; the AI plans over the occupancy grid; new scans refine it. The map is the robot's memory of the room.</li>
</ol>
</div>
"""

def archive_body():
    return """
<div class="card best">
<h3>⭐ AI's Best of the Best</h3>
<div id="bestBox"><p class="hint">Loading…</p></div>
</div>
<div class="card">
<h3>🔍 Search &amp; ask</h3>
<input type="search" id="archSearch" placeholder="Search mapped spaces…" aria-label="Search mapped spaces" style="width:100%">
<div style="margin-top:8px;display:flex;gap:8px">
<input type="search" id="aiAsk" placeholder="🤖 Ask the AI — e.g. &quot;garage&quot;" aria-label="Ask the AI" style="flex:1">
<button class="tbtn" id="aiAskBtn">Ask</button>
</div>
<div id="aiAnswer" class="hint" style="margin-top:6px"></div>
</div>
<div class="card">
<h3>💾 My maps (this device)</h3>
<div id="myMaps"><p class="hint">No saved maps yet — save one from the Mapper.</p></div>
</div>
<div class="card">
<h3>🗂️ Sample layouts <span class="badge sample">SAMPLES</span></h3>
<p class="hint">Deterministic sample room layouts to learn from &mdash; clearly labeled, never posed as real user maps. Marching to <b>1,000,000</b>: <b id="mapCount">…</b> on file.</p>
<div id="azList"></div>
</div>
"""

def main():
    page("index.html", "Map any room. Feed the future robots. — Signature Space Mapping",
         "Signature Space Mapping: turn room photos, video, or live camera into top-down maps with real measurements — plus robot packs future robots can navigate with.",
         "index.html", "🗺️ Signature Space Mapping",
         "Give it your room — photos, video, or live camera. Get back a measured map + a robot pack.",
         index_body())
    page("mapper.html", "The Mapping Studio — Signature Space Mapping",
         "The Space Mapping studio: capture photos, video frames, or live stream — trace walls, set scale, track with robot vacuum mode, export SVG + robot pack.",
         "mapper.html", "🗺️ The Mapping Studio",
         "1 Give → 2 Map → 3 Use. Your captures never leave this device.",
         mapper_body(), extra_head='<script src="js/robot-api.js"></script>\n<script src="js/mapper.js" defer></script>')
    page("robots.html", "For Robots — API + open map format — Signature Space Mapping",
         "For robots: the SignatureRobotMapper on-device library, open map format docs, and the AI + body + map pairing walkthrough.",
         "robots.html", "🤖 For Robots",
         "The open map face: library, format, and the path to an aware robot.",
         robots_body())
    page("archive.html", "1 Million Mapped Spaces — Signature Space Mapping",
         "Every mapped space, A to Z — sample layouts marching to one million, plus your own device-local maps.",
         "archive.html", "🗂️ 1 Million Mapped Spaces",
         "Sample layouts A–Z, marching to 1,000,000. Your own maps stay on your device.",
         archive_body(), extra_head='<script src="js/archive.js" defer></script>')

if __name__ == "__main__":
    main()
