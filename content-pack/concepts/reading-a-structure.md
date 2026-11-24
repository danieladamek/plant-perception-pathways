---
id: reading-a-structure
title: Reading a molecular structure
one_liner: "A structure is a 3D model of a molecule, from an experiment deposited in the Protein Data Bank or from a prediction."
why_here: "Every molecule sheet opens a structure in the 3D viewer; this explains what you are looking at."
prerequisites: []
terms: [protein-data-bank, x-ray-crystallography, cryo-electron-microscopy, resolution, structure-coverage]
---

## What a structure is

<!-- framing -->
A structure is a set of atomic coordinates for a molecule or a complex of molecules. The app bundles each structure it shows as a coordinate file. Each record carries its source (a Protein Data Bank entry, an AlphaFold model, or a PubChem conformer), its method and its resolution, all copied from the source record.

## How structures are solved

<!-- framing -->
Experimental structures were solved by X-ray crystallography or cryo-electron microscopy. **Resolution**, in ångströms (Å), is how much detail the experiment resolved; a smaller number means finer detail. Some entries are not Arabidopsis proteins but their counterparts from other plants, and many show only part of a protein.

## Whole protein or one domain

<!-- framing -->
Plant receptors are often large, and an experiment may solve only one domain. The sheet shows the featured structure's **coverage**: "whole protein", or "domain structure" with the residues covered out of the protein's length. A domain structure shows that part faithfully and says nothing about the rest.

## How to use this in the app

<!-- framing -->
Open a molecule sheet and its featured structure. UVR8, the UV-B receptor, shows an experimental crystal structure; PHOT1 shows a structure of one domain of a much larger protein. Use Inspect to click parts and the info bar to read chains and ligands.
