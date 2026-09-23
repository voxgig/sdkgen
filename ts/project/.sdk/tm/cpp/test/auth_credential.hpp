#ifndef SDK_TEST_AUTH_CREDENTIAL_HPP
#define SDK_TEST_AUTH_CREDENTIAL_HPP

#include "harness.hpp"
#include <regex>

namespace sdk {
namespace fh {
struct AuthCredential {
  std::string bag = "headers";
  std::string name;
  std::string pair;
};

inline Value authBag(SpecPtr spec, const AuthCredential& cred) {
  return cred.bag == "query" ? spec->query : spec->headers;
}

inline AuthCredential authProbe(bool basic) {
  auto client = ProjectNameSDK::testSDK(Value::undef(), fhMap({
    {"apikey", Value("K")}, {"secret", Value(basic ? "S" : "")},
    {"auth", fhMap({{"prefix", Value("Bearer")}, {"basic", Value(basic)}})}}));
  auto utility = client->getUtility();
  CtxSpec cs;
  cs.client = client.get();
  cs.utility = utility;
  auto ctx = utility->makeContext(cs, client->getRootCtx());
  ctx->spec = std::make_shared<Spec>(fhMap({{"headers", vmap()}, {"query", vmap()}}));
  utility->prepareAuth(ctx);
  for (const auto& bag : {"headers", "query"}) {
    AuthCredential cred{bag, "", ""};
    Value values = authBag(ctx->spec, cred);
    if (values.is_map() && !values.as_map()->empty()) {
      auto entry = values.as_map()->begin();
      cred.name = entry->first;
      if (cred.bag == "headers" && cred.name == "cookie" && entry->second.is_string()) {
        auto text = entry->second.as_string();
        if (std::regex_match(text, std::regex("^[^=;]+=K$")))
          cred.pair = text.substr(0, text.size() - 1);
      }
      return cred;
    }
  }
  return {};
}

inline AuthCredential authCredential() {
  auto cred = authProbe(false);
  ASSERT_EQ(cred.name.empty(), authProbe(true).name.empty(), "credential probe missed Basic auth");
  return cred;
}

inline Value authExpected(const AuthCredential& cred, const std::string& prefix, const std::string& key) {
  if (cred.name.empty()) return Value::undef();
  return Value(!cred.pair.empty() ? cred.pair + key
    : cred.bag == "headers" && !prefix.empty() ? prefix + " " + key : key);
}

inline Value authActual(SpecPtr spec, const AuthCredential& cred) {
  if (!cred.name.empty()) return getp(authBag(spec, cred), cred.name);
  ASSERT_TRUE(spec->headers.as_map()->empty() && spec->query.as_map()->empty(), "public API placed a credential");
  return Value::undef();
}

inline bool authContains(SpecPtr spec, const AuthCredential& cred) {
  if (!cred.name.empty()) return map_contains(authBag(spec, cred), cred.name);
  authActual(spec, cred);
  return false;
}

inline SpecPtr authSeed(const AuthCredential& cred) {
  auto spec = std::make_shared<Spec>(fhMap({{"headers", vmap()}, {"query", vmap()}}));
  if (!cred.name.empty()) setp(authBag(spec, cred), cred.name, authExpected(cred, "", "stale"));
  return spec;
}

inline Value retargetAuth(const Value& node, const AuthCredential& cred) {
  if (node.is_list()) {
    Value out = vlist();
    for (const auto& val : *node.as_list()) out.as_list()->push_back(retargetAuth(val, cred));
    return out;
  }
  if (!node.is_map()) return node;
  Value out = vmap();
  for (const auto& entry : *node.as_map()) {
    if (entry.first == "headers" && entry.second.is_map()) {
      Value headers = vmap();
      for (const auto& field : *entry.second.as_map())
        if (field.first != "authorization") setp(headers, field.first, field.second);
      setp(out, "headers", headers);
    } else setp(out, entry.first, retargetAuth(entry.second, cred));
  }
  Value headers = getp(node, "headers");
  if (headers.is_map() && map_contains(headers, "authorization") && !cred.name.empty()) {
    Value bag = getp(out, cred.bag);
    if (!bag.is_map()) { bag = vmap(); setp(out, cred.bag, bag); }
    Value value = getp(headers, "authorization");
    if (!cred.pair.empty() && value.is_string()) value = authExpected(cred, "", value.as_string());
    setp(bag, cred.name, value);
  }
  return out;
}
}
}
#endif
