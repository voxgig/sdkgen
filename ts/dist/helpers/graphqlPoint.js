"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointIsGraphql = pointIsGraphql;
exports.graphqlDirectSkip = graphqlDirectSkip;
function pointIsGraphql(point) {
    return 'graphql' === point?.k;
}
// The reason a target whose direct test builds an HTTP route gives for
// skipping a GraphQL point.
function graphqlDirectSkip(opname, entityName) {
    return 'direct-' + opname + '-' + entityName +
        ': a GraphQL point, which this direct test does not cover';
}
//# sourceMappingURL=graphqlPoint.js.map