import 'voxgig_struct.dart' as vs;

dynamic prepareMethod(dynamic ctx) {
  final op = ctx.op;
  final opname = op.name;

  final methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'load': 'GET',
    'list': 'GET',
    'remove': 'DELETE',
    'patch': 'PATCH',
  };

  // The API definition is authoritative: a POST-only or PATCH-based API
  // exposes `update` as POST or PATCH, not the PUT the op name implies.
  // Only fall back to the op-name convention when the point has no method.
  final method = vs.getprop(ctx.point, 'method');
  if (method is String && '' != method) {
    return method.toUpperCase();
  }

  return methodMap[opname];
}
