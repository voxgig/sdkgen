// Replacement keys the GENERATOR owns, merged into the project's `ctx$.stdrep`.
//
// `stdrep` itself is built by the consumer's `Root.ts`
// (`names(ctx$.stdrep, model.Name, 'ProjectName')`), which lives outside this
// package and is frozen at project-init time — so a new placeholder cannot be
// added there without every existing project resyncing its root wiring. These
// are added here instead, immediately before the templates that use them are
// copied, so an old project gets them without touching its scaffold.

import { envName } from './packageMeta'


// PROJECTENV — the env-var base for this SDK's `<BASE>_TEST_LIVE`,
// `<BASE>_APIKEY` and friends.
//
// NOT `PROJECTNAME`. That one is the camel-cased class name uppercased, which
// SWALLOWS a hyphen: `voxgig-solardemo` becomes `VOXGIGSOLARDEMO`, while every
// component-generated env var reads `VOXGIG_SOLARDEMO`. Both spellings used to
// reach the same generated SDK — `test/utility.ts` (a template) read one and
// `PlanetEntity.test.ts` (a component) the other — so setting either variable
// sent half the suite live and left the rest mocked, green either way.
function ensureStdrep(ctx$: any): any {
  const stdrep = ctx$.stdrep = (ctx$.stdrep || {})

  if (null == stdrep.PROJECTENV) {
    stdrep.PROJECTENV = envName(ctx$.model)
  }

  return stdrep
}


export {
  ensureStdrep,
}
