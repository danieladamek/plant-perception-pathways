#!/usr/bin/env python3
"""export_handoff.py — Plant Perception Pathways (Cowork tool, 2026-11-18).
Writes the PPE-shaped handoff from Cowork's curation rows: source/data/paths.csv, paths.json, tree.json, key.json.
citation_verified is computed from source/data/references.json (verify_refs.py), never typed.
Usage: python3 export_handoff.py   (run from the app folder)
"""
import csv, json, yaml
COLS = ["path_id", "perception_branch", "sense_leaf", "stimulus", "stimulus_origin", "transducer", "transducer_tier", "hypothesis_group",
        "cascade", "signal_route", "integration", "response", "response_role", "row_status", "provenance", "notes", "evidence_species",
        "key_citation", "citation_verified", "also_in"]
rows = yaml.safe_load(open("source/curation/paths.yaml", encoding="utf-8"))
refs = {r["id"]: r for r in json.load(open("source/data/references.json", encoding="utf-8"))["references"]}
out = []
about = [r for r in rows if r.get("row_status") == "about-page"]   # framing entries go to the About page, not the tree
rows = [r for r in rows if r.get("row_status") not in ("dropped", "about-page")]   # both stay in paths.yaml for the record
for r in rows:
    extra = set(r) - set(COLS)
    if extra: raise SystemExit(f"{r.get('path_id')}: unknown columns {sorted(extra)} (unquoted comma in a flow value?)")
    cites = r.get("key_citation") or []
    missing = [c for c in cites if c not in refs]
    if missing: raise SystemExit(f"{r['path_id']}: unknown reference {missing}")
    r = {c: r.get(c) for c in COLS} | {"row_status": r.get("row_status") or "candidate", "evidence_species": r.get("evidence_species") or "Arabidopsis thaliana"}
    r["citation_verified"] = "yes (abstracts)" if cites and all(refs[c]["verified"] for c in cites) else ("partly (abstracts)" if any(refs[c]["verified"] for c in cites) else "no")
    r["key_citation"] = cites
    out.append(r)
with open("source/data/paths.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=COLS); w.writeheader()
    for r in out: w.writerow({k: ("; ".join(v) if isinstance(v, list) else ("" if v is None else v)) for k, v in r.items()})
json.dump(out, open("source/data/paths.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
tree = {"name": "Plant perception", "children": []}
for r in out:
    b = next((c for c in tree["children"] if c["name"] == r["perception_branch"]), None)
    if not b: b = {"name": r["perception_branch"], "children": []}; tree["children"].append(b)
    l = next((c for c in b["children"] if c["name"] == r["sense_leaf"]), None)
    if not l: l = {"name": r["sense_leaf"], "path_ids": []}; b["children"].append(l)
    l["path_ids"].append(r["path_id"])
    for ob in r.get("also_in") or []:   # dual membership (⚑): listed under a second branch too, as PPE does
        b2 = next((c for c in tree["children"] if c["name"] == ob), None)
        if not b2: b2 = {"name": ob, "children": []}; tree["children"].append(b2)
        l2 = next((c for c in b2["children"] if c["name"] == r["sense_leaf"]), None)
        if not l2: l2 = {"name": r["sense_leaf"], "path_ids": [], "dual": True}; b2["children"].append(l2)
        l2["path_ids"].append(r["path_id"])
json.dump(about, open("source/data/about-framing.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
json.dump(tree, open("source/data/tree.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
key = [
 {"item": "What this is", "meaning": "Curation for Plant Perception Pathways, in the shape of PPE's Sheet export. Rows drafted by Cowork from verified abstracts and curated by Daniel (2026-11-18)."},
 {"item": "Stage columns", "meaning": "stimulus → receptor / transducer → cascade → signal route → integration → response."},
 {"item": "provenance codes", "meaning": "A = quoted or closely tracked from a verified abstract · K = curator knowledge, not verified against an abstract"},
 {"item": "transducer_tier", "meaning": "B1 established · B2 partial · B3 unknown or inferred; set in curation"},
 {"item": "row_status", "meaning": "curated = accepted in curation; only curated rows are shown as paths"},
 {"item": "⚑", "meaning": "a contested or partly supported mechanism, or dual membership (a path listed under two branches)"},
 {"item": "citation_verified", "meaning": "yes (abstracts) / partly (abstracts) / no: every, some or none of the row's key citations verified at abstract level"},
 {"item": "evidence_species", "meaning": "Arabidopsis thaliana unless stated. Senses Arabidopsis lacks, such as nodulation, come from other species and carry the 🌱 other-species badge."},
 {"item": "empty stage", "meaning": "a gap: no verified source supports this stage yet"},
]
json.dump(key, open("source/data/key.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"{len(out)} paths · {len(tree['children'])} branches · verified all: {sum(r['citation_verified']=='yes (abstracts)' for r in out)}")
