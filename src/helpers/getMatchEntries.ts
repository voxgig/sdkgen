// Return the user-facing entries of a flow step's `match` object. Keys ending
// in `$` are jostraca/aontu metadata sentinels and are skipped.
//
// Identical helper was previously inlined in TestEntity_*.ts and TestDirect_*.ts.

function getMatchEntries(step: any): [string, any][] {
  if (!step?.match) return []
  return Object.entries(step.match).filter(([k]: any) => !k.endsWith('$'))
}


export {
  getMatchEntries,
}
