#!/usr/bin/env python3
"""Builds api.json, sitemap.xml, robots.txt for Signature Space Mapping."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BASE = "https://justinahiggins614-cmyk.github.io/signature-space-mapping"

stats = {"total": 0}
sp = os.path.join(ROOT, "data", "stats.json")
if os.path.exists(sp):
    stats = json.load(open(sp))

api = {
    "site": "Signature Space Mapping",
    "site_number": 34, "of": 34,
    "tagline": "Map any room. Feed the future robots.",
    "counts": {"sample_maps": stats["total"], "goal": 1000000},
    "pages": {
        "main": BASE + "/",
        "mapper": BASE + "/mapper.html",
        "robots": BASE + "/robots.html",
        "archive": BASE + "/archive.html",
    },
    "robot": {
        "library": BASE + "/js/robot-api.js",
        "format": {
            "pgm": "P5 binary: 0=occupied, 205=unknown, 254=free",
            "yaml": "ROS map_server: image, resolution (m/px), origin [x,y,0], negate, occupied_thresh, free_thresh",
            "json": "signature-robot-map/1.0: walls/doors/obstacles in meters, path, coverage",
        },
        "map_index": BASE + "/data/maps.json",
    },
    "exports": ["svg", "pgm", "yaml", "json"],
}
open(os.path.join(ROOT, "api.json"), "w").write(json.dumps(api, indent=1) + "\n")

urls = ["", "/mapper.html", "/robots.html", "/archive.html"]
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in urls:
    sm.append("  <url><loc>%s%s</loc></url>" % (BASE, u))
sm.append("</urlset>")
open(os.path.join(ROOT, "sitemap.xml"), "w").write("\n".join(sm) + "\n")

open(os.path.join(ROOT, "robots.txt"), "w").write(
    "User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n" % BASE)
print("meta ok: %d sample maps" % stats["total"])
