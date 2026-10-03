// ProjectName SDK: the cookie header, read one way everywhere.
#pragma once

#include <string>
#include <vector>

namespace sdk {
namespace util {

// The caller's cookie pieces with every named cookie removed. A piece whose
// &-parts are all pairs is the exploded form cookiePair writes, and loses
// only the pairs named; any other piece is one cookie, kept or dropped whole.
inline std::vector<std::string> cookieKeep(const std::string& header, const std::vector<std::string>& names) {
  auto trim = [](const std::string& s) {
    size_t a = s.find_first_not_of(" \t");
    size_t b = s.find_last_not_of(" \t");
    return std::string::npos == a ? std::string() : s.substr(a, b - a + 1);
  };
  auto split = [](const std::string& s, char sep) {
    std::vector<std::string> parts;
    size_t at = 0;
    while (true) {
      size_t end = s.find(sep, at);
      parts.push_back(s.substr(at, (std::string::npos == end ? s.size() : end) - at));
      if (std::string::npos == end) return parts;
      at = end + 1;
    }
  };
  auto named = [&](const std::string& part) {
    std::string name = trim(part.substr(0, part.find('=')));
    for (const auto& n : names) {
      if (n == name) return true;
    }
    return false;
  };
  std::vector<std::string> kept;
  for (const auto& piece : split(header, ';')) {
    std::vector<std::string> parts = split(piece, '&');
    bool pairs = true;
    for (const auto& part : parts) {
      if (std::string::npos == part.find('=')) pairs = false;
    }
    std::string rest;
    if (pairs) {
      for (const auto& part : parts) {
        if (!named(part)) rest += (rest.empty() ? "" : "&") + part;
      }
    } else if (!named(piece)) {
      rest = piece;
    }
    std::string cookie = trim(rest);
    if (!cookie.empty()) kept.push_back(cookie);
  }
  return kept;
}

}  // namespace util
}  // namespace sdk
