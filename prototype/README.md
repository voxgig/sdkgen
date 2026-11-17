# The write-once documentation prototype

This branch keeps the prototype that
`docs/design/model-dependent-text-prototype.md` reports on: its code, its
review tools and its working records, so that every commit the record and
its reports cite still resolves. The record, its verdict and the
classification of the 329 catalogue entries
(`docs/design/model-dependent-text-classes.md`) are on the branch
`claude/cool-volta-wm2jcm`, in voxgig/sdkgen pull request 492.

The branch is a record, not a change proposed for `main`. Two things follow
from that.

- Its source does not meet this repository's comment policy. The comment
  gate reports 87 findings in 53 files: 32 in `ts/src`, 30 in `ts/test`, 24
  in the components and 1 in the model. The record does not count them;
  an adoption would have to bring those comments to the policy.
- No tag was pushed. A pushed `v*` tag starts this repository's publish
  workflow, and the prototype named its freezes with tags such as
  `v34-frozen`. The tables below give each name's commit.

## What is where

| Where | What |
| --- | --- |
| The tree outside `prototype/` | The integrated state at twenty languages and interface 3.4, exactly as frozen (`v34-frozen`, 89387a4f9b), on release 4.44.0 (9aebaf9e) |
| `prototype/tools/` | The review tools as frozen (`v34-frozen-tools`, e55846ed32). Their own `README.md` gives the commands; `portcheck.sh` is the one command per language |
| `prototype/records/` | The briefs, prompts, guides, reports and logs, listed below |

Three commits sit on top of `v34-frozen`:

1. A subtree merge that adds `prototype/tools/`. Its other parents are the
   tools' own history and every other tools history the reports cite.
2. A merge that changes no file. Its other parents are the sdkgen histories
   the reports cite and `v34-frozen` does not contain, kept reachable from
   this one branch.
3. The commit that adds `prototype/records/` and this file.

## Named states

The sdkgen states, oldest first:

| Name | Commit | What it is |
| --- | --- | --- |
| `v3-frozen` | 8d5ad97b15 | interface 3, frozen before the remaining ports |
| `v31-frozen` | 9089ed4896 | interface 3.1 |
| `v32-frozen` | 3d58cb46ff | interface 3.2 |
| `v33a`, `v33m`, `v33p`, `v33s` | 21397ef980, cda43a5962, cd8196db46, e84d35250f | intermediate states of the 3.3 merge, as the reports name them |
| `v33-frozen` | 0065f1e2b0 | interface 3.3, the base of the last seven ports |
| `port-cpp`, `port-csharp`, `port-java`, `port-js`, `port-kotlin`, `port-php`, `port-scala` | 229312e7e6, dc77891428, 87c3f5f3a6, 9c85bcdb28, 3179dc04e9, 06180373fc, 5b8a6d33a7 | the last seven ports, each as reviewed and fixed, before the integration |
| `h3fix` | f5a4466062 | the seven catalogue issues fixed by shared edits |
| `h5fix` | d36954fcf1 | the migration structures H5 needed |
| `mig/head`, `today`, `h5fix-loud` | c193a60318, 37d085a44e, 909088f7e7 | the H5 round's working branches; `h5fix-loud` is an experiment that was built and whose suite was not run |
| `v34-frozen` | 89387a4f9b | twenty languages, interface 3.4: this branch's tree |

The tools states:

| Name | Commit | What it is |
| --- | --- | --- |
| `v33-frozen-tools` | d3b258d62f | the tools at the 3.3 freeze |
| `base33` | a3fd3b87b4 | the tools the last seven ports started from |
| `port-cpp`, `port-csharp`, `port-java`, `port-js`, `port-kotlin`, `port-php`, `port-scala` | fcbd22a8f8, 97783f2be6, 5104f9500a, d373e62bc0, 3a40b33387, f010878992, 490e54ae8f | each port's hand records and review fixes |
| `h3fix-tools` | 72b2a64c34 | the tools after the H3 shared edits |
| `v34-frozen-tools` | e55846ed32 | the tools at the 3.4 freeze: `prototype/tools/` |

The reports also cite commits that no branch or tag of the prototype held.
Each is kept as a parent of one of the two merges: in sdkgen 1de5407f05,
41a6df870d, 68c1b1c8f7, 9f18355983, dc6dc84482 and 7f3fc9c368 (the plan
commit, also on the pull request's branch), and in the tools 225a0decbb,
740dc90d2f and d6eabfcc6b.

## The records

`P` in every prompt and report is the scratch directory the prototype ran
in, which no longer exists. `P/v34/sdkgen` is this branch's tree at
89387a4f9b and `P/v34/tools` is `prototype/tools/`. Every other `P/<path>`
that was kept is `prototype/records/<path>`.

| Path under `prototype/records/` | What it holds |
| --- | --- |
| `brief.md` to `brief7.md`, `stage1.md`, `stage2-worklists.md` | The proposal and the five hypotheses with what would refute each, fixed before anything was built, then each later round's brief |
| `prompts/` | What each stage was asked, one file per stage, most of them prefixed by their round (`h-` to `k-`) |
| `results/` | Each stage's report, as JSON and as the same content in text |
| `base32/`, `v32/`, `v33g/`, `base33/` | The porting guides for 3.2 and 3.3, their runtime tables, the prompts each port, review, fix and verification ran from, and the base measures (`harness/`) |
| `h-guard/`, `i-guard/` | The runtime tables of the guard rounds, and their mutation sets with outcomes (`work/`) |
| `v33/`, `v33b/` | The 3.3 merge's logs, the sentence tables, and the mutation sets of its attack (`v33/mine/`) |
| `sentences/` | The independent reading of the 297 shared sentences: each reader's verdicts and the merged result |
| `survey/` | Per-language notes on how the existing pages and runtimes behave |
| `record/`, `record2/`, `record3/` | Each independent check of the record (`CHECK.md`), and the scripts that built the final record's tables (`record3/tools/`) |
| `general/catalogue-classes.md` | The 329 catalogue entries by class |
| `refanatomy/`, `restanatomy/` | The analyses of the existing pages behind the design |
| `PROGRESS.md` and `*.log` in each round's directory | Progress notes and run logs |

Left out: generated output (SDKs, pages and mutated trees, all of which the
tools regenerate), dependency trees, the working clones (their commits are
in this branch's history), and the scripts that started each stage.
