// EJECT-START

static void entyvar_create_postdone(entyvar_entity* self, Context* ctx) {
  SdkResult* result = ctx->result;
  if (result) {
    voxgig_value* resdata = result->resdata;
    if (!v_is_noval(resdata) && !v_is_null(resdata)) {
      voxgig_value* m = to_map(voxgig_clone(resdata));
      self->data = voxgig_is_map(m) ? m : voxgig_new_map();
    }
  }
}

static Entity* entyvar_create_with(Entity* e, voxgig_value* reqdata, const BinaryField* sources,
                                 size_t nsources, voxgig_value* ctrl, PNError** err) {
  entyvar_entity* self = (entyvar_entity*)e;
  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.opname = "create";
  cs.ctrl = ctrl;
  cs.mtch = self->mtch;
  cs.data = self->data;
  cs.reqdata = reqdata;
  cs.sources = sources;
  cs.nsources = nsources;
  Context* ctx = make_context_util(cs, entyvar_ent_ctx(self));
  entyvar_run_op(self, ctx, entyvar_create_postdone, err);
  if (*err) return NULL;

  // The operation resolves to THIS entity: run_op has just absorbed the
  // result into it, and the caller reaches the record through vt->data.

  return e;
}

static Entity* entyvar_create(Entity* e, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err) {
  return entyvar_create_with(e, reqdata, NULL, 0, ctrl, err);
}

// EJECT-END
