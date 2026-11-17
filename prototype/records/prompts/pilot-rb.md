# pilot-rb: port Ruby by the guide, as the guide's test

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `pilot-rb`; your directory is `P/pilot-rb/`. Write nowhere else.
Never modify anything under `/home/user`, and never modify `P/freeze`: copy
what you need.

Read, and only these to begin with: `P/brief.md` (the proposal, the
hypotheses, the hard rules), `P/brief3.md` (the principle as it now stands,
the measures, how to commit), and `P/freeze/PORTING.md`, the porting guide.
The guide is meant to be complete on its own. Each time you have to read
something else to make progress (another provider's source aside, which the
guide tells you to copy from), write down what you needed and why: that is a
problem in the guide.

## The job

Port Ruby (`rb`) to the shared README tutorial, the shared root README
quick start and the shared REFERENCE page, against the frozen interface, by
following the guide exactly. Five more engineers will port two languages
each from the same guide straight after you, so the point is as much to test
the guide, the interface and the tools as to port Ruby. Ruby has a toolchain
here (ruby with bundle) and a README lane that runs its examples.

Set up: `cp -a P/freeze/sdkgen P/pilot-rb/sdkgen` and the same for
`harness`, `tools` and `oldclone`
(`export PATH=/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH`).
Confirm the tag `v3-frozen` is your starting commit, rebuild, regenerate.

Then follow the guide. Note the time you start and finish each of its steps.

Rules that hold whatever the guide says:

- Touch only Ruby's own files (`ts/project/.sdk/src/cmp/rb/`, and its guard
  forms). If the interface cannot express something Ruby's old components
  print, do not work around it in the provider: record the construct, the
  old file and line, the smallest change to shared code that would express
  it, whether that change is breaking or additive, and which providers it
  would force work in. If you cannot continue without it, make the change in
  a separate commit of shared files only, and say so.
- The provider reads no model and holds no naming rule; the naming hook
  calls functions Ruby's code generator calls.
- Ruby prints chosen fields of a record where other languages print the
  record: that is a declared capability, and the field choice comes from the
  description.
- Commit as `brief3.md` says: shared files, the language's files, the build,
  the golden, each on its own.

Check the port with the guide's one command, and with the Ruby README lane
on both OLD and NEW. Report:

- per section: old component lines, provider and hook lines; the ledger
  (same, reworded, restored, dropped, unclassified, which must be 0); the
  blocks (identical, identical after named corrections, changed by a named
  unification, changed otherwise);
- what compiles and what RUNS, before and after;
- every interface gap, as above;
- every shared file you touched, and why;
- every fact Ruby's old text stated that the new text does not, and what
  became of it;
- every problem in the guide: wrong, silent, or unclear, with the step;
- the time each step took.

Report against H1, H3 and H4 for Ruby. Separate what you ran from what you
read. Say what you did not get to.
