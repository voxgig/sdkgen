// ProjectName SDK - multipart/form-data encoder (mirrors
// utility/codec/MultipartCodec.ts). Reached through codec/index.hpp.

#pragma once

#include <cstdio>
#include <random>
#include <string>

#if defined(__linux__)
#include <sys/random.h>
#endif

#include "../binary.hpp"

namespace sdk {
namespace util {

// Sixteen bytes from the platform's cryptographic source, as lowercase hex.
inline std::string multipartBoundary(CtxPtr) {
  unsigned char bytes[16];
#if defined(__linux__)
  std::size_t got = 0;
  while (got < sizeof(bytes)) {
    ssize_t r = getrandom(bytes + got, sizeof(bytes) - got, 0);
    if (r <= 0) throw std::runtime_error("multipart boundary: no random source");
    got += static_cast<std::size_t>(r);
  }
#elif defined(__APPLE__) || defined(__FreeBSD__) || defined(__OpenBSD__) || defined(__NetBSD__)
  arc4random_buf(bytes, sizeof(bytes));
#else
  std::random_device rd;
  for (auto& b : bytes) b = static_cast<unsigned char>(rd());
#endif
  char out[2 * sizeof(bytes) + 1];
  for (std::size_t i = 0; i < sizeof(bytes); i++) std::snprintf(out + 2 * i, 3, "%02x", bytes[i]);
  return std::string(out, 2 * sizeof(bytes));
}

// Inside a quoted header parameter nothing may end the quote or the line.
inline std::string multipartQuoted(const std::string& text) {
  std::string out;
  for (char c : text) {
    if ('\\' == c) out += "%5C";
    else if ('"' == c) out += "%22";
    else if ('\r' == c) out += "%0D";
    else if ('\n' == c) out += "%0A";
    else out += c;
  }
  return out;
}

// A local path never leaves: only its last segment, and nothing for an empty one.
inline std::optional<std::string> multipartBaseName(const std::optional<std::string>& name) {
  if (!name) return std::nullopt;
  std::size_t at = name->find_last_of("/\\");
  std::string base = std::string::npos == at ? *name : name->substr(at + 1);
  if (base.empty()) return std::nullopt;
  return base;
}

inline Utility::Encoded encodeMultipart(CtxPtr ctx, const Value& data) {
  std::string boundary = ctx->utility->multipartBoundary ? ctx->utility->multipartBoundary(ctx)
                                                         : multipartBoundary(ctx);
  std::string body;
  for (const auto& item : bodyItems(ctx, data)) {
    std::optional<std::string> filename;
    std::optional<std::string> type;
    if (item.media.is_string()) type = item.media.as_string();
    if (item.binary) {
      if (item.source) {
        filename = multipartBaseName(item.source->name);
        if (item.source->type) type = item.source->type;
      }
      if (!type) type = std::string("application/octet-stream");
    }
    if (type && std::string::npos != type->find_first_of("\r\n")) {
      throw ctx->makeError("binary_source_refused", "The media type of the multipart field \"" +
        item.name + "\" contains a line break.");
    }
    body += "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" +
      multipartQuoted(item.name) + "\"";
    if (filename) body += "; filename=\"" + multipartQuoted(*filename) + "\"";
    body += "\r\n";
    if (type) body += "Content-Type: " + *type + "\r\n";
    body += "\r\n";
    body += item.content;
    body += "\r\n";
  }
  body += "--" + boundary + "--\r\n";

  std::string media = as_str(getp(getp(ctx->point, "body"), "media"));
  std::string essence = media.substr(0, media.find(';'));
  std::size_t from = essence.find_first_not_of(" \t");
  std::size_t to = essence.find_last_not_of(" \t");
  essence = std::string::npos == from ? "" : essence.substr(from, to - from + 1);
  return { (essence.empty() ? "multipart/form-data" : essence) + "; boundary=" + boundary, body };
}

}  // namespace util
}  // namespace sdk
