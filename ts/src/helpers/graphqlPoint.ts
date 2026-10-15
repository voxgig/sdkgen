import { snakify } from 'jostraca'
import { depluralize } from '@voxgig/apidef'


function pointIsGraphql(point: any): boolean {
  return 'graphql' === point?.k
}


// A list's own field is the entity's plural (`teams`), any other op's the singular.
function ownField(point: any, entityName: string, opname: string): boolean {
  const field = point?.gq?.field
  if (!pointIsGraphql(point) || 'string' !== typeof field || '' === field) {
    return false
  }
  const snake = snakify(field)
  return 'list' === opname ?
    snake !== entityName && depluralize(snake) === entityName :
    snake === entityName
}


function pointExist(point: any): string[] {
  const exist = point?.q?.exist
  return Array.isArray(exist) ? exist.map(String) : []
}


// Ahead of every earlier point a call reaching it would select first; a
// point with a narrower selector keeps its place, and stays reachable.
function ownPointFirst(points: any[], entityName: string, opname: string): any[] {
  const own = points.findIndex((pt: any) => ownField(pt, entityName, opname))
  if (own < 1) {
    return points
  }

  const target = points[own]
  const exist = pointExist(target)
  const action = target?.q?.['$action']
  const at = points.findIndex((pt: any, i: number) => i < own &&
    action === pt?.q?.['$action'] &&
    pointExist(pt).every((key: string) => exist.includes(key)))

  if (at < 0) {
    return points
  }

  const out = points.slice()
  out.splice(own, 1)
  out.splice(at, 0, target)
  return out
}


function primaryPoint<P>(points: P[], entityName: string, opname: string): P | undefined {
  return points.find((pt: P) => ownField(pt, entityName, opname)) ?? points[0]
}


function graphqlDirectSkip(opname: string, entityName: string): string {
  return 'direct-' + opname + '-' + entityName +
    ': a GraphQL point, which this direct test does not cover'
}


export {
  pointIsGraphql,
  ownPointFirst,
  primaryPoint,
  graphqlDirectSkip,
}
