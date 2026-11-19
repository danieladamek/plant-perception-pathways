#!/usr/bin/env python3
"""verify_refs.py — Plant Perception Pathways (Cowork tool, 2026-11-18).
Applies the PPE rule (app-methods §1.2): a reference is verified only when the OpenAlex record's title, normalised
(lower case; letters, digits and spaces only), matches the expected title with a difflib ratio ≥ 0.85. Writes the ratio
to `verified_how`. Abstracts stay attached only to verified records.
Extension (Cowork, 2026-11-18, for Daniel's approval): when the OpenAlex title fails (e.g. OpenAlex holds "FLS2" for a full
title), the Europe PMC title for the same DOI is compared with the same threshold, and `verified_via: europepmc` is recorded.
Usage: python3 verify_refs.py source/curation/expected-titles.yaml source/literature.json source/data/references.json
"""
import json, re, sys, difflib, html, time, urllib.request, urllib.parse
import yaml

def norm(t):
    t = html.unescape(re.sub(r"<[^>]+>", "", t or "")).lower()
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", t).split())

def epmc_title(doi):
    q = urllib.parse.urlencode({"query": f'DOI:"{doi}"', "format": "json", "pageSize": 1})
    with urllib.request.urlopen(f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?{q}", timeout=30) as r:
        res = json.load(r)["resultList"]["result"]
    time.sleep(4)
    return res[0].get("title") if res else None

ratio_of = lambda a, b: round(difflib.SequenceMatcher(None, norm(a), norm(b)).ratio(), 3)
exp = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
lit = json.load(open(sys.argv[2], encoding="utf-8"))
works = {w["id"]: w for w in lit["works"]}
out, bad = [], []
for rid, title in exp.items():
    w = works.get(rid)
    if not w: bad.append((rid, "not harvested")); continue
    ratio = ratio_of(title, w.get("title")); via = "openalex"; how = f"OpenAlex title vs expected title, normalised difflib ratio {ratio}"
    if w.get("found") and ratio < 0.85:
        et = epmc_title(w["doi"]); r2 = ratio_of(title, et) if et else 0.0
        how += f"; Europe PMC title for the DOI ratio {r2}"
        if r2 >= 0.85: ratio, via = r2, "europepmc"
    ok = bool(w.get("found")) and ratio >= 0.85
    rec = {"id": rid, "doi": w["doi"], "pmid": w.get("pmid"), "title": w.get("title"), "year": w.get("year"), "venue": w.get("venue"),
           "authors": w.get("authors"), "expected_title": title, "verified": ok, "verified_via": via if ok else None,
           "verified_how": f"{how} (threshold 0.85), {lit.get('retrieved')}"}
    if ok: rec.update(abstract=w.get("abstract"), abstract_source=w.get("abstract_source"), harvested_on=w.get("checked_on"))
    else: bad.append((rid, ratio))
    out.append(rec)
json.dump({"references": out}, open(sys.argv[3], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"{sum(r['verified'] for r in out)}/{len(out)} verified"); [print("NOT VERIFIED", *b) for b in bad]
for r in sorted(out, key=lambda r: float(r['verified_how'].split('ratio ')[-1].split()[0]))[:5]: print("lowest", r["id"], r["verified_how"].split('ratio ')[-1].split()[0], r["verified_via"])
