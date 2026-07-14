import 'utility/voxgig_struct.dart' as vs;

class Point {
  dynamic args;
  dynamic rename;
  dynamic method;
  dynamic orig;
  dynamic parts;
  dynamic params;
  dynamic select;
  dynamic active;
  dynamic relations;
  dynamic alias;
  dynamic transform;

  Point(dynamic altmap) {
    args = vs.getprop(altmap, 'args', {'params': []});
    rename = vs.getprop(altmap, 'rename', {'params': {}});
    method = vs.getprop(altmap, 'method', '');
    orig = vs.getprop(altmap, 'orig', '');
    parts = vs.getprop(altmap, 'parts', []);
    params = vs.getprop(altmap, 'params', []);
    select = vs.getprop(altmap, 'select');
    active = vs.getprop(altmap, 'active', false);
    relations = vs.getprop(altmap, 'relations', []);
    alias = vs.getprop(altmap, 'alias', {});
    transform = vs.getprop(altmap, 'transform', {'req': null, 'res': null});
  }

  Map<String, dynamic> toJSON() => {
        'args': args,
        'rename': rename,
        'method': method,
        'orig': orig,
        'parts': parts,
        'params': params,
        'select': select,
        'active': active,
        'relations': relations,
        'alias': alias,
        'transform': transform,
      };
}
