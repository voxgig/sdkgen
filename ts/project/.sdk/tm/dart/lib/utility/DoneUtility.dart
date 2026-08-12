import 'voxgig_struct.dart' as vs;

import 'CleanUtility.dart';

dynamic done(dynamic ctx) {
  final error = ctx.utility.makeError;

  if (null != ctx.ctrl['explain']) {
    ctx.ctrl['explain'] = clean(ctx, ctx.ctrl['explain']);
    vs.delprop(ctx.ctrl['explain']['result'], 'err');
  }

  // An operation resolves to the ENTITY, not the raw data. Entities are
  // stateful: the op fragment has just absorbed resdata/resmatch into this
  // instance, and the caller reaches the record through .data(). Two
  // structural exceptions: `list` resolves to the ARRAY of entity
  // instances makeResult built, and a context with no entity
  // (direct/prepare, streaming) has nothing to return but the data. A
  // removed entity keeps its data but is no longer live. See AGENTS.md.
  if (null != ctx.result && true == ctx.result.ok) {
    final entity = ctx.entity;
    final opname = null == ctx.op ? null : ctx.op.name;

    if (null != entity && 'list' != opname) {
      if ('remove' == opname) {
        entity.markDeleted();
      }
      return entity;
    }

    return ctx.result.resdata;
  }

  return error(ctx);
}
