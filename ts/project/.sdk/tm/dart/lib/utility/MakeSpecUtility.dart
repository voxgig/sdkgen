import '../Spec.dart';

import 'ErrUtility.dart';

// Create request specification.
dynamic makeSpec(dynamic ctx) {
  if (null != ctx.out['spec']) {
    return ctx.spec = ctx.out['spec'];
  }

  final point = ctx.point;
  final options = ctx.options;
  final utility = ctx.utility;

  final prepareMethod = utility.prepareMethod;
  final prepareParams = utility.prepareParams;
  final prepareQuery = utility.prepareQuery;
  final prepareHeaders = utility.prepareHeaders;
  final prepareBody = utility.prepareBody;
  final preparePath = utility.preparePath;
  final prepareAuth = utility.prepareAuth;

  ctx.spec = Spec({
    'base': options['base'], // string, URL endpoint base prefix,
    'prefix': options['prefix'],
    'parts': point.parts,
    'suffix': options['suffix'],
    'step': 'start',
  });

  ctx.spec.method = prepareMethod(ctx);

  final allowmethod = (options['allow']?['method'] ?? '').toString();
  if (!allowmethod.contains(ctx.spec.method.toString())) {
    return ctx.error(
        'spec_method_allow',
        'Method "' +
            ctx.spec.method.toString() +
            '" not allowed by SDK option allow.method value: "' +
            allowmethod +
            '"');
  }

  ctx.spec.params = prepareParams(ctx);
  ctx.spec.query = prepareQuery(ctx);
  ctx.spec.headers = prepareHeaders(ctx);
  ctx.spec.body = prepareBody(ctx);
  ctx.spec.path = preparePath(ctx);

  if (null != ctx.ctrl['explain']) {
    ctx.ctrl['explain']['spec'] = ctx.spec;
  }

  final spec = prepareAuth(ctx);

  if (!iserr(spec)) {
    ctx.spec = spec;
  }

  return spec;
}
