
function getMatchEntries(step: any): [string, any][] {
  if (!step?.match) return []
  return Object.entries(step.match).filter(([k]: any) => !k.endsWith('$'))
}


export {
  getMatchEntries,
}
