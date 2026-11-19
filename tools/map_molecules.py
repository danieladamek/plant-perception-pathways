#!/usr/bin/env python3
"""map_molecules.py — Plant Perception Pathways: draft the curator mapping of molecule names in the curated rows to
harvested molecules (Cowork, 2026-11-19). Writes source/molecule-mapping.yaml for review; build_molecules.py reads it.
Match = the symbol or a listed alias as a whole word (case-insensitive unless the alias is case-marked) in a stage field."""
import json, re, yaml, glob
inv = json.load(open("source/structures-inventory.json"))["molecules"]
rows = [r for r in json.load(open("source/data/paths.json"))]
ALIAS = {  # symbol: extra written forms in the rows (curator aliases)
 "PHYA": ["phyA"], "PHYB": ["phyB", "phytochrome B", "phytochromes"], "CRY1": ["cryptochrome 1", "HY4", "CRY1/CRY2", "CRY1/2", "cryptochromes"], "CRY2": ["CRY1/CRY2", "CRY1/2", "cryptochromes"],
 "PHOT1": ["phot1", "NPH1", "PHOT1/PHOT2"], "PHOT2": ["phot2", "NPL1", "PHOT1/PHOT2"], "FER": ["FERONIA"], "SRK2E": ["OST1"],
 "DORN1": ["DORN1"], "GLR3.3": ["GLR3.3"], "GLR3.6": ["GLR3.6"], "GLR3.2": ["GLR3.2"], "TCH2": ["TCH genes"], "TCH3": ["TCH genes"],
 "PYR1": ["PYR/PYL"], "PYL9": ["PYR/PYL"], "ABI1": ["ABI1"], "PIF3": [], "PIF4": ["PIF4"], "PIF5": ["PIF5"], "PIF7": ["PIF7"],
 "BCA1": ["βCA1", "CA1"], "BCA4": ["βCA4", "CA4"], "HTA9": ["H2A.Z"], "NRT1.1": ["NRT1.1", "CHL1", "NPF6.3"], "CPK10": ["CPK10"],
 "RAP2-12": ["RAP2.12"], "PCO1": ["PCOs", "plant cysteine oxidases"], "PCO2": ["PCOs", "plant cysteine oxidases"],
 "CEPR1": ["CEPRs"], "CEP1": ["CEP peptides"], "SYMRK": ["SYMRK"], "DMI3": ["DMI3", "CCaMK"], "CNGC15A": ["CNGC15"], "DMI1": ["DMI1"],
 "NFR5": ["NFR5"], "LECRK18": ["LecRK-I.8"], "MOCA1": ["MOCA1"], "SOS2": ["SOS2"], "SOS3": ["SOS3"], "SOS1": ["SOS1"],
 "LAZY1": ["LZY"], "LAZY2": ["LZY"], "LAZY4": ["LZY3", "LZY"], "PGMP": ["pgm"], "PRK6": ["PRK6"], "MDIS1": ["MDIS1"], "MIK1": ["MIK1"],
 "LURE1.2": ["LURE1"], "KAI2": ["KAI2"], "MAX2": ["MAX2"], "D14": ["D14"], "NPR1": ["NPR1"], "NPR3": ["NPR3"], "NPR4": ["NPR4"],
 "ICS1": ["isochorismate synthase", "ICS1", "SID2"], "FMO1": ["FMO1"], "RIN4": ["RIN4"], "RPM1": ["RPM1"], "RPS2": ["RPS2"], "ZAR1": ["ZAR1"],
 "RKS1": ["RKS1"], "PBL2": ["PBL2"], "TAA1": ["TAA1"], "GI": ["GI", "GIGANTEA"], "ZTL": ["ZTL"], "FKF1": ["FKF1"], "TOC1": ["TOC1"],
 "CCA1": ["CCA1"], "LHY": ["LHY"], "ELF3": ["ELF3"], "ELF4": ["ELF4"], "LUX": ["LUX"], "EIN2": ["EIN2"], "EIN3": ["EIN3"], "CTR1": ["CTR1"],
 "ETR1": ["ETR1"], "HT1": ["HT1"], "MPK12": ["MPK12"], "GHR1": ["GHR1"], "EPF2": ["EPF2"], "CRSP": ["CRSP"], "HIC": ["HIC"],
 "ICE1": ["ICE1"], "CBF1": ["CBF1", "CBF"], "VIN3": ["VIN3"], "FLC": ["FLC"], "CNGC2": ["CNGC2"], "MIZ1": ["MIZ1"], "CLE25": ["CLE25"],
 "SLAC1": ["SLAC1"], "MSL10": ["MSL10"], "MSL8": ["MSL8"], "MSL9": [], "MCA1": ["MCA1"], "MCA2": ["MCA2"], "OSCA1": ["OSCA1"], "OSCA1.2": [],
 "FLS2": ["FLS2"], "BAK1": ["BAK1"], "EFR": ["EFR"], "CERK1": ["CERK1"], "BIK1": ["BIK1"], "RBOHD": ["RBOHD", "RbohD"], "MPK3": ["MPK3"], "MPK6": ["MPK6"],
 "PEPR1": ["PEPR1"], "PEPR2": ["PEPR2"], "PROPEP1": ["PROPEP1"], "HPCA1": ["HPCA1"], "UVR8": ["UVR8"], "COP1": ["COP1"], "HY5": ["HY5"],
 "NPH3": ["NPH3"], "COI1": ["COI1"], "JAZ1": ["JAZ1", "JAZ"], "MYC2": ["MYC2"], "SPX1": ["SPX1", "SPX domains"], "PHR1": ["PHR1"], "LPR1": ["LPR1"],
 "FIT": ["FIT1", "FIT"], "BTS": ["BTS", "BRUTUS"], "PHYC": [], "PHYD": [], "PHYE": [], "ERS1": [], "PCO1": ["PCOs"], "MPK12": ["MPK12"],
}
STAGE_F = {"hypothesis_group": "notes", "transducer": "receptor", "cascade": "cascade", "signal_route": "signal_route", "integration": "integration", "response": "response", "stimulus": "stimulus"}
out, unmatched = {}, []
for sym in inv:
    pats = [sym] + ALIAS.get(sym, [])
    hits = {}
    for r in rows:
        if r.get("row_status") != "curated": continue
        for f, st in STAGE_F.items():
            t = r.get(f) or ""
            for a in pats:
                if re.search(r"(?<![\w.-])" + re.escape(a) + r"(?![\w])", t, 0 if any(c.islower() for c in a[1:]) else re.I):
                    hits.setdefault(r["path_id"], set()).add(st); break
    if hits:
        out[sym] = {"paths": {p: sorted(s) for p, s in sorted(hits.items())}, "aliases_used": pats[1:]}
    else: unmatched.append(sym)
out.setdefault("OSCA1.2", {"paths": {"PX02": ["receptor"]}, "aliases_used": [], "mapping": "family member of OSCA1; kept as a molecule sheet linked from PX02 (Daniel, 2026-11-18, PT07)"}); unmatched = [u for u in unmatched if u != "OSCA1.2"]
for k in ("LAZY1", "LAZY2", "LAZY4"):
    if k in out: out[k]["mapping"] = "LZY family named in PG01; the papers' LZY1/2/3 numbering is not yet matched to UniProt LAZY1/2/4 (todo)"
yaml.safe_dump({"mapping": out, "unmatched": unmatched}, open("source/molecule-mapping.yaml", "w"), allow_unicode=True, sort_keys=False, width=140)
for s, v in out.items(): print(f"{s:8s}", " ".join(f"{p}:{'/'.join(x[:3] for x in st)}" for p, st in v["paths"].items()))
print("UNMATCHED", unmatched)
