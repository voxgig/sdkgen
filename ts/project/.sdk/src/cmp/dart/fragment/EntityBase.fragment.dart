
// ignore_for_file: non_constant_identifier_names

import 'utility/ErrUtility.dart';

// Base class for generated entities. `dataVal`/`matchVal` hold accreted
// partial state (they start {} and fill in as ops resolve); the full typed
// data models are documented in ProjectNameTypes.dart.
class ProjectNameEntityBase {
  String name = '';
  String name_ = '';
  String Name = '';

  dynamic client;
  dynamic utility;
  dynamic entoptsMap;
  dynamic dataVal = {};
  dynamic matchVal = {};
  dynamic entctx;

  ProjectNameEntityBase(dynamic client_, dynamic entopts_) {
    final entopts = entopts_ ?? {};
    if (entopts is Map) {
      entopts['active'] = false != entopts['active'];
    }

    client = client_;
    entoptsMap = entopts;
    utility = client_.utility();
    dataVal = {};
    matchVal = {};

    final makeContext = utility.makeContext;

    entctx = makeContext({
      'entity': this,
      'entopts': entopts,
    }, client_.rootctx);

    final featureHook = utility.featureHook;
    featureHook(entctx, 'PostConstructEntity');
  }

  dynamic entopts() {
    return utility.struct.merge([{}, entoptsMap]);
  }

  dynamic data([dynamic d]) {
    final struct = utility.struct;
    final featureHook = utility.featureHook;

    if (null != d) {
      dataVal = struct.clone(d);
      featureHook(entctx, 'SetData');
    }

    featureHook(entctx, 'GetData');
    final out = struct.clone(dataVal);

    return out;
  }

  dynamic match([dynamic m]) {
    final struct = utility.struct;
    final featureHook = utility.featureHook;

    if (null != m) {
      matchVal = struct.clone(m);
      featureHook(entctx, 'SetMatch');
    }

    featureHook(entctx, 'GetMatch');
    final out = struct.clone(matchVal);

    return out;
  }

  Map<String, dynamic> toJSON() {
    final struct = utility.struct;
    final out = <String, dynamic>{};
    final d = struct.getdef(dataVal, {});
    if (d is Map) {
      d.forEach((k, v) => out[k.toString()] = v);
    }
    out[r'entity$'] = Name;
    return out;
  }

  @override
  String toString() {
    return Name + ' ' + utility.struct.jsonify(dataVal);
  }

  dynamic unexpected(dynamic ctx, dynamic err) {
    final clean = utility.clean;
    final struct = utility.struct;
    final delprop = struct.delprop;

    final ctrl = ctx.ctrl;

    ctrl['err'] = err;

    if (null != ctrl['explain']) {
      ctx.ctrl['explain'] = clean(ctx, ctx.ctrl['explain']);
      delprop(ctx.ctrl['explain']['result'], 'err');

      if (null != ctx.result && null != ctx.result.err) {
        ctrl['explain']['err'] = clean(ctx, {
          'code': errcode(ctx.result.err),
          'message': errmsg(ctx.result.err),
        });
      }

      final cleanerr = clean(ctx, {
        'code': errcode(err),
        'message': errmsg(err),
      });

      if (null == ctrl['explain']['err']) {
        ctrl['explain']['err'] = cleanerr;
      } else if (ctrl['explain']['err']['message'] != cleanerr['message']) {
        ctrl['explain']['unexpected'] = cleanerr;
      }
    }

    if (false == ctrl['throw']) {
      return null;
    }

    return err;
  }
}
