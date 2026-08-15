// `-y` / `--dryrun` must not write.
//
// WHAT WENT WRONG
//
// `voxgig-sdkgen -y target add ts` printed `** DRY RUN **` and wrote every
// file. The flag reached the Jostraca INSTANCE (`SdkGen` sets
// `control.dryrun` in its constructor options), but jostraca's `generate`
// runs its own per-call options through OptionsShape FIRST — which fills in
// `control.dryrun: false` — and only then merges
// `deep({}, gOpts.control, opts.control)`. The shape default won every time.
// (jostraca.js carries a `FIX:` note about the same trap for `existing`.)
//
// It matters because `target add` OVERWRITES a project's vendored scaffold. A
// dry run is exactly how a maintainer previews that blast radius, and the
// preview was the damage.
//
// A preview that lists nothing is also useless, so the actions report the
// files they would have touched — showChanges only lists merged/conflicted
// files, which on a fresh add is none of them.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import {
  makeProject, targetRef, recordLog, target_add, feature_add, ROOT,
} from './actionharness'


// Paths the run reported it would change, from the dry-run report lines.
function reported(log: any): string[] {
  return log.lines
    .filter((l: any) => 'string' === typeof l.file)
    .map((l: any) => String(l.file))
}


describe('dry run', () => {

  test('target add writes nothing', async () => {
    const log = recordLog()
    const project = makeProject({ dryrun: true, log })
    // The two index files every project starts with, seeded by the harness.
    const before = project.files()

    await target_add([targetRef('go')], project.actx)

    deepStrictEqual(project.files(), before,
      'a dry run wrote files to the project')
  })


  test('target add reports what it would change', async () => {
    const log = recordLog()
    const project = makeProject({ dryrun: true, log })

    await target_add([targetRef('go')], project.actx)

    const files = reported(log)
    ok(0 < files.length, 'a dry run reported no files at all')

    // The three things `target add` touches: the target model, the vendored
    // components, and the template tree.
    for (const want of ['model/target/go.aontu', 'src/cmp/go/', 'tm/go/']) {
      ok(files.some((f: string) => f.includes(want)),
        'dry run did not report ' + want + ' (reported ' + files.length + ' files)')
    }

    // And it says so in words, not just by listing.
    ok(log.lines.some((l: any) => String(l.note || '').includes('nothing was written')),
      'dry run never stated that nothing was written')
  })


  test('target add DELETES nothing', async () => {
    // Regression: the stale-template prune calls fs.unlinkSync directly, and
    // jostraca enforces control.dryrun only inside its own write layer — so
    // `-y target add <t>` previewed the copies and really removed every stale
    // template. The earlier "writes nothing" test could not catch it: a fresh
    // project has no stale templates to remove.
    //
    // Deletion is the worst case for this flag. A dry run is how a maintainer
    // inspects the blast radius of an add BEFORE it touches a vendored tree.
    const project = makeProject({ dryrun: true, log: recordLog() })
    const stale = 'tm/lua/STALE_MARKER.lua'

    project.fs.mkdirSync(ROOT + '/tm/lua', { recursive: true })
    project.fs.writeFileSync(ROOT + '/' + stale, '-- stale\n')

    await target_add([targetRef('lua')], project.actx)

    ok(project.fs.existsSync(ROOT + '/' + stale),
      'a dry run deleted a stale template')
  })


  test('target add reports the deletions it would make', async () => {
    const log = recordLog()
    const project = makeProject({ dryrun: true, log })
    const stale = 'tm/lua/STALE_MARKER.lua'

    project.fs.mkdirSync(ROOT + '/tm/lua', { recursive: true })
    project.fs.writeFileSync(ROOT + '/' + stale, '-- stale\n')

    await target_add([targetRef('lua')], project.actx)

    // A preview that silently omits the removals is as misleading as one that
    // omits the writes.
    ok(log.lines.some((l: any) =>
      String(l.note || '').includes('would remove') &&
      String(l.note || '').includes('STALE_MARKER.lua')),
      'dry run never reported the stale template it would remove')
  })


  // The control: with the flag off, the prune really does remove it.
  test('without the flag, target add prunes the stale template', async () => {
    const project = makeProject({})
    const stale = 'tm/lua/STALE_MARKER.lua'

    project.fs.mkdirSync(ROOT + '/tm/lua', { recursive: true })
    project.fs.writeFileSync(ROOT + '/' + stale, '-- stale\n')

    await target_add([targetRef('lua')], project.actx)

    ok(!project.fs.existsSync(ROOT + '/' + stale),
      'the prune stopped removing stale templates')
  })


  test('feature add writes nothing', async () => {
    // A target must exist for `feature add` to have anywhere to put source.
    const project = makeProject({ target: { go: { name: 'go' } } })
    await target_add([targetRef('go')], project.actx)
    const before = project.files()

    project.actx.opts.dryrun = true
    await feature_add(['retry'], project.actx)

    deepStrictEqual(project.files(), before,
      'a dry-run feature add changed the project')
  })


  // The control: with the flag off, the same call DOES write. Without this,
  // a harness that silently generated nothing would pass the tests above.
  test('without the flag, target add writes', async () => {
    const project = makeProject({})

    await target_add([targetRef('go')], project.actx)

    const files = project.files()
    ok(10 < files.length, 'target add wrote almost nothing: ' + files.length)
    ok(files.includes('model/target/go.aontu'), 'target add wrote no target model')
  })
})
