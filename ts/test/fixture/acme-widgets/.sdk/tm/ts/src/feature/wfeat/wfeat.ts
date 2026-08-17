// wfeat's OVERLAY for the bundled `ts` target.
//
// The bundled ts target's own template tree knows nothing about this feature
// and must not be edited to learn — an external package cannot reach into the
// scaffold. So the package ships the source at the layout `ts` uses
// (`src/feature/<name>/`) under its OWN `tm/ts`, and the fan-out copies it
// across at `feature add` time.
//
// This is the branch `action/feature.ts` takes when the computed overlay path
// differs from the target's own tm folder — the other half of the pair whose
// first half is `tm/wtest/feature/wfeat.wt`.

export class WfeatFeature {
  name = 'wfeat'

  PostConstruct(ctx: any) {
    return ctx
  }
}
