# k-generalsum: check the classification of the catalogue, and say what it means

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You may write one file: `P/general/catalogue-classes.md`. Everything else
under `P` and under `/home/user` is read-only.

Read first: `P/brief.md` (the proposal and its hypotheses), then
`P/prompts/k-general.md` (the classes, and what four classifiers were
asked), then the first 50 lines of the catalogue,
`/home/user/sdkgen/docs/design/model-dependent-text-issues.md`. The four
classifiers' tables are given below this file's text in your
instructions. They are claims.

## The job

1. **Blind sample.** Before you read the classifiers' rows, classify
   yourself, by the rules of `k-general.md`, every catalogue entry whose
   number ends in 2 or 8 (S02, S08, S12, ... X2, G02, G08, ... U102, U108,
   and so on in every section): about 66 entries. Decide from each entry's
   Where, Class and Fix, and from the source at the commit the catalogue
   was read against (`git -C /home/user/sdkgen show 9aebaf9e:<path>`).
   Then compare with the classifiers and list every disagreement, with
   what decides it. Give the agreement rate, and say which pairs of
   classes are confused with each other.

2. **Completeness.** The catalogue has 329 entries (a 330th heading, "The
   50 rated medium or low", is not an entry). Check that the four tables
   together have exactly one row for each, and name any missing or
   doubled id.

3. **The counts**, from the classifiers' tables corrected by your
   disagreements where you are sure you are right: per class and
   sub-class, per catalogue section, and per distinct defect (an entry
   whose Fate says it repeats another counts with the one it repeats).
   Then three numbers a maintainer needs, each as entries and as distinct
   defects, with the uncertainty your sample suggests:
   - how much of the catalogue the proposal's mechanism addresses at all
     (T and S), and how much of that the prototype tested (T);
   - how much is one edit today whatever is decided (O), and how much of
     that needs a derivation, which is the other half of the design
     (`docs/design/model-dependent-text.md`, "one answer per fact");
   - how much the proposal does nothing for (L, C, G, K, P), by class.

4. **The work packages.** The plan
   (`/home/user/sdkgen/docs/design/model-dependent-text-plan.md`, section
   4, and its appendix A, which gives every issue id its package) groups
   the issues into 46 work packages. For each package: how many of its
   issues fall in each class, and whether, if the proposal were adopted
   for every README family, the package would (a) disappear into "port
   that family", (b) shrink, or (c) stay as it is. Count the packages of
   each kind.

5. Write `P/general/catalogue-classes.md`: the full table (one row per
   entry: id, class, sub-class, where written, component, repeats, reason),
   the counts, the package table, and the disagreements. Plain technical
   English; no first person; no dash used as punctuation; name no AI
   model or tool; no path under a temporary directory.

## What you report

The agreement rate and every disagreement. Missing or doubled ids. The
counts and the three numbers, with their uncertainty. The package counts.
In five to ten plain sentences: does the proposal amount to a general
solution for this catalogue, a solution for part of it, or neither, and
what the rest needs. The path of the file. What you did not get to.
