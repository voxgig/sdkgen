import 'dart:convert';

import 'feature/base/BaseFeature.dart';
// #ImportFeatures

// ignore: non_constant_identifier_names
final Map<String, BaseFeature Function()> FEATURE_CLASS = {
  // #FeatureClasses
};

// THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
//
// The literal form of this file declares the whole model as nested map
// literals. For a large API that is megabytes of source the Dart analyzer and
// compiler must parse and type every node of, on every build, and that the VM
// must build entry by entry on every load.
//
// As a single string constant it is one token, and `jsonDecode` builds the map
// far faster than the equivalent literal.
//
// Emitted only above a size threshold, or when `main.kit.config.repr` pins it:
// for a small model the literal is smaller, loads no slower, and is far easier
// to read when debugging.
const String _CONFIG_DATA = 'CONFIGJSON';

// Parsed ONCE, at first use, exactly like the literal form was built once:
// a top-level `final` is lazily initialised and then cached by the runtime.
final Map<String, dynamic> _CONFIG =
    jsonDecode(_CONFIG_DATA) as Map<String, dynamic>;

class Config {
  BaseFeature makeFeature(String fn) {
    final fc = FEATURE_CLASS[fn];
    if (null == fc) {
      // TODO: errors etc
      throw StateError('Unknown feature: ' + fn);
    }
    return fc();
  }

  // Read from the parsed model rather than declared as literals. The fields
  // keep their names, types and `final`ness, so callers cannot tell which
  // representation they were given.
  final Map<String, dynamic> main = _CONFIG['main'] as Map<String, dynamic>;

  final Map<String, dynamic> feature = _CONFIG['feature'] as Map<String, dynamic>;

  final Map<String, dynamic> options = _CONFIG['options'] as Map<String, dynamic>;

  final Map<String, dynamic> entity = _CONFIG['entity'] as Map<String, dynamic>;

  // The pipeline context carries the config as a plain map.
  Map<String, dynamic> toMap() => <String, dynamic>{
        'main': main,
        'feature': feature,
        'options': options,
        'entity': entity,
      };
}

final config = Config();
