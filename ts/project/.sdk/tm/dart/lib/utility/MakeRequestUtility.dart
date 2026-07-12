import 'dart:async';

import '../Response.dart';
import '../Result.dart';

import 'ErrUtility.dart';

Future<dynamic> makeRequest(dynamic ctx) async {
  // PreRequest feature hook has already provided a result.
  if (null != ctx.out['request']) {
    return ctx.out['request'];
  }

  final spec = ctx.spec;
  final utility = ctx.utility;
  final fetcher = utility.fetcher;
  final makeFetchDef = utility.makeFetchDef;

  var response = Response({});

  final result = Result({});

  ctx.result = result;

  if (null == spec) {
    return ctx.error(
        'request_no_spec', 'Expected context spec property to be defined.');
  }

  try {
    final fetchdef = makeFetchDef(ctx);
    if (iserr(fetchdef)) {
      throw fetchdef;
    }

    if (null != ctx.ctrl['explain']) {
      ctx.ctrl['explain']['fetchdef'] = fetchdef;
    }

    spec.step = 'prerequest';

    final fetched =
        await Future.value(fetcher(ctx, fetchdef['url'], fetchdef));

    if (null == fetched) {
      response = Response({
        'err': ctx.error('request_no_response', 'response: undefined')
      });
    } else if (iserr(fetched)) {
      response = Response({'err': fetched});
    } else {
      response = Response(fetched);
    }
  } catch (err) {
    response.err = err;
  }

  spec.step = 'postrequest';

  ctx.response = response;

  return response;
}
