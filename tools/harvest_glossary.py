#!/usr/bin/env python3
"""harvest_glossary.py — Plant Perception Pathways (Cowork, 2026-11-24). Fetches the full OLS4 record for every id in
source/glossary/picks.yaml (GO, ChEBI, PO, ...) and writes notes/research/glossary-harvest.json: label, definition(s),
synonyms, obsolete flag, IRI, source URL, retrieval date. Copied from the records; nothing typed. Sequential, 4 s apart.
Resumes: ids already in the output are kept; delete the file to re-harvest.  Usage (app folder): python3 tools/harvest_glossary.py"""
import json, os, time, datetime, urllib.parse, urllib.request, yaml
OLS = "https://www.ebi.ac.uk/ols4/api"; OUT = "notes/research/glossary-harvest.json"; TODAY = datetime.date.today().isoformat()
P = yaml.safe_load(open("source/glossary/picks.yaml", encoding="utf-8"))
H = json.load(open(OUT)) if os.path.exists(OUT) else {}
for term, oid in P.items():
    if not isinstance(oid, str) or oid in H: continue
    pre = oid.split(":")[0].lower(); iri = f"http://purl.obolibrary.org/obo/{oid.replace(':', '_')}"
    url = f"{OLS}/ontologies/{pre}/terms/{urllib.parse.quote(urllib.parse.quote(iri, safe=''), safe='')}"
    time.sleep(4)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "actualizer-harvest/0.1"}), timeout=60) as r: d = json.load(r)
    except Exception as e:
        print("!", oid, e); H[oid] = {"id": oid, "found": False}; continue
    defs = d.get("description") or []
    H[oid] = {"id": oid, "found": True, "label": d.get("label"), "definitions": defs, "definition": defs[0] if defs else None,
              "synonyms": d.get("synonyms") or [], "obsolete": bool(d.get("is_obsolete")), "iri": iri,
              "source": f"https://www.ebi.ac.uk/ols4/ontologies/{pre}/classes/{urllib.parse.quote(urllib.parse.quote(iri, safe=''), safe='')}",
              "retrieved_on": TODAY}
    print(oid, d.get("label"), "|", (defs[0] if defs else "NO DEFINITION")[:90], flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True); json.dump(H, open(OUT, "w"), indent=1, ensure_ascii=False)
print(len(H), "records")
