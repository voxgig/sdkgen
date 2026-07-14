import 'feature/base/BaseFeature.dart';
// #ImportFeatures

// ignore: non_constant_identifier_names
final Map<String, BaseFeature Function()> FEATURE_CLASS = {
  // #FeatureClasses
};

class Config {
  BaseFeature makeFeature(String fn) {
    final fc = FEATURE_CLASS[fn];
    if (null == fc) {
      // TODO: errors etc
      throw StateError('Unknown feature: ' + fn);
    }
    return fc();
  }

  final Map<String, dynamic> main = <String, dynamic>{
    'name': 'ProjectName',
  };

  final Map<String, dynamic> feature = <String, dynamic>{
    // #FeatureConfigs
  };

  final Map<String, dynamic> options = <String, dynamic>{
    'base': '$$main.kit.info.servers.0.url$$',

    'AUTHBLOCK''headers': 'HEADERS',

    'entity': <String, dynamic>{
      // #EntityConfigs
    }
  };

  final Map<String, dynamic> entity = 'ENTITYMAP';

  // The pipeline context carries the config as a plain map.
  Map<String, dynamic> toMap() => <String, dynamic>{
        'main': main,
        'feature': feature,
        'options': options,
        'entity': entity,
      };
}

final config = Config();
