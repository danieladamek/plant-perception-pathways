#!/usr/bin/env python3
"""build_molecules.py — Plant Perception Pathways: molecules.yaml, structures.yaml, hubs.yaml from the structure harvest
and the curator mapping (source/molecule-mapping.yaml). Cowork-side tool (Actualizer, 2026-11-19), adapted from PPE's
tools/build_molecules.py. Deterministic. Usage (app folder): python3 tools/build_molecules.py
Plant changes (app-methods §4): no HGNC; identity is the reviewed UniProt record and its AGI locus; gene-name matches
are kept only from plant_taxa; featured structure order is Arabidopsis thaliana → other listed plants → any organism.
Every molecule carries `stage` explicitly (receptor | cascade | signal_route | integration | response | notes)."""
import json, os, re, hashlib, yaml, collections
CP = "content-pack"
inv = json.load(open("source/structures-inventory.json", encoding="utf-8"))
mp = yaml.safe_load(open("source/molecule-mapping.yaml", encoding="utf-8"))["mapping"]
cur = yaml.safe_load(open(f"{CP}/structure-curation.yaml", encoding="utf-8"))
paths = {p["path_id"]: p for p in yaml.safe_load(open(f"{CP}/paths.yaml", encoding="utf-8"))["paths"]}
E = inv["entries"]; TAXA = list(cur["plant_taxa"]); EXCL = set(cur["excluded_components"])
ORDER = {o: i for i, o in enumerate(TAXA)}
ELEN = json.load(open("source/entity-lengths.json", encoding="utf-8"))["lengths"] if os.path.exists("source/entity-lengths.json") else {}
STAGE_ORDER = ["receptor", "cascade", "signal_route", "integration", "response", "stimulus", "notes"]

def entities(e):
    for pe in e.get("polymer_entities") or []:
        orgs = [o.get("scientific_name") for o in pe.get("rcsb_entity_source_organism") or []]
        genes = [g.get("value", "") for o in pe.get("rcsb_entity_source_organism") or [] for g in (o.get("rcsb_gene_name") or [])]
        accs = [r.get("database_accession") for r in ((pe.get("rcsb_polymer_entity_container_identifiers") or {}).get("reference_sequence_identifiers") or []) if r.get("database_name") == "UniProt"]
        yield {"entity": pe.get("rcsb_id"), "description": (pe.get("rcsb_polymer_entity") or {}).get("pdbx_description"),
               "chains": ((pe.get("entity_poly") or {}).get("pdbx_strand_id") or "").split(","), "organisms": orgs, "genes": genes, "uniprot": accs}

def own_entity(e, sym, acc):
    for en in entities(e):
        if acc and acc in en["uniprot"]: return en, "accession"
    for en in entities(e):
        if sym and any(g.upper() == sym.upper() for g in en["genes"]) and any(o in TAXA for o in en["organisms"]): return en, "gene name"
    return None, None

FRAGMENT = re.compile(r"\b(motif|peptide|octapeptide|degron|miniSOG|iLOV)\b", re.I)
res = lambda e: min((e.get("rcsb_entry_info") or {}).get("resolution_combined") or [99])

def entry_record(pid, e, en, how):
    cit = e.get("rcsb_primary_citation") or {}
    ligs = [{"id": n["nonpolymer_comp"]["chem_comp"]["id"], "name": n["nonpolymer_comp"]["chem_comp"].get("name")}
            for n in e.get("nonpolymer_entities") or [] if n.get("nonpolymer_comp")]
    org = next((o for o in TAXA if o in en["organisms"]), (en["organisms"] or [None])[0])
    return {"id": pid, "title": (e.get("struct") or {}).get("title"), "method": (e.get("exptl") or [{}])[0].get("method"),
            "resolution_A": None if res(e) == 99 else res(e), "released": (e.get("rcsb_accession_info") or {}).get("initial_release_date", "")[:10],
            "organism": org, "matched_by": how, "entities": [{k: v for k, v in x.items() if k != "genes"} for x in entities(e)],
            "ligands": ligs, "citation": {"title": cit.get("title"), "year": cit.get("year"), "journal": cit.get("journal_abbrev"),
            "doi": cit.get("pdbx_database_id_DOI"), "pmid": cit.get("pdbx_database_id_PubMed")},
            "source": e.get("source"), "retrieved_on": e.get("retrieved_on")}

molecules, structures, excluded = [], [], collections.Counter()
for key in sorted(mp, key=lambda k: (min(mp[k]["paths"]), k)):
    m, rec = mp[key], inv["molecules"].get(key) or {}
    u = rec.get("uniprot") or {}
    stages = {s for st in m["paths"].values() for s in st}
    stage = next(s for s in STAGE_ORDER if s in stages)
    pids = sorted(p for p, st in m["paths"].items() if stage in st)          # the paths where it is named at its own stage
    other_mentions = {p: sorted(st) for p, st in sorted(m["paths"].items()) if stage not in st}
    forms = m.get("aliases_used") or []
    out = {"id": key, "kind": "protein", "stage": stage, "paths": pids,
           "as_written": "; ".join(dict.fromkeys(t for p in pids for t in [paths[p].get(stage if stage != "notes" else "hypothesis_group") or ""] if t))[:400],
           "mapping": "curator mapping: " + (m.get("mapping") or (f"named in the {stage.replace('_', ' ')} text" + (f" as {', '.join(forms)}" if forms else "")))}
    if other_mentions: out["also_named_in"] = other_mentions                 # shown on the sheet, never drawn as a node
    if rec.get("seed", {}).get("note"): out["seed_note"] = rec["seed"]["note"]
    if u:
        out["uniprot"] = {k: u.get(k) for k in ("accession", "entry_name", "protein_name", "gene_names", "ordered_locus_names", "organism", "taxon_id",
                                               "reviewed", "length", "function", "subcellular_location", "source", "retrieved_on", "licence")}
    acc = u.get("accession")
    listed = []
    for pid in list(dict.fromkeys(rec.get("pdb_entries", []) + cur["include_entries"].get(key, []))):
        e = E.get(pid)
        if not e or pid in cur["exclude_entries"].get(key, {}): continue
        en, how = own_entity(e, key, acc)
        if en and how == "gene name" and acc and en["uniprot"] and acc not in en["uniprot"]:   # namesake: same gene name, other protein
            excluded[(key, "namesake " + ",".join(en["uniprot"]))] += 1; continue
        if en and FRAGMENT.search((e.get("struct") or {}).get("title") or ""):                 # motif / peptide / engineered-protein entries
            en = dict(en, fragment=True)
        if not en:
            for x in entities(e):
                for o in x["organisms"]:
                    if o not in TAXA: excluded[(key, o)] += 1
            continue
        listed.append(entry_record(pid, e, en, how))
    listed.sort(key=lambda r: r["released"], reverse=True)
    for r in listed: r["fragment"] = bool(FRAGMENT.search(r["title"] or ""))
    out["pdb_entries"], out["pdb_found"] = listed, rec.get("pdb_total")
    af = rec.get("alphafold") or []
    out["alphafold"] = af
    feat, why = None, None
    if key in cur["featured"]:
        feat = next((r for r in listed if r["id"] == cur["featured"][key]["id"]), None); why = "curator: " + cur["featured"][key]["reason"]
    pool = [r for r in listed if not r["fragment"] and not any(("peptide" in (x["description"] or "").lower() or "," in (x["description"] or ""))
                                           for x in r["entities"] if acc and acc in x["uniprot"])]
    prefer_af = key in (cur.get("prefer_predicted") or {})
    if not feat and pool and not prefer_af:
        feat = sorted(pool, key=lambda r: (ORDER.get(r["organism"], len(TAXA)), r["resolution_A"] or 99, [-int(x) for x in r["released"].split("-") if x]))[0]
        why = f"rule §4.3: {feat['organism']}, {feat['resolution_A']} Å, released {feat['released']}"
    if feat:
        cl = max([ELEN.get(x["entity"], 0) for x in feat["entities"] if acc in x["uniprot"]] or [0])
        out["featured"] = {"id": feat["id"], "source_db": "PDB", "why": why}
        if cl and u.get("length"):
            out["featured"]["chain_length"], out["featured"]["uniprot_length"] = cl, u["length"]
            out["featured"]["coverage"] = "whole protein" if cl >= 0.9 * u["length"] else f"domain structure ({cl} of {u['length']} residues)"
        structures.append({"id": feat["id"], "molecule": key, "source_db": "PDB", "featured": True, "kind": "experimental",
                           "organism": feat["organism"], "file": f"structures/{feat['id']}.bcif", "reason": why})
    elif af:
        a = af[0]; url = a.get("bcifUrl") or a.get("cifUrl")
        why_af = ("curator: " + cur["prefer_predicted"][key]) if prefer_af else ("rule §4.3: no whole-protein PDB entry (only fragments or motif peptides); predicted model" if listed else "rule §4.3: no PDB entry; predicted model")
        out["featured"] = {"id": a["entryId"], "source_db": "AlphaFoldDB", "why": why_af}
        structures.append({"id": a["entryId"], "molecule": key, "source_db": "AlphaFoldDB", "featured": True, "kind": "predicted",
                           "organism": u.get("organism"), "file_url": url, "file": "structures/" + os.path.basename(url or ""),
                           "plddt_mean": a.get("globalMetricValue"), "version": a.get("latestVersion"), "reason": why_af})
    else:
        out["featured"] = None
    molecules.append(out)

merged = {}
for s in structures:
    k = s.pop("molecule")
    if s["id"] in merged: merged[s["id"]]["molecules"].append(k); continue
    merged[s["id"]] = {"id": s["id"], "molecules": [k], **{x: y for x, y in s.items() if x != "id"}}
structures = list(merged.values())
for s in structures:
    p = os.path.join(CP, s["file"])
    s["sha256"] = hashlib.sha256(open(p, "rb").read()).hexdigest() if os.path.exists(p) else None

# hubs: molecules on the receptor stage of more than one path (shared hardware; counts are not centrality)
hubs = [{"molecule": m["id"], "path_ids": m["paths"]} for m in molecules if m["stage"] == "receptor" and len(m["paths"]) > 1]
def dump(name, data, hdr):
    with open(os.path.join(CP, name), "w", encoding="utf-8") as f:
        f.write(hdr + "\n"); yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False, width=110)
dump("molecules.yaml", {"molecules": molecules}, "# molecules.yaml — molecule sheets, generated by tools/build_molecules.py from the structure harvest (taxon 3702 first)\n# and source/molecule-mapping.yaml (curator mapping). Database text is verbatim with source and date. Do not edit: re-run.")
dump("structures.yaml", {"structures": structures}, "# structures.yaml — the coordinate files bundled with the app (featured structures), with sha256.\n# sha256: null = not downloaded yet (tools/harvest_structures.py download).")
dump("hubs.yaml", {"caution": "Counts of paths per molecule are NOT centrality. Well-studied receptors (phyB, FERONIA) accrue rows by study volume. "
                   "Any hub claim needs a study-intensity-controlled comparison. Matching is on the receptor stage only.", "hubs": hubs},
     "# hubs.yaml — shared hardware: molecules on the receptor stage of more than one path.")
dump("interactions.yaml", {"interactions": []}, "# interactions.yaml — curated key interactions. Empty in pack 0.1: an interaction sweep is a later item (todo).")
os.makedirs("notes/research", exist_ok=True)
with open("notes/research/excluded-organisms.md", "w", encoding="utf-8") as f:
    f.write("# PDB entities excluded by the plant-taxa rule (gene-name namesakes)\n\n" + "".join(f"- {k} · {o} · {n}\n" for (k, o), n in sorted(excluded.items(), key=lambda kv: (kv[0][0], str(kv[0][1])))))
print(f"molecules {len(molecules)} · stages {dict(collections.Counter(m['stage'] for m in molecules))} · structures {dict(collections.Counter(s['kind'] for s in structures))} · "
      f"hubs {len(hubs)} · excluded namesake hits {sum(excluded.values())}")
