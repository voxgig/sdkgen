function pointIsGraphql(point: any): boolean {
  return 'graphql' === point?.k
}


// The reason a target whose direct test builds an HTTP route gives for
// skipping a GraphQL point.
function graphqlDirectSkip(opname: string, entityName: string): string {
  return 'direct-' + opname + '-' + entityName +
    ': a GraphQL point, which this direct test does not cover'
}


export {
  pointIsGraphql,
  graphqlDirectSkip,
}
