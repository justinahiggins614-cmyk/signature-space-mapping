#!/usr/bin/env python3
"""Deterministic sample room-layout generator for Signature Space Mapping.
Writes data/maps.json ({total, maps:[...]}) and data/stats.json.
Samples are CLEARLY labeled kind:'sample' — never posed as real user maps.
IDs: JAH-MAP-######, sequential from data/stats.json next_index (never reused).
"""
import argparse, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
MAPS_JSON = os.path.join(DATA, "maps.json")
STATS_JSON = os.path.join(DATA, "stats.json")

TYPES = [
    ("Studio Flat", ["living", "kitchen nook", "bath"]),
    ("One-Bedroom", ["living", "bedroom", "kitchen", "bath"]),
    ("Two-Bedroom", ["living", "bedroom A", "bedroom B", "kitchen", "bath"]),
    ("Home Office", ["office", "hall", "bath"]),
    ("Garage Workshop", ["garage", "workshop", "storage"]),
    ("Kitchen Diner", ["kitchen", "dining", "pantry"]),
    ("Loft", ["loft", "studio", "bath"]),
    ("Cabin", ["great room", "bunk", "porch"]),
]

ADJ = ["Maple", "Cedar", "Birch", "Elm", "Oak", "Pine", "Ash", "Willow",
       "North", "South", "East", "West", "Sunny", "Quiet", "Cozy", "Bright"]

def gen_one(rng, idx):
    tname, rooms_t = rng.choice(TYPES)
    name = "%s %s %d" % (rng.choice(ADJ), tname, rng.randint(2, 98))
    # lay rooms out in a row with slight jitter
    x = 0.0
    rooms, doors = [], []
    for r in rooms_t:
        w = round(rng.uniform(8, 16), 1)
        h = round(rng.uniform(8, 14), 1)
        rooms.append({"x": round(x, 1), "y": 0.0, "w": w, "h": h, "label": r})
        if x > 0:
            doors.append({"x": round(x, 1), "y": round(h / 2, 1)})
        x += w
    blurb = "%s sample layout: %s." % (tname.lower(), ", ".join(rooms_t))
    return {"id": "JAH-MAP-%06d" % idx, "name": name, "kind": "sample",
            "blurb": blurb, "rooms": rooms, "doors": doors}

def load_stats():
    if os.path.exists(STATS_JSON):
        return json.load(open(STATS_JSON))
    return {"next_index": 1, "total": 0}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300)
    ap.add_argument("--seed", type=int, default=34034)
    args = ap.parse_args()
    os.makedirs(DATA, exist_ok=True)
    stats = load_stats()
    maps = []
    if os.path.exists(MAPS_JSON):
        maps = json.load(open(MAPS_JSON)).get("maps", [])
    have = {m["id"] for m in maps}
    rng = random.Random(args.seed + stats["next_index"])
    added = 0
    for _ in range(args.n):
        idx = stats["next_index"]
        rec = gen_one(rng, idx)
        if rec["id"] in have:
            continue
        maps.append(rec)
        have.add(rec["id"])
        stats["next_index"] = idx + 1
        added += 1
    stats["total"] = len(maps)
    json.dump({"total": len(maps), "maps": maps}, open(MAPS_JSON, "w"))
    json.dump(stats, open(STATS_JSON, "w"), indent=1)
    print("MAPS: +%d samples, %d total (next %06d)" % (added, len(maps), stats["next_index"]))

if __name__ == "__main__":
    main()
