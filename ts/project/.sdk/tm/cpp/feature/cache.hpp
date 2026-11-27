// ProjectName SDK — cache feature (mirrors java feature/CacheFeature.java).
// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.
// No HMAC in std: SipHash-2-4 under a random per-client key separates header
// sets within one store without holding a header value. It is not a
// cryptographic commitment.

#ifndef SDK_FEATURE_CACHE_HPP
#define SDK_FEATURE_CACHE_HPP

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <map>
#include <random>
#include <string>
#include <utility>
#include <vector>

#include "../core/types.hpp"
#include "../utility/pipeline.hpp"
#include "base.hpp"
#include "options.hpp"

namespace sdk {

class CacheFeature : public BaseFeature {
public:
  SdkClient* client = nullptr;
  Value options = Value::undef();

  // Activity tracking (mirrors the ts client._cache record).
  int hit = 0;
  int miss = 0;
  int bypass = 0;

  CacheFeature() : BaseFeature("cache", "0.0.1", true) {}

  static uint64_t le64(const uint8_t* p) {
    uint64_t v = 0;
    for (int i = 7; i >= 0; i--) v = (v << 8) | p[i];
    return v;
  }

  static uint64_t rotl(uint64_t x, int b) { return (x << b) | (x >> (64 - b)); }

  static void sipround(uint64_t& v0, uint64_t& v1, uint64_t& v2, uint64_t& v3) {
    v0 += v1; v1 = rotl(v1, 13); v1 ^= v0; v0 = rotl(v0, 32);
    v2 += v3; v3 = rotl(v3, 16); v3 ^= v2;
    v0 += v3; v3 = rotl(v3, 21); v3 ^= v0;
    v2 += v1; v1 = rotl(v1, 17); v1 ^= v2; v2 = rotl(v2, 32);
  }

  static uint64_t siphash24(const uint8_t key[16], const std::string& in) {
    const uint8_t* p = reinterpret_cast<const uint8_t*>(in.data());
    size_t len = in.size();
    uint64_t k0 = le64(key), k1 = le64(key + 8);
    uint64_t v0 = 0x736f6d6570736575ULL ^ k0, v1 = 0x646f72616e646f6dULL ^ k1;
    uint64_t v2 = 0x6c7967656e657261ULL ^ k0, v3 = 0x7465646279746573ULL ^ k1;
    size_t full = len - (len % 8);
    for (size_t i = 0; i < full; i += 8) {
      uint64_t m = le64(p + i);
      v3 ^= m;
      sipround(v0, v1, v2, v3);
      sipround(v0, v1, v2, v3);
      v0 ^= m;
    }
    uint64_t b = static_cast<uint64_t>(len) << 56;
    for (size_t i = 0; i < len % 8; i++) b |= static_cast<uint64_t>(p[full + i]) << (8 * i);
    v3 ^= b;
    sipround(v0, v1, v2, v3);
    sipround(v0, v1, v2, v3);
    v0 ^= b;
    v2 ^= 0xff;
    for (int i = 0; i < 4; i++) sipround(v0, v1, v2, v3);
    return v0 ^ v1 ^ v2 ^ v3;
  }

  void init(CtxPtr ctx, const Value& options_) override {
    client = ctx->client;
    options = options_;
    active = fopt::foptBool(options, "active", false);
    if (!active) return;

    store.clear();
    order.clear();
    std::random_device rd;
    for (auto& b : secret) b = static_cast<uint8_t>(rd() & 0xff);

    auto inner = ctx->utility->fetcher;
    ctx->utility->fetcher = [this, inner](CtxPtr ctx2, const std::string& url,
                                          const Value& fetchdef) -> Value {
      return through(ctx2, url, fetchdef, inner);
    };
  }

private:
  struct CacheSnapshot {
    int status = 0;
    std::string statusText = "";
    Value data = Value::undef();
    Value headers = vmap();
  };

  struct CacheEntry {
    long long expiry = 0;
    std::string scope;
    CacheSnapshot snapshot;
  };

  std::map<std::string, CacheEntry> store;
  std::vector<std::string> order;
  uint8_t secret[16] = {0};

  static std::string upper(std::string s) {
    for (auto& c : s) c = static_cast<char>(std::toupper((unsigned char)c));
    return s;
  }

  Value through(CtxPtr ctx, const std::string& url, const Value& fetchdef,
                std::function<Value(CtxPtr, const std::string&, const Value&)> inner) {
    std::string method = "GET";
    Value m = getp(fetchdef, "method");
    if (m.is_string() && !m.as_string().empty()) {
      method = upper(m.as_string());
    }

    std::vector<std::string> methods = fopt::foptStrList(options, "methods");
    if (!fopt::foptList(options, "methods").is_list()) {
      methods = {"GET"};
    }
    bool cacheable = false;
    for (const auto& cm : methods) {
      if (upper(cm) == method) {
        cacheable = true;
        break;
      }
    }
    if (!cacheable) {
      if (method == "GET" || method == "HEAD") {
        return inner(ctx, url, fetchdef);
      }
      struct Invalidate {
        CacheFeature* self;
        const std::string& url;
        ~Invalidate() { self->invalidate(url); }
      } after{this, url};
      return inner(ctx, url, fetchdef);
    }

    std::string key = method + " " + url + " " + digest(getp(fetchdef, "headers"));
    long long now = fopt::foptNow(options)();

    auto it = store.find(key);
    if (it != store.end() && it->second.expiry > now) {
      hit++;
      return replay(it->second.snapshot);
    }

    Value res;
    try {
      res = inner(ctx, url, fetchdef);
    } catch (const SdkErrorPtr& err) {
      bypass++;
      throw err;
    }

    if (storable(res) && json(res)) {
      CacheSnapshot snap = snapshot(res);
      long long ttl = lifetime(snap.headers, fopt::foptInt(options, "ttl", 5000));
      if (ttl <= 0) {
        bypass++;
        return replay(snap);
      }
      drop(key);
      evict();
      CacheEntry entry;
      entry.expiry = now + ttl;
      entry.scope = urlScope(url);
      entry.snapshot = snap;
      store[key] = entry;
      order.push_back(key);
      miss++;
      return replay(snap);
    }

    bypass++;
    return res;
  }

  static std::string lower(std::string s) {
    for (auto& c : s) c = static_cast<char>(std::tolower((unsigned char)c));
    return s;
  }

  static bool headerText(const Value& v, std::string& out) {
    if (v.is_string()) { out = v.as_string(); return true; }
    if (v.is_int()) { out = std::to_string(v.as_int()); return true; }
    if (v.is_double()) {
      double d = v.as_double();
      char buf[64];
      if (d == static_cast<double>(static_cast<long long>(d))) {
        std::snprintf(buf, sizeof(buf), "%lld", static_cast<long long>(d));
      } else {
        std::snprintf(buf, sizeof(buf), "%g", d);
      }
      out = buf;
      return true;
    }
    if (v.is_bool()) { out = v.as_bool() ? "true" : "false"; return true; }
    return false;
  }

  std::string digest(const Value& headers) {
    std::vector<std::pair<std::string, std::string>> pairs;
    if (headers.is_map()) {
      for (const auto& kv : *headers.as_map()) {
        std::string text;
        if (headerText(kv.second, text)) pairs.emplace_back(lower(kv.first), text);
      }
    }
    std::sort(pairs.begin(), pairs.end());
    std::string text;
    for (const auto& p : pairs) text += p.first + ":" + p.second + "\n";
    char hex[17];
    std::snprintf(hex, sizeof(hex), "%016llx",
                  static_cast<unsigned long long>(siphash24(secret, text)));
    return std::string(hex);
  }

  void invalidate(const std::string& url) {
    std::string path = urlScope(url);
    std::string collection = urlParent(path);
    std::vector<std::string> dropped;
    for (const auto& kv : store) {
      if (under(kv.second.scope, path) || kv.second.scope == collection) dropped.push_back(kv.first);
    }
    for (const auto& key : dropped) drop(key);
  }

  void drop(const std::string& key) {
    if (store.erase(key) > 0) {
      order.erase(std::remove(order.begin(), order.end(), key), order.end());
    }
  }

  static std::string trim(const std::string& s) {
    size_t a = 0, b = s.size();
    while (a < b && std::isspace((unsigned char)s[a])) a++;
    while (b > a && std::isspace((unsigned char)s[b - 1])) b--;
    return s.substr(a, b - a);
  }

  // The configured ttl capped by the response's Cache-Control; zero when the
  // response may not be stored.
  static long long lifetime(const Value& headers, long long ttl) {
    std::string control;
    if (headers.is_map()) {
      for (const auto& kv : *headers.as_map()) {
        std::string text;
        if (lower(kv.first) == "cache-control" && headerText(kv.second, text)) control = lower(text);
      }
    }
    long long life = ttl;
    size_t start = 0;
    while (start <= control.size()) {
      size_t comma = control.find(',', start);
      std::string directive = trim(control.substr(start, comma == std::string::npos ? std::string::npos : comma - start));
      if (directive == "no-store" || directive == "private" || directive == "no-cache") return 0;
      if (directive.rfind("max-age", 0) == 0) {
        std::string value = trim(directive.substr(7));
        if (!value.empty() && value[0] == '=') {
          value = trim(value.substr(1));
          if (value.size() >= 2 && value.front() == '"' && value.back() == '"') value = value.substr(1, value.size() - 2);
          if (!value.empty() && value.size() < 16 &&
              std::all_of(value.begin(), value.end(), [](char c) { return std::isdigit((unsigned char)c); })) {
            life = std::min(life, std::stoll(value) * 1000);
          }
        }
      }
      if (comma == std::string::npos) break;
      start = comma + 1;
    }
    return life;
  }

  static std::string urlScope(const std::string& url) {
    std::string out = url.substr(0, url.find_first_of("?#"));
    while (!out.empty() && out.back() == '/') out.pop_back();
    return out;
  }

  static std::string urlParent(const std::string& scope) {
    size_t root = 0;
    size_t scheme = scope.find("://");
    if (scheme != std::string::npos) {
      root = scope.find('/', scheme + 3);
      if (root == std::string::npos) return scope;
    }
    size_t cut = scope.rfind('/');
    if (cut == std::string::npos || cut < root) cut = root;
    return scope.substr(0, cut);
  }

  static bool under(const std::string& scope, const std::string& prefix) {
    return scope == prefix || scope.rfind(prefix + "/", 0) == 0;
  }

  // A body the transport could not read as JSON passes through, for the operation to report.
  bool storable(const Value& res) {
    int status = fopt::fresStatus(res);
    Value unreadable = getp(res, "unreadable");
    return status >= 200 && status < 300 && !(unreadable.is_bool() && unreadable.as_bool());
  }

  // A body that declares another type than JSON passes by, unread.
  bool json(const Value& res) {
    Value headers = getp(res, "headers");
    if (!headers.is_map()) return true;
    for (const auto& kv : *headers.as_map()) {
      if (util::mediaLower(kv.first) != "content-type" || !kv.second.is_string()) continue;
      return std::string::npos == kv.second.as_string().find_first_not_of(" \t") ||
             util::isJsonMedia(kv.second);
    }
    return true;
  }

  CacheSnapshot snapshot(const Value& res) {
    CacheSnapshot snap;

    int status = fopt::fresStatus(res);
    if (status >= 0) snap.status = status;

    if (res.is_map()) {
      Value st = getp(res, "statusText");
      if (st.is_string()) snap.statusText = st.as_string();

      Value jf = mapget(res, "json");
      if (jf.is_injector()) {
        vs::Injection inj(Value::undef(), Value::undef());
        snap.data = jf.as_injector()(inj, Value::undef(), std::string(""), Value::undef());
      }

      Value headers = getp(res, "headers");
      if (headers.is_map()) {
        for (const auto& kv : *headers.as_map()) {
          std::string lk = kv.first;
          for (auto& c : lk) c = static_cast<char>(std::tolower((unsigned char)c));
          map_put(snap.headers, lk, kv.second);
        }
      }
    }

    return snap;
  }

  // replay builds a fresh transport-shaped response so the body stays
  // re-readable for every consumer.
  Value replay(const CacheSnapshot& snap) {
    Value out = vmap();
    map_put(out, "status", Value(snap.status));
    map_put(out, "statusText", Value(snap.statusText));
    map_put(out, "body", Value("not-used"));
    map_put(out, "json", json_thunk(snap.data));
    map_put(out, "headers", Struct::clone(snap.headers));
    return out;
  }

  // evict drops oldest entries (FIFO) until the store is under `max`.
  void evict() {
    int max = fopt::foptInt(options, "max", 256);
    while ((int) store.size() >= max && !order.empty()) {
      std::string oldest = order.front();
      order.erase(order.begin());
      store.erase(oldest);
    }
  }
};

} // namespace sdk

#endif // SDK_FEATURE_CACHE_HPP
