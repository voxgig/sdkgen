// ProjectName SDK - the lift of binary values and the body items
// (mirrors utility/BinaryUtility.ts). Nothing here opens a file: a string is
// content. Included by pipeline.hpp, after the media helpers are declared.

#pragma once

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "../core/types.hpp"
#include "../core/schema.hpp"

namespace sdk {
namespace util {

inline bool isRawRequest(const Value& point);
inline const char* rawBodyKey();

// The data keys whose values are file content: a multipart or form body's
// binary fields, and the whole of a raw body.
inline std::vector<std::string> binaryNames(const Value& point) {
  Value body = getp(point, "body");
  std::string kind = as_str(getp(body, "kind"));
  std::vector<std::string> names;
  if ("raw" == kind) {
    names.push_back(rawBodyKey());
  } else if ("multipart" == kind || "form" == kind) {
    Value fields = getp(body, "fields");
    if (fields.is_list()) {
      for (const auto& f : *fields.as_list()) {
        Value n = getp(f, "name");
        if (n.is_string() && is_true(getp(f, "binary"))) names.push_back(n.as_string());
      }
    }
  }
  return names;
}

// Closed union: a source cannot hide inside the data, so instead of walking
// it for strays the lift refuses a given source under a name the point does
// not declare binary. A data value under a binary name is content.
inline void liftSources(CtxPtr ctx) {
  if (ctx->sourcesLifted) return;
  std::vector<std::string> names = binaryNames(ctx->point);
  auto binaryName = [&](const std::string& n) {
    return std::find(names.begin(), names.end(), n) != names.end();
  };

  if (ctx->given) {
    for (const auto& kv : *ctx->given) {
      if (!binaryName(kv.first)) {
        throw ctx->makeError("binary_source_refused", "A binary source was passed in \"" +
          kv.first + "\", which is not a field the operation declares binary.");
      }
    }
  }

  if (ctx->reqdata.is_map()) {
    bool any = false;
    for (const auto& kv : *ctx->reqdata.as_map()) any = any || binaryName(kv.first);
    if (any) {
      Value copy = vmap();
      for (const auto& kv : *ctx->reqdata.as_map()) {
        map_put(binaryName(kv.first) ? ctx->lifted : copy, kv.first, kv.second);
      }
      ctx->reqdata = copy;
    }
  }

  ctx->sourcesLifted = true;
}

inline bool isRawResponse(const Value& point) {
  return "raw" == as_str(getp(getp(point, "response"), "kind"));
}

// A response the model declares to be bytes is read only through the
// entity's binary handle, never into its data.
inline void bytesRefused(CtxPtr ctx) {
  Value response = getp(ctx->point, "response");
  if (!isRawResponse(ctx->point) || !is_true(getp(response, "binary")) ||
      (ctx->ctrl && ctx->ctrl->transfer.is_map())) {
    return;
  }
  Value action = getp(getp(ctx->point, "select"), "$action");
  std::string call = action.is_string() ? "binary(\"" + action.as_string() + "\")" : "binary()";
  throw ctx->makeError("binary_sink_required", "Operation \"" + ctx->op->name +
    "\" on entity \"" + ctx->op->entity + "\" answers bytes, which never enter the entity's "
    "data: read them with entity->" + call + ".bytes().");
}

// The given source under a name, or null.
inline const BinarySource* liftedSource(CtxPtr ctx, const std::string& name) {
  if (!ctx->given) return nullptr;
  for (const auto& kv : *ctx->given) {
    if (kv.first == name) return &kv.second;
  }
  return nullptr;
}

inline std::size_t maxBuffer(CtxPtr ctx) {
  for (const Value& v : { getp(ctx->options, "maxBuffer"), getp(sharedOptspec(), "maxBuffer") }) {
    if (v.is_number() && 0 <= v.as_double() && std::isfinite(v.as_double())) {
      return static_cast<std::size_t>(v.as_double());
    }
  }
  return 16777216;
}

// A number as JavaScript writes it: no fraction on an integer, else the
// shortest digits that read back the same.
inline std::string numberText(double d) {
  char buf[40];
  if (d == std::floor(d) && std::fabs(d) < 1e21) {
    std::snprintf(buf, sizeof(buf), "%.0f", d);
  } else {
    for (int p = 1; p <= 17; p++) {
      std::snprintf(buf, sizeof(buf), "%.*g", p, d);
      if (std::strtod(buf, nullptr) == d) break;
    }
  }
  return buf;
}

// A plain value as the text of a form pair or a multipart part.
inline std::string itemText(const Value& v) {
  if (v.is_string()) return v.as_string();
  if (v.is_bool()) return v.as_bool() ? "true" : "false";
  if (v.is_int()) return std::to_string(v.as_int());
  if (v.is_double()) return numberText(v.as_double());
  return Struct::jsonify(v);
}

// One value a form or multipart body carries, in wire order.
struct BodyItem {
  std::string name;
  bool binary = false;
  Value media = Value::undef();         // the field's declared media
  const BinarySource* source = nullptr; // the given source
  std::string content;
};

// Wire order: the fields the model declares, in its order, then every other
// key of the data in code point order.
inline std::vector<BodyItem> bodyItems(CtxPtr ctx, const Value& data) {
  Value fields = getp(getp(ctx->point, "body"), "fields");
  Value plain = data.is_map() ? data : vmap();
  std::vector<Value> declared;
  if (fields.is_list()) {
    for (const auto& f : *fields.as_list()) {
      if (getp(f, "name").is_string()) declared.push_back(f);
    }
  }
  auto fieldOf = [&](const std::string& name) -> Value {
    for (const auto& f : declared) {
      if (as_str(getp(f, "name")) == name) return f;
    }
    return Value::undef();
  };

  std::vector<BodyItem> items;
  auto add = [&](const std::string& name, const Value& field) {
    bool binary = is_true(getp(field, "binary"));
    Value media = getp(field, "media");
    Value join = getp(field, "join");

    bool given = false;
    if (ctx->given) {
      for (const auto& kv : *ctx->given) {
        if (kv.first != name) continue;
        items.push_back({ name, binary, media, &kv.second, kv.second.data });
        given = true;
      }
    }
    if (given) return;

    const Value* found = ctx->lifted.is_map() ? ctx->lifted.as_map()->find(name) : nullptr;
    if (nullptr == found) found = plain.as_map()->find(name);
    if (nullptr == found || is_nullish(*found)) return;
    const Value& val = *found;

    if (!val.is_list()) {
      items.push_back({ name, binary, media, nullptr, itemText(val) });
      return;
    }
    if (!binary && join.is_string()) {
      std::string text;
      bool first = true;
      for (const auto& el : *val.as_list()) {
        if (is_nullish(el)) continue;
        if (!first) text += join.as_string();
        text += itemText(el);
        first = false;
      }
      items.push_back({ name, binary, media, nullptr, text });
      return;
    }
    for (const auto& el : *val.as_list()) {
      if (!is_nullish(el)) items.push_back({ name, binary, media, nullptr, itemText(el) });
    }
  };

  for (const auto& f : declared) {
    std::string name = as_str(getp(f, "name"));
    if (map_contains(plain, name) || map_contains(ctx->lifted, name) ||
        nullptr != liftedSource(ctx, name)) {
      add(name, f);
    }
  }

  std::vector<std::string> rest;
  for (const auto& kv : *plain.as_map()) {
    if (fieldOf(kv.first).is_undef()) rest.push_back(kv.first);
  }
  std::sort(rest.begin(), rest.end());
  for (const auto& name : rest) add(name, Value::undef());

  return items;
}

}  // namespace util
}  // namespace sdk
