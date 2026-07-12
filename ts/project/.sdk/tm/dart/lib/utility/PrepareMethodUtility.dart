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

  return methodMap[opname];
}
