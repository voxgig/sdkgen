import 'voxgig_struct.dart' as vs;

import 'FetcherUtility.dart';

dynamic makeOptions(dynamic ctx) {
  final utility = ctx.utility;
  final options = ctx.options;

  // Custom utility overrides.
  final customUtils = vs.getprop(options, 'utility') ?? {};
  for (final item in vs.items(customUtils)) {
    utility.setUtility(item[0], item[1]);
  }

  final config = ctx.config ?? {};
  final cfgopts = vs.getprop(config, 'options') ?? {};

  // Standard SDK option values.
  final optspec = {
    'apikey': '',
    'base': 'http://localhost:8000',
    'prefix': '',
    'suffix': '',
    'auth': {
      'prefix': '',
    },
    'headers': {
      '`\$CHILD`': '`\$STRING`',
    },
    'allow': {
      'method': 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
      'op': 'create,update,load,list,remove,command,direct',
    },
    'entity': {
      '`\$CHILD`': {
        '`\$OPEN`': true,
        'active': false,
        'alias': {},
      },
    },
    'feature': {
      '`\$CHILD`': {
        '`\$OPEN`': true,
        'active': false,
      },
    },
    'utility': {},
    'system': {},
    'test': {
      'active': false,
      'entity': {
        '`\$OPEN`': true,
      },
    },
    'clean': {
      'keys': 'key,token,id',
    },
  };

  // Dart specific: preserve the (function-valued) system.fetch across
  // merge/validate, defaulting to the dart:io transport.
  final sysFetch = vs.getpath(options, 'system.fetch') ?? httpFetch;

  // User option maps are cloned first — their (possibly narrow) literal
  // types must not constrain the merged structures.
  dynamic opts = vs.merge([{}, cfgopts, vs.clone(options ?? {})]);

  opts = vs.validate(opts, optspec);

  final sys = vs.getprop(opts, 'system');
  if (sys is Map) {
    sys['fetch'] = sysFetch;
  } else {
    opts['system'] = {'fetch': sysFetch};
  }

  final cleanKeys =
      (vs.getpath(opts, 'clean.keys') ?? 'key,token,id').toString();

  final parts = <String>[];
  for (final part in cleanKeys.split(',')) {
    final trimmed = part.trim();
    if ('' != trimmed) {
      parts.add(vs.escre(trimmed));
    }
  }
  final keyre = parts.join('|');

  opts['__derived__'] = {
    'clean': {
      'keyre': '' == keyre ? null : keyre,
    },
  };

  return opts;
}
