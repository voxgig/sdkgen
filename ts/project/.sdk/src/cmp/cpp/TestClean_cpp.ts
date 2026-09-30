import {
  Content,
  File,
  cmp,
  each,
  entityCollection,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import { cppVarName } from './utility_cpp'


// The canary sweep (see TestClean_ts). cpp has no reflection, so the
// operations the ts sweep discovers from the client are emitted from the
// model, and the transport is scripted through `system.fetch`, the seam a
// closed options union leaves for it.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$

  const ProjectName = model.const.Name

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  const rank: Record<string, number> = { list: 0, load: 1 }
  const candidates: { name: string, accessor: string, op: string }[] = []
  each(entityCollection(model))
    .filter((e: any) => false !== e.active)
    .forEach((entity: any) => {
      const ops = Object.keys(entity.op || {})
        .filter((op) => ['list', 'load', 'create', 'update', 'remove'].includes(op))
        .sort((a, b) => (rank[a] ?? 2) - (rank[b] ?? 2))
      for (const op of ops) {
        candidates.push({ name: entity.name + '.' + op, accessor: cppVarName(entity.name), op })
      }
    })

  File({ name: 'clean_test.cpp' }, () => Content(render(ProjectName, auth, candidates)))
})


function candidate(ProjectName: string, c: { name: string, accessor: string, op: string }): string {
  const call = 'list' === c.op
    ? `auto ents = c.${c.accessor}()->list(vmap(), ctrl);
      Value out = vlist();
      for (const auto& e : ents) out.as_list()->push_back(e->data());
      return out;`
    : `return c.${c.accessor}()->${c.op}(vmap(), ctrl)->data();`
  return `    {"${c.name}", [](${ProjectName}SDK& c, const Value& ctrl) -> Value {
      ${call}
    }},`
}


function render(
  ProjectName: string,
  auth: { suppressed: boolean, where: string, name: string, basic: boolean },
  candidates: { name: string, accessor: string, op: string }[],
): string {
  return `// Generated canary sweep: no credential leaves this SDK in any form.
// Mirrors test/clean.test.ts in the ts reference. Do not hand-edit.

#include <functional>
#include <iostream>
#include <map>
#include <string>
#include <vector>

#include "testlib.hpp"

using namespace sdk;

// Generated: the credential's wire placement is fixed when the SDK is built.
static const bool AUTH_SUPPRESSED = ${auth.suppressed ? 'true' : 'false'};
static const std::string AUTH_WHERE = ${cppstr(auth.where)};
static const std::string AUTH_NAME = ${cppstr(auth.name)};

static const std::string CANARY_APIKEY = "CANARY-APIKEY-k9x2m7q4p1";
static const std::string CANARY_SECRET = "CANARY-SECRET-w3e8r5t2y6";
static const std::string CANARY_HEADER = "CANARY-HEADER-z1x4c7v0b3";
static const std::string CANARY_VALUE = "CANARY-VALUE-n5m8b2v9c4";

static const std::string MASK = "[redacted]";


struct Sink {
  std::string name;
  std::string text;
};


// Every form a canary can travel in.
static std::vector<std::string> canaryForms() {
  std::vector<std::string> out;
  for (const std::string& v : {CANARY_APIKEY, CANARY_SECRET, CANARY_HEADER, CANARY_VALUE}) {
    out.push_back(v);
    out.push_back(util::cleanBase64(v));
    out.push_back(Struct::escurl(Value(v)));
  }
  out.push_back(util::cleanBase64(CANARY_APIKEY + ":" + CANARY_SECRET));
  return out;
}


static std::vector<std::string> leaks(const std::string& text) {
  std::vector<std::string> out;
  for (const auto& f : canaryForms()) {
    if (std::string::npos != text.find(f)) out.push_back(f);
  }
  return out;
}


// Header maps keep the caller's spelling; the assertion should not care.
static Value header(const Value& map, const std::string& name) {
  if (!map.is_map()) return Value::undef();
  std::string lname = name;
  for (auto& c : lname) c = static_cast<char>(std::tolower((unsigned char)c));
  for (const auto& kv : *map.as_map()) {
    std::string k = kv.first;
    for (auto& c : k) c = static_cast<char>(std::tolower((unsigned char)c));
    if (k == lname) return kv.second;
  }
  return Value::undef();
}


static bool endsWith(const std::string& s, const std::string& suf) {
  return s.size() >= suf.size() && 0 == s.compare(s.size() - suf.size(), suf.size(), suf);
}


static void addForms(std::vector<Sink>& sinks, const std::string& name, const Value& val) {
  sinks.push_back({name + ":json", vs::jsonify(val, 0)});
  sinks.push_back({name + ":string", Struct::stringify(val)});
}


static void addError(std::vector<Sink>& sinks, const std::string& name, const SdkErrorPtr& err) {
  sinks.push_back({name + ":what", std::string(err->what())});
  sinks.push_back({name + ":string", err->to_string()});
  addForms(sinks, name + ":value", err->toValue());
  addForms(sinks, name + ":spec", err->spec);
  addForms(sinks, name + ":result", err->result);
}


// Captures the serialised context from inside the pipeline: what a hook
// author would hand to a logger.
class CaptureFeature : public BaseFeature {
public:
  std::vector<Sink>* sinks;
  explicit CaptureFeature(std::vector<Sink>* sinks_)
      : BaseFeature("capture", "0.0.1", true), sinks(sinks_) {}
  void preRequest(CtxPtr ctx) override { sinks->push_back({"ctx@PreRequest", ctx->to_string()}); }
  void preResponse(CtxPtr ctx) override { sinks->push_back({"ctx@PreResponse", ctx->to_string()}); }
  void preUnexpected(CtxPtr ctx) override { sinks->push_back({"ctx@PreUnexpected", ctx->to_string()}); }
};


// A sink callable: records every form of the record it receives.
static Value capture(std::vector<Sink>* sinks, const std::string& name, int at) {
  vs::Injector fn = [sinks, name, at](vs::Injection&, const Value& args, const std::string&,
                                      const Value&) -> Value {
    addForms(*sinks, name, vs::getelem(args, Value(int64_t(at))));
    return Value::undef();
  };
  return Value(fn);
}


static Value response(int status, const Value& data, const Value& headers) {
  Value h = vmap({{"content-type", Value("application/json")}});
  if (headers.is_map()) {
    for (const auto& kv : *headers.as_map()) map_put(h, kv.first, kv.second);
  }
  Value out = vmap();
  map_put(out, "status", Value(status));
  map_put(out, "statusText", Value(status < 400 ? "OK" : "ERR"));
  map_put(out, "body", Value(vs::jsonify(data, 0)));
  map_put(out, "json", json_thunk(data));
  map_put(out, "headers", h);
  return out;
}


struct Scenario {
  std::string name;
  std::function<Value(const std::string&, const Value&)> respond;
};


static std::vector<Scenario> scenarios() {
  return {
    {"ok", [](const std::string&, const Value&) {
      return response(200, vmap({{"id", Value("i1")}, {"name", Value("n1")}}),
                      vmap({{"x-session-token", Value("RESP-TOKEN-a1b2c3d4e5")}}));
    }},
    {"notfound", [](const std::string&, const Value&) {
      return response(404, vmap({{"error", Value("no such record")}}), Value::undef());
    }},
    {"server", [](const std::string&, const Value&) {
      return response(500, vmap({{"error", Value("boom")}}), Value::undef());
    }},
    {"transport", [](const std::string& url, const Value&) -> Value {
      throw std::make_shared<SdkError>("fetch_fail",
        "socket hang up (URL was: \\"" + url + "\\")", nullptr);
    }},
    {"notjson", [](const std::string&, const Value&) {
      vs::Injector broken = [](vs::Injection&, const Value&, const std::string&,
                               const Value&) -> Value {
        throw std::make_shared<SdkError>("json_parse", "Unexpected token < in JSON", nullptr);
      };
      Value out = vmap();
      map_put(out, "status", Value(200));
      map_put(out, "statusText", Value("OK"));
      map_put(out, "body", Value("<html>"));
      map_put(out, "json", Value(broken));
      map_put(out, "headers", vmap());
      return out;
    }},
  };
}


static bool hasFeature(const std::string& name) {
  Value fm = Helpers::toMapAny(getp(sharedConfig(), "feature"));
  return fm.is_map() && !getp(fm, name).is_undef();
}


static std::shared_ptr<${ProjectName}SDK> makeSdk(const Scenario& scenario, std::vector<Sink>* sinks,
                                              const Value& cleanopts) {
  Value feature = vmap();
  if (hasFeature("log")) {
    // The log feature hands [level, record] to its logger.
    map_put(feature, "log", vmap({{"active", Value(true)}, {"logger", capture(sinks, "log", 1)}}));
  }
  if (hasFeature("debug")) {
    map_put(feature, "debug", vmap({{"active", Value(true)}, {"onEntry", capture(sinks, "debug", 0)}}));
  }
  if (hasFeature("audit")) {
    map_put(feature, "audit", vmap({{"active", Value(true)}, {"sink", capture(sinks, "audit", 0)}}));
  }
  if (hasFeature("telemetry")) {
    map_put(feature, "telemetry", vmap({{"active", Value(true)}, {"exporter", capture(sinks, "telemetry", 0)}}));
  }
  if (hasFeature("cost")) {
    map_put(feature, "cost", vmap({{"active", Value(true)}, {"sink", capture(sinks, "cost", 0)}}));
  }
  if (hasFeature("metrics")) map_put(feature, "metrics", vmap({{"active", Value(true)}}));
  if (hasFeature("clienttrack")) map_put(feature, "clienttrack", vmap({{"active", Value(true)}}));

  Scenario sc = scenario;
  vs::Injector fetch = [sc](vs::Injection&, const Value& args, const std::string&,
                            const Value&) -> Value {
    Value url = vs::getelem(args, Value(int64_t(0)));
    Value fetchdef = vs::getelem(args, Value(int64_t(1)));
    return sc.respond(url.is_string() ? url.as_string() : "", fetchdef);
  };

  Value clean = vmap({{"values", Value(CANARY_VALUE)}});
  if (cleanopts.is_map()) {
    for (const auto& kv : *cleanopts.as_map()) map_put(clean, kv.first, kv.second);
  }

  Value opts = vmap({
    {"apikey", Value(CANARY_APIKEY)},
    {"secret", Value(CANARY_SECRET)},
    {"headers", vmap({{"X-Custom-Token", Value(CANARY_HEADER)}})},
    {"clean", clean},
    {"feature", feature},
    {"system", vmap({{"fetch", Value(fetch)}})},
  });
  auto sdk = std::make_shared<${ProjectName}SDK>(opts);
  sdk->getRootCtx()->utility->featureAdd(sdk->getRootCtx(), std::make_shared<CaptureFeature>(sinks));
  return sdk;
}


struct Candidate {
  std::string name;
  std::function<Value(${ProjectName}SDK&, const Value&)> run;
};


// Generated from the model: every operation the active entities declare.
static std::vector<Candidate> candidates() {
  return {
${candidates.map((c) => candidate(ProjectName, c)).join('\n')}
  };
}


// The first operation that completes against a plain 200 with no arguments.
static int usableOp(const std::vector<Candidate>& cands) {
  vs::Injector fetch = [](vs::Injection&, const Value&, const std::string&, const Value&) -> Value {
    return response(200, vmap({{"id", Value("i1")}}), Value::undef());
  };
  Value opts = vmap({
    {"apikey", Value(CANARY_APIKEY)},
    {"system", vmap({{"fetch", Value(fetch)}})},
  });
  auto plain = std::make_shared<${ProjectName}SDK>(opts);
  for (size_t i = 0; i < cands.size(); i++) {
    try {
      cands[i].run(*plain, vmap());
      return static_cast<int>(i);
    } catch (const SdkErrorPtr&) {
      continue;
    } catch (const std::exception&) {
      continue;
    }
  }
  return -1;
}


static SdkErrorPtr drive(${ProjectName}SDK& sdk, const Candidate& cand, const Value& ctrl,
                         std::vector<Sink>& sinks) {
  SdkErrorPtr err;
  Value out = Value::undef();
  bool got = false;
  try {
    out = cand.run(sdk, ctrl);
    got = true;
  } catch (const SdkErrorPtr& e) {
    err = e;
  }
  if (err) addError(sinks, "error", err);
  if (got) addForms(sinks, "result", out);
  Value explain = getp(ctrl, "explain");
  if (explain.is_map()) addForms(sinks, "explain", explain);
  return err;
}


struct Variant {
  std::string name;
  std::function<Value()> ctrl;
};


static std::vector<Variant> variants() {
  return {
    {"throw", []() { return vmap(); }},
    {"explain", []() { return vmap({{"explain", vmap()}}); }},
    {"nothrow", []() { return vmap({{"throw", Value(false)}, {"explain", vmap()}}); }},
  };
}


static void no_credential_leaves_the_sdk() {
  std::vector<Candidate> cands = candidates();
  int target = usableOp(cands);
  ASSERT_TRUE(0 <= target, "no operation completes without arguments; nothing to sweep");
  if (0 > target) return;

  std::vector<Sink> sinks;
  std::map<std::string, SdkErrorPtr> errors;
  std::map<std::string, Value> explains;

  for (const Scenario& scenario : scenarios()) {
    for (const Variant& variant : variants()) {
      auto sdk = makeSdk(scenario, &sinks, Value::undef());
      Value ctrl = variant.ctrl();
      SdkErrorPtr err = drive(*sdk, cands[target], ctrl, sinks);
      std::string key = scenario.name + "/" + variant.name;
      if (err) errors[key] = err;
      Value explain = getp(ctrl, "explain");
      if (explain.is_map()) explains[key] = explain;
      sinks.push_back({"sdk:string", sdk->to_string()});
    }
  }

  std::string leaked;
  int leakcount = 0;
  for (const Sink& s : sinks) {
    std::vector<std::string> found = leaks(s.text);
    if (found.empty()) continue;
    leakcount++;
    if (!leaked.empty()) leaked += "; ";
    leaked += s.name + " [";
    for (size_t i = 0; i < found.size(); i++) leaked += (0 < i ? ", " : "") + found[i];
    leaked += "]";
  }

  std::cout << "clean: swept " << sinks.size() << " surface(s), " << leakcount << " leak(s)"
            << std::endl;

  ASSERT_EQ(leakcount, 0, "credential leaked through: " + leaked);

  // The positive half: the slot the credential travelled in is masked, and
  // an unregistered token in a response header is masked by name.
  auto nf = errors.find("notfound/throw");
  ASSERT_TRUE(errors.end() != nf, "the 404 scenario must throw");
  if (errors.end() != nf) {
    SdkErrorPtr notfound = nf->second;
    ASSERT_EQ(notfound->status, 404, "the 404 scenario reports its status");
    Value spec = notfound->spec;
    if (!AUTH_SUPPRESSED) {
      if ("query" == AUTH_WHERE) {
        ASSERT_EQ_VAL(header(getp(spec, "query"), AUTH_NAME), Value(MASK), "query credential masked");
      } else if ("cookie" == AUTH_WHERE) {
        std::string cookie = Struct::stringify(header(getp(spec, "headers"), "cookie"));
        ASSERT_TRUE(std::string::npos != cookie.find(MASK), "cookie: " + cookie);
      } else {
        std::string cred = Struct::stringify(header(getp(spec, "headers"), AUTH_NAME));
        ASSERT_TRUE(endsWith(cred, MASK), AUTH_NAME + ": " + cred);
      }
    }
    ASSERT_EQ_VAL(header(getp(spec, "headers"), "x-custom-token"), Value(MASK),
                  "custom token header masked");
  }

  auto ex = explains.find("ok/explain");
  Value result = explains.end() == ex ? Value::undef() : getp(ex->second, "result");
  ASSERT_TRUE(result.is_map(), "the explain record should carry the result");
  ASSERT_EQ_VAL(header(getp(result, "headers"), "x-session-token"), Value(MASK),
                "response token header masked");
}


static void the_sweep_can_see_a_leak() {
  std::vector<Candidate> cands = candidates();
  int target = usableOp(cands);
  ASSERT_TRUE(0 <= target, "no operation completes without arguments");
  if (0 > target) return;

  std::vector<Sink> sinks;
  auto sdk = makeSdk(scenarios()[1], &sinks, vmap({{"active", Value(false)}}));
  SdkErrorPtr err = drive(*sdk, cands[target], vmap(), sinks);
  ASSERT_TRUE((bool)err, "the 404 scenario must throw");
  if (!err) return;

  int leaked = 0;
  for (const Sink& s : sinks) {
    if (!leaks(s.text).empty()) leaked++;
  }
  ASSERT_TRUE(0 < leaked, "with clean off, nothing showed the canary: the sweep is blind");

  if (!AUTH_SUPPRESSED) {
    std::string text = vs::jsonify(err->spec, 0);
    ASSERT_TRUE(std::string::npos != text.find(CANARY_APIKEY) ||
                std::string::npos != text.find(util::cleanBase64(CANARY_APIKEY + ":" + CANARY_SECRET)),
                "the raw spec should carry the credential when clean is off");
  }
}


int main() {
  T_RUN(no_credential_leaves_the_sdk);
  T_RUN(the_sweep_can_see_a_leak);
  return sdktest::summary("clean_test");
}
`
}


function cppstr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}


export {
  TestClean
}
