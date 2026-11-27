// ProjectName SDK - an entity's named bytes (mirrors
// utility/codec/HandleCodec.ts). Each call is one run of the entity's own
// operation on the slot's point.

#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "../../core/types.hpp"

namespace sdk {

// The bytes come back as std::vector<uint8_t>: a byte type no caller can
// take for text, while sources take a std::string or the same vector.
class BinaryHandle {
public:
  BinaryHandle(SdkEntityPtr entity, const std::optional<std::string>& slot)
      : entity_(std::move(entity)), slot_(slot.value_or("")) {
    for (const auto& def : entity_->binarySlots()) {
      if (def.name == slot_) def_ = def;
    }
  }

  const std::string& name() const { return slot_; }

  // The whole body, within maxBuffer. A range needs the binary feature.
  std::vector<uint8_t> bytes(const Value& opts = Value::undef(),
                             const Value& ctrl = Value::undef()) {
    if (!is_nullish(getp(opts, "range"))) throw inactive("read a range");
    const BinarySlotDef& def = direction(true);
    Value transfer = vmap({ { "slot", Value(slot_) }, { "direction", Value("read") } });
    if ("load" == def.read) entity_->load(select(def), withTransfer(ctrl, transfer));
    Value got = getp(transfer, "bytes");
    if (!got.is_string()) return {};
    return std::vector<uint8_t>(got.as_string().begin(), got.as_string().end());
  }

  // Sends the source as the slot's body; resolves to the entity.
  SdkEntityPtr put(BinarySource source, const Value& ctrl = Value::undef()) {
    const BinarySlotDef& def = direction(false);
    Value transfer = vmap({ { "slot", Value(slot_) }, { "direction", Value("write") } });
    BinarySources body{ { "$body", std::move(source) } };
    Value run = withTransfer(ctrl, transfer);
    if ("update" == def.write) entity_->updateWith(select(def), std::move(body), run);
    else if ("patch" == def.write) entity_->patchWith(select(def), std::move(body), run);
    else entity_->createWith(select(def), std::move(body), run);
    return entity_;
  }

  void save() { throw inactive("save"); }
  void stream() { throw inactive("stream"); }
  void open() { throw inactive("open"); }

private:
  SdkEntityPtr entity_;
  std::string slot_;
  std::optional<BinarySlotDef> def_;

  static Value select(const BinarySlotDef& def) {
    return def.action.empty() ? vmap() : vmap({ { "$action", Value(def.action) } });
  }

  // A copy of the caller's ctrl with the transfer: the caller's map gains no key.
  static Value withTransfer(const Value& ctrl, const Value& transfer) {
    Value out = vmap();
    if (ctrl.is_map()) {
      for (const auto& kv : *ctrl.as_map()) map_put(out, kv.first, kv.second);
    }
    map_put(out, "transfer", transfer);
    return out;
  }

  const BinarySlotDef& direction(bool read) {
    std::string entity = entity_->getName();
    if (!def_) {
      throw error("binary_slot_unknown", "Entity \"" + entity + "\" has no binary slot \"" +
        slot_ + "\".");
    }
    if ((read ? def_->read : def_->write).empty()) {
      throw error("binary_slot_direction", "The binary slot \"" + slot_ + "\" of entity \"" +
        entity + "\" cannot be " + (read ? "read" : "written") + ".");
    }
    return *def_;
  }

  SdkErrorPtr inactive(const std::string& what) {
    return error("binary_feature_inactive", "The binary slot \"" + slot_ + "\" of entity \"" +
      entity_->getName() + "\" cannot " + what +
      " without the binary feature; in core it answers bytes() and put().");
  }

  static SdkErrorPtr error(const std::string& code, const std::string& msg) {
    return std::make_shared<SdkError>(code, msg, nullptr);
  }
};

// A handle on any entity, for code that knows none by its class.
inline BinaryHandle binaryHandle(SdkEntityPtr entity,
                                 const std::optional<std::string>& slot = std::nullopt) {
  return BinaryHandle(std::move(entity), slot);
}

}  // namespace sdk
