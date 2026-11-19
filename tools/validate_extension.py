#!/usr/bin/env python3
"""validate_extension.py — Plant Perception Pathways: checks this app's extension files (app-methods.md). Run after
validate_pack.py. Adapted from PPE's (Cowork, 2026-11-19): the path fields come from manifest.stage_kinds; no atlas,
percepts or proposed routes; anatomy ids are Plant Ontology (PO:nnnnnnn).
Usage: python3 tools/validate_extension.py content-pack   → exit 1 on any error. Needs PyYAML."""
import sys, os, re, yaml, hashlib
root = sys.argv[1] if len(sys.argv) > 1 else "content-pack"
E, W = [], []
L = lambda f: yaml.safe_load(open(os.path.join(root, f), encoding="utf-8"))
man = L("manifest.yaml")
for f in man.get("extensions", []):
    if not os.path.exists(os.path.join(root, f)): E.append(f"manifest.extensions: {f} missing")
SK = man.get("stage_kinds") or []
if man.get("core_schema") != "0.2": E.append("manifest: core_schema 0.2 expected")
STAGES = [s["id"] for s in SK]
WITH = [w["id"] for s in SK for w in s.get("with") or []]
MOLSTAGE = [s["id"] for s in SK if "molecules" in (s.get("roles") or [])]
ANATSTAGES = {s["id"] for s in SK if "anatomy" in (s.get("roles") or [])}
if len(MOLSTAGE) != 1: E.append(f"manifest: exactly one stage with role molecules expected, found {MOLSTAGE}")
paths = L("paths.yaml")["paths"]; PIDS = {p["path_id"] for p in paths}
refs = L("references.yaml"); RN = {r["n"]: r for r in refs}
FIELDS = ["path_id", "perception_branch", "sense_leaf", "stimulus_origin", "transducer_tier", "hypothesis_group", "row_status", "provenance",
          "notes", "evidence_species", "key_citation", "citation_verified"] + STAGES + WITH
for p in paths:
    for k in FIELDS:
        if k not in p: E.append(f"paths/{p.get('path_id')}: missing field {k}")
    if p.get("transducer_tier") not in ("B1", "B2", "B3"): E.append(f"paths/{p['path_id']}: bad tier")
    if p.get("row_status") != "curated": E.append(f"paths/{p['path_id']}: row_status {p.get('row_status')!r} (only curated rows ship)")
    if not p.get("refs"): E.append(f"paths/{p['path_id']}: no reference")
    for n in p.get("refs", []):
        if n not in RN: E.append(f"paths/{p['path_id']}: ref {n} not found")
        elif not RN[n].get("verified"): E.append(f"paths/{p['path_id']}: ref {n} not verified")
    if p.get("provenance") == "A" and not all(RN.get(n, {}).get("abstract") for n in p.get("refs", [])):
        W.append(f"paths/{p['path_id']}: provenance A but a cited reference has no abstract")
def tree_ids(n):
    for c in n.get("children", []): yield from tree_ids(c)
    yield from n.get("path_ids", [])
T = set(tree_ids(L("hierarchy.yaml")["tree"]))
for i in PIDS - T: E.append(f"hierarchy: {i} not in the tree")
for i in T - PIDS: E.append(f"hierarchy: {i} is not a path")
hubs = L("hubs.yaml")
if not hubs.get("caution"): E.append("hubs: caution text missing")
mols = L("molecules.yaml")["molecules"]; MIDS = {m["id"] for m in mols}
for h in hubs["hubs"]:
    if h["molecule"] not in MIDS: E.append(f"hubs/{h['molecule']}: not a molecule")
    for i in h["path_ids"]:
        if i not in PIDS: E.append(f"hubs/{h['molecule']}: {i} not found")
for m in mols:
    if m.get("stage") not in STAGES + ["stimulus", "notes"]: E.append(f"molecules/{m['id']}: stage {m.get('stage')!r} is not a stage kind")
    if "curator mapping" not in (m.get("mapping") or ""): E.append(f"molecules/{m['id']}: mapping must be labelled a curator mapping")
    for i in m["paths"]:
        if i not in PIDS: E.append(f"molecules/{m['id']}: path {i} not found")
    u = m.get("uniprot") or {}
    if not (u.get("source") and u.get("retrieved_on")): E.append(f"molecules/{m['id']}: UniProt record without source/date")
    if u and not u.get("reviewed"): W.append(f"molecules/{m['id']}: UniProt record is unreviewed ({u.get('organism')})")
SIDS = set()
for s in L("structures.yaml")["structures"]:
    SIDS.add(s["id"])
    for mm in s["molecules"]:
        if mm not in MIDS: E.append(f"structures/{s['id']}: molecule {mm} not found")
    f = os.path.join(root, s["file"])
    if not os.path.exists(f): E.append(f"structures/{s['id']}: file {s['file']} not bundled")
    elif s.get("sha256") != hashlib.sha256(open(f, "rb").read()).hexdigest(): E.append(f"structures/{s['id']}: sha256 mismatch")
    if s["source_db"] == "AlphaFoldDB" and s.get("kind") != "predicted": E.append(f"structures/{s['id']}: AlphaFold model must be kind predicted")
for m in mols:
    if m.get("featured") and m["featured"]["id"] not in SIDS: E.append(f"molecules/{m['id']}: featured {m['featured']['id']} not bundled")
CITE = re.compile(r"\[(\d+(?:\s*[,–-]\s*\d+)*)\]")
for x in L("interactions.yaml").get("interactions", []):
    nums = {int(n) for g in CITE.findall(x.get("role", "")) for n in re.split(r"\s*[,–-]\s*", g)}
    if not nums: E.append(f"interactions/{x['id']}: role statement is not cited")
smd = L("small-molecules.yaml")
for g in smd["molecules"]:
    if not (g.get("pubchem") or {}).get("source"): E.append(f"small-molecules/{g['id']}: PubChem source missing")
    for f_ in g["forms"]:
        if f_.get("file"):
            fp = os.path.join(root, f_["file"])
            if not os.path.exists(fp): E.append(f"small-molecules/{g['id']}: file {f_['file']} not bundled")
            elif hashlib.sha256(open(fp, "rb").read()).hexdigest() != f_["sha256"]: E.append(f"small-molecules/{g['id']}: sha256 mismatch")
    for b in g["bound_in"]:
        if b["structure"] not in SIDS: E.append(f"small-molecules/{g['id']}: bound_in {b['structure']} not bundled")
    for i in g["paths"]:
        if i not in PIDS: E.append(f"small-molecules/{g['id']}: path {i} not found")
for x in smd.get("not_found", []): W.append(f"small-molecules: {x['id']} not found in PubChem")
txt = open(os.path.join(root, "context-note.md"), encoding="utf-8").read()
for bad in ("Cowork", "sensablegraph", "BPH-", "Update Log", "todo"):
    if bad in txt: E.append(f"context-note: internal term {bad!r}")
for n in {int(x) for g in CITE.findall(txt) for x in re.split(r"\s*[,–-]\s*", g)}:
    if not RN.get(n, {}).get("verified"): E.append(f"context-note: [{n}] is not a verified reference")
_vals = {(st, p[st]) for p in paths for st in ANATSTAGES if p.get(st)}
for v in L("anatomy.yaml")["values"]:
    if v["stage"] not in ANATSTAGES: E.append(f"anatomy: stage {v['stage']} has no anatomy role")
    if (v["stage"], v["value"]) not in _vals: E.append(f"anatomy: {v['stage']} '{v['value'][:40]}' is not a curated stage value")
    for t in v["terms"]:
        if t.get("id") is None: continue
        if not re.fullmatch(r"PO:\d{7}", t["id"]): E.append(f"anatomy: bad ontology id {t['id']}")
        if not (t.get("label") and t.get("source") and t.get("retrieved_on")): E.append(f"anatomy/{t['id']}: label, source and retrieved_on required")
        if "curator mapping" not in (t.get("mapping") or ""): E.append(f"anatomy/{t['id']}: must be labelled a curator mapping")
print(f"validate_extension · paths {len(paths)} · molecules {len(mols)} · structures {len(SIDS)} · small molecules {len(smd['molecules'])}")
for w in W: print("  WARN ", w)
for e in E: print("  ERROR", e)
print(f"{len(E)} error(s), {len(W)} warning(s)"); sys.exit(1 if E else 0)
