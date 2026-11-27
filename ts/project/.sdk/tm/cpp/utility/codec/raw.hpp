// ProjectName SDK - the bounded raw reader (mirrors utility/codec/RawCodec.ts).
// There is no transport here: the bound applies to what system.fetch
// returned. Reached through codec/index.hpp.

#pragma once

#include <cctype>
#include <string>

#include "../binary.hpp"

namespace sdk {
namespace util {

inline SdkErrorPtr rawTooLarge(CtxPtr ctx, const std::string& code, std::size_t max,
                               const std::string& declared) {
  return ctx->makeError(code, "response: body " + (declared.empty() ? std::string("is longer than")
    : "of " + declared + " bytes exceeds") + " maxBuffer (" + std::to_string(max) + " bytes)");
}

// The whole body, refused past the bound: by its declared length, then by
// its count.
inline Value rawReadBounded(CtxPtr ctx, std::size_t max, const std::string& code) {
  ResponsePtr response = ctx->response;
  std::string length = headerValue(response->headers, "content-length");
  std::size_t from = length.find_first_not_of(" \t");
  std::size_t to = length.find_last_not_of(" \t");
  length = std::string::npos == from ? "" : length.substr(from, to - from + 1);
  bool digits = !length.empty() && std::all_of(length.begin(), length.end(),
    [](char c) { return std::isdigit(static_cast<unsigned char>(c)); });
  if (digits) {
    std::string trimmed = length.substr(std::min(length.find_first_not_of('0'), length.size() - 1));
    std::string bound = std::to_string(max);
    if (trimmed.size() > bound.size() || (trimmed.size() == bound.size() && trimmed > bound)) {
      throw rawTooLarge(ctx, code, max, trimmed);
    }
  }
  const Value& body = response->body;
  std::string bytes = body.is_string() ? body.as_string()
    : is_nullish(body) ? std::string() : Struct::jsonify(body);
  if (max < bytes.size()) throw rawTooLarge(ctx, code, max, "");
  return Value(bytes);
}

// Text into the record under `$body`; bytes only into a binary handle's
// read, never into the record.
inline void readRaw(CtxPtr ctx) {
  ResultPtr result = ctx->result;
  Value transfer = ctx->ctrl ? ctx->ctrl->transfer : Value::undef();
  std::size_t max = maxBuffer(ctx);

  if (is_true(getp(getp(ctx->point, "response"), "binary"))) {
    result->body = Value::undef();
    if (transfer.is_map() && "read" == as_str(getp(transfer, "direction"))) {
      map_put(transfer, "bytes", rawReadBounded(ctx, max, "binary_too_large"));
    }
    return;
  }

  result->body = vmap({ { rawBodyKey(), rawReadBounded(ctx, max, "response_too_large") } });
}

}  // namespace util
}  // namespace sdk
