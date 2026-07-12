// EntityName entity client (generated — mirrors the rust Entity fragment).

#include "api.h"

#include <stdlib.h>
#include <string.h>

typedef struct entyvar_entity {
  Entity base;            // vtable pointer (first member)
  char* name;
  ProjectNameSDK* client;
  Utility* utility;
  voxgig_value* entopts;
  voxgig_value* data;     // Map
  voxgig_value* mtch;     // Map
  Context* entctx;
} entyvar_entity;

typedef void (*entyvar_postdone_fn)(entyvar_entity* self, Context* ctx);

// Forward declarations.
static const EntityVT entyvar_VT;
static const char* entyvar_get_name(Entity* e);
static Entity* entyvar_make(Entity* e);
static voxgig_value* entyvar_data(Entity* e, voxgig_value* args);
static voxgig_value* entyvar_matchv(Entity* e, voxgig_value* args);
static voxgig_value* entyvar_load(Entity* e, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err);
static voxgig_value* entyvar_list(Entity* e, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err);
static voxgig_value* entyvar_create(Entity* e, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err);
static voxgig_value* entyvar_update(Entity* e, voxgig_value* reqdata, voxgig_value* ctrl, PNError** err);
static voxgig_value* entyvar_remove(Entity* e, voxgig_value* reqmatch, voxgig_value* ctrl, PNError** err);

static Context* entyvar_ent_ctx(entyvar_entity* self) {
  return self->entctx;
}

Entity* entyvar_entity_new(ProjectNameSDK* client, voxgig_value* entopts) {
  entopts = voxgig_is_map(entopts) ? entopts : voxgig_new_map();

  bool act;
  if (!get_bool(entopts, "active", &act)) {
    setp(entopts, "active", v_bool(true));
  } else if (act != false) {
    setp(entopts, "active", v_bool(true));
  }

  entyvar_entity* self = (entyvar_entity*)calloc(1, sizeof(entyvar_entity));
  self->base.vt = &entyvar_VT;
  self->name = strdup("entityname");
  self->client = client;
  self->utility = sdk_get_utility(client);
  self->entopts = entopts;
  self->data = voxgig_new_map();
  self->mtch = voxgig_new_map();
  self->entctx = NULL;

  CtxSpec cs;
  memset(&cs, 0, sizeof(cs));
  cs.entity = (Entity*)self;
  cs.entopts = entopts;
  Context* entctx = make_context_util(cs, sdk_get_root_ctx(client));

  feature_hook_util(entctx, "PostConstructEntity");

  self->entctx = entctx;
  return (Entity*)self;
}

// Pipeline: make_point -> make_spec -> make_request -> make_response ->
// make_result -> post_done -> done. Feature hooks fire between stages.
static voxgig_value* entyvar_run_op(entyvar_entity* self, Context* ctx,
                                    entyvar_postdone_fn post_done, PNError** err) {
  Utility* utility = self->utility;
  (void)utility;
  PNError* e = NULL;

  // #PrePoint-Hook

  voxgig_value* point = make_point_util(ctx, &e);
  if (e) return make_error_util(ctx, e, err);
  ctx_out_set_point_val(ctx, point);

  // #PreSpec-Hook

  Spec* spec = make_spec_util(ctx, &e);
  if (e) return make_error_util(ctx, e, err);
  ctx->out_spec = spec;

  // #PreRequest-Hook

  Response* resp = make_request_util(ctx, &e);
  if (e) return make_error_util(ctx, e, err);
  ctx->out_request = resp;

  // #PreResponse-Hook

  Response* resp2 = make_response_util(ctx, &e);
  if (e) return make_error_util(ctx, e, err);
  ctx->out_response = resp2;

  // #PreResult-Hook

  SdkResult* result = make_result_util(ctx, &e);
  if (e) return make_error_util(ctx, e, err);
  ctx->out_result = result;

  // #PreDone-Hook

  post_done(self, ctx);

  return done_util(ctx, err);
}

static const char* entyvar_get_name(Entity* e) {
  return ((entyvar_entity*)e)->name;
}

static Entity* entyvar_make(Entity* e) {
  entyvar_entity* self = (entyvar_entity*)e;
  voxgig_value* opts = voxgig_new_map();
  if (voxgig_is_map(self->entopts)) {
    voxgig_map* m = voxgig_as_map(self->entopts);
    for (size_t i = 0; i < m->len; i++) {
      setp(opts, m->entries[i].key, voxgig_retain(m->entries[i].value));
    }
  }
  return entyvar_entity_new(self->client, opts);
}

static voxgig_value* entyvar_data(Entity* e, voxgig_value* args) {
  entyvar_entity* self = (entyvar_entity*)e;
  if (args && !v_is_noval(args) && !v_is_null(args)) {
    voxgig_value* cloned = to_map(voxgig_clone(args));
    self->data = voxgig_is_map(cloned) ? cloned : voxgig_new_map();
    feature_hook_util(entyvar_ent_ctx(self), "SetData");
  }
  feature_hook_util(entyvar_ent_ctx(self), "GetData");
  return voxgig_clone(self->data);
}

static voxgig_value* entyvar_matchv(Entity* e, voxgig_value* args) {
  entyvar_entity* self = (entyvar_entity*)e;
  if (args && !v_is_noval(args) && !v_is_null(args)) {
    voxgig_value* cloned = to_map(voxgig_clone(args));
    self->mtch = voxgig_is_map(cloned) ? cloned : voxgig_new_map();
    feature_hook_util(entyvar_ent_ctx(self), "SetMatch");
  }
  feature_hook_util(entyvar_ent_ctx(self), "GetMatch");
  return voxgig_clone(self->mtch);
}

// #LoadOp

// #ListOp

// #CreateOp

// #UpdateOp

// #RemoveOp

static const EntityVT entyvar_VT = {
  entyvar_get_name,
  entyvar_make,
  entyvar_data,
  entyvar_matchv,
  entyvar_load,
  entyvar_list,
  entyvar_create,
  entyvar_update,
  entyvar_remove,
};
