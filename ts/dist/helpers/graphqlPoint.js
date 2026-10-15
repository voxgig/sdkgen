"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointIsGraphql = pointIsGraphql;
exports.ownPointFirst = ownPointFirst;
exports.primaryPoint = primaryPoint;
exports.graphqlDirectSkip = graphqlDirectSkip;
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
function pointIsGraphql(point) {
    return 'graphql' === point?.k;
}
// A list's own field is the entity's plural (`teams`), any other op's the singular.
function ownField(point, entityName, opname) {
    const field = point?.gq?.field;
    if (!pointIsGraphql(point) || 'string' !== typeof field || '' === field) {
        return false;
    }
    const snake = (0, jostraca_1.snakify)(field);
    return 'list' === opname ?
        snake !== entityName && (0, apidef_1.depluralize)(snake) === entityName :
        snake === entityName;
}
function pointExist(point) {
    const exist = point?.q?.exist;
    return Array.isArray(exist) ? exist.map(String) : [];
}
// Ahead of every earlier point a call reaching it would select first; a
// point with a narrower selector keeps its place, and stays reachable.
function ownPointFirst(points, entityName, opname) {
    const own = points.findIndex((pt) => ownField(pt, entityName, opname));
    if (own < 1) {
        return points;
    }
    const target = points[own];
    const exist = pointExist(target);
    const action = target?.q?.['$action'];
    const at = points.findIndex((pt, i) => i < own &&
        action === pt?.q?.['$action'] &&
        pointExist(pt).every((key) => exist.includes(key)));
    if (at < 0) {
        return points;
    }
    const out = points.slice();
    out.splice(own, 1);
    out.splice(at, 0, target);
    return out;
}
function primaryPoint(points, entityName, opname) {
    return points.find((pt) => ownField(pt, entityName, opname)) ?? points[0];
}
function graphqlDirectSkip(opname, entityName) {
    return 'direct-' + opname + '-' + entityName +
        ': a GraphQL point, which this direct test does not cover';
}
//# sourceMappingURL=graphqlPoint.js.map