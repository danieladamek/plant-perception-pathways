---
id: experimental-vs-predicted
title: Experimental and predicted structures
one_liner: "Some structures were measured; others were computed. The app always tells you which."
why_here: "Molecules without a suitable experimental structure show an AlphaFold model or a PubChem conformer instead, styled differently so they are never mistaken for measured data."
prerequisites: [reading-a-structure]
terms: [predicted-model, protein-data-bank, structure-coverage]
---

## Three kinds of 3D model

<!-- framing -->
The app shows three kinds of 3D model. **Experimental** structures come from the Protein Data Bank and carry a method and a resolution. **Predicted** protein models come from the AlphaFold Protein Structure Database: they are computed, not measured. **Computed conformers** of small molecules such as hormones come from PubChem: one computed 3D arrangement of the molecule's atoms.

## How the app chooses and labels them

<!-- framing -->
For each molecule, the app features an experimental structure when the PDB has one of the molecule itself or of its counterpart in another plant. It prefers Arabidopsis, then Medicago, then Lotus, then any organism, then the best resolution, then the newest entry. It skips entries that hold only a peptide, a fusion or an engineered tag. When no suitable entry exists, it features the AlphaFold model. Curators may override the choice, with a reason: RIN4 and JAZ1, for example, feature their predicted models, because their experimental entries hold only short fragments.

## Why it matters

<!-- framing -->
A measured structure shows a real arrangement captured in one state, construct and organism; a computed model is a prediction. When you read a structure, check its badge first: experimental with its method and resolution, or predicted.

## How to use this in the app

<!-- framing -->
Of the 116 featured structures, 50 are experimental and 66 are AlphaFold models. On any molecule sheet, the badge says which, and the coverage says how much of the protein is shown.
