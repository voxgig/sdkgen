
function getMatchEntries(step: any): [string, any][] {
  if (!step?.m) return []
  return Object.entries(step.m).filter(([k]: any) => !k.endsWith('$'))
}


export {
  getMatchEntries,
}
