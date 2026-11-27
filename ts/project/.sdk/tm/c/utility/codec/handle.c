// An entity's named bytes (mirrors utility/codec/HandleCodec.ts). Each call
// is one run of the entity's own operation on the slot's point.

#include "sdk.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

BinaryHandle entity_binary(Entity* e, const char* slot) {
  BinaryHandle h;
  h.entity = e;
  h.slot = NULL == slot ? "" : slot;
  h.def = NULL;
  size_t n = 0;
  const BinarySlotDef* slots = NULL != e->vt->binary_slots ? e->vt->binary_slots(e, &n) : NULL;
  for (size_t i = 0; NULL != slots && i < n; i++) {
    if (0 == strcmp(slots[i].name, h.slot)) h.def = &slots[i];
  }
  return h;
}

static PNError* handle_error(const char* code, const char* fmt, const char* slot,
                             const char* entity, const char* what) {
  size_t n = strlen(fmt) + strlen(slot) + strlen(entity) + strlen(what) + 8;
  char* msg = (char*)malloc(n);
  snprintf(msg, n, fmt, slot, entity, what);
  PNError* err = pn_error_new(code, msg);
  free(msg);
  return err;
}

static PNError* inactive(BinaryHandle* h, const char* what) {
  return handle_error("binary_feature_inactive", "The binary slot \"%s\" of entity \"%s\" cannot "
    "%s without the binary feature; in core it answers bytes() and put().", h->slot,
    h->entity->vt->get_name(h->entity), what);
}

static PNError* direction(BinaryHandle* h, bool read) {
  const char* entity = h->entity->vt->get_name(h->entity);
  if (NULL == h->def) {
    return handle_error("binary_slot_unknown", "Entity \"%s\" has no binary slot \"%s\".%s",
      entity, h->slot, "");
  }
  if (NULL == (read ? h->def->read : h->def->write)) {
    return handle_error("binary_slot_direction", "The binary slot \"%s\" of entity \"%s\" cannot "
      "be %s.", h->slot, entity, read ? "read" : "written");
  }
  return NULL;
}

// A copy of the caller's ctrl with the transfer: the caller's map gains no key.
static voxgig_value* transfer_ctrl(voxgig_value* ctrl, voxgig_value* transfer) {
  voxgig_value* out = voxgig_new_map();
  if (voxgig_is_map(ctrl)) {
    voxgig_map* m = voxgig_as_map(ctrl);
    for (size_t i = 0; i < m->len; i++) {
      setp(out, m->entries[i].key, voxgig_retain(m->entries[i].value));
    }
  }
  setp(out, "transfer", transfer);
  return out;
}

static voxgig_value* select_of(BinaryHandle* h) {
  return '\0' == h->def->action[0] ? voxgig_new_map()
    : cmap(1, "$action", v_str(h->def->action));
}

uint8_t* binary_handle_bytes(BinaryHandle* h, voxgig_value* opts, voxgig_value* ctrl,
                             size_t* len, PNError** err) {
  *err = NULL;
  *len = 0;
  voxgig_value* range = getp(opts, "range");
  if (!v_is_noval(range) && !v_is_null(range)) {
    *err = inactive(h, "read a range");
    return NULL;
  }
  if (NULL != (*err = direction(h, true))) return NULL;

  voxgig_value* transfer = cmap(2, "slot", v_str(h->slot), "direction", v_str("read"));
  voxgig_value* run = transfer_ctrl(ctrl, transfer);
  Entity* e = h->entity;
  if (0 == strcmp(h->def->read, "load")) e->vt->load(e, select_of(h), run, err);
  voxgig_release(run);
  if (NULL != *err) {
    voxgig_release(transfer);
    return NULL;
  }

  voxgig_value* bytes = getp(transfer, "bytes");
  size_t n = voxgig_is_string(bytes) ? voxgig_string_len(bytes) : 0;
  uint8_t* out = (uint8_t*)malloc(0 == n ? 1 : n);
  if (0 < n) memcpy(out, voxgig_as_string(bytes), n);
  *len = n;
  voxgig_release(transfer);
  return out;
}

Entity* binary_handle_put(BinaryHandle* h, BinarySource source, voxgig_value* ctrl,
                          PNError** err) {
  *err = NULL;
  if (NULL != (*err = direction(h, false))) return NULL;

  voxgig_value* transfer = cmap(2, "slot", v_str(h->slot), "direction", v_str("write"));
  voxgig_value* run = transfer_ctrl(ctrl, transfer);
  BinaryField body = { "$body", source };
  Entity* e = h->entity;
  const char* write = h->def->write;
  if (0 == strcmp(write, "update")) entity_update_with(e, select_of(h), &body, 1, run, err);
  else if (0 == strcmp(write, "patch")) entity_patch_with(e, select_of(h), &body, 1, run, err);
  else entity_create_with(e, select_of(h), &body, 1, run, err);
  voxgig_release(run);
  voxgig_release(transfer);
  return NULL == *err ? e : NULL;
}

PNError* binary_handle_save(BinaryHandle* h) { return inactive(h, "save"); }

PNError* binary_handle_stream(BinaryHandle* h) { return inactive(h, "stream"); }

PNError* binary_handle_open(BinaryHandle* h) { return inactive(h, "open"); }
