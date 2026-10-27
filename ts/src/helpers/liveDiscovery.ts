
type LiveDiscovery = {
  // the load path parameter the first listed record fills
  param: string
  // the field of that record it reads
  field: string
}


// What a live direct load lists to find, the same in every target. Only a path
// parameter the list route does not also take can come from a listed record,
// `id` first; every other one comes from *_ENTID or its example. A route with no
// path parameter, or an example for each, loads directly.
function liveDirectDiscovery(entity: any, loadParams: any[], listPoint: any):
  LiveDiscovery | undefined {
  if (null == listPoint || loadParams.every((p: any) => null != p.ex)) {
    return undefined
  }
  const listed = new Set((listPoint.g?.params || []).map((p: any) => p.n))
  const open = loadParams.filter((p: any) => !listed.has(p.n))
  const param: string | undefined = (open.find((p: any) => 'id' === p.n) ?? open[0])?.n
  if (null == param) {
    return undefined
  }
  return { param, field: 'id' === param ? (entity?.id?.field || 'id') : param }
}


export type { LiveDiscovery }

export { liveDirectDiscovery }
