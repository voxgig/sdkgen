// ProjectName SDK - application/x-www-form-urlencoded encoder (mirrors
// utility/codec/FormCodec.ts). Reached through codec/index.hpp.

#pragma once

#include <string>

#include "../binary.hpp"

namespace sdk {
namespace util {

// Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
inline std::string formEscape(const std::string& in) {
  static const char HEX[] = "0123456789ABCDEF";
  std::string out;
  out.reserve(in.size());
  for (unsigned char b : in) {
    if (('0' <= b && b <= '9') || ('A' <= b && b <= 'Z') || ('a' <= b && b <= 'z') ||
        '*' == b || '-' == b || '.' == b || '_' == b) {
      out += static_cast<char>(b);
    } else if (' ' == b) {
      out += '+';
    } else {
      out += '%';
      out += HEX[b >> 4];
      out += HEX[b & 15];
    }
  }
  return out;
}

inline Utility::Encoded encodeForm(CtxPtr ctx, const Value& data) {
  std::string body;
  bool first = true;
  for (const auto& item : bodyItems(ctx, data)) {
    if (!first) body += '&';
    first = false;
    body += formEscape(item.name) + "=" + formEscape(item.content);
  }
  std::string media = as_str(getp(getp(ctx->point, "body"), "media"));
  return { media.empty() ? "application/x-www-form-urlencoded" : media, body };
}

}  // namespace util
}  // namespace sdk
