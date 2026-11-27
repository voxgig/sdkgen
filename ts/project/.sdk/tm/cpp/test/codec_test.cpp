// Every form, multipart and raw point this SDK has, driven through a real
// entity operation. This SDK ships no transport, so the request is taken
// where it leaves the SDK, at system.fetch, which records it and answers.
// The cases come from the client's own config, so no case names an entity.

#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "../core/sdk.hpp"

using namespace sdk;

namespace {

struct Answer {
  std::string type = "application/json";
  std::string body = "{\"id\":\"p1\"}";
};

struct Arrived {
  bool seen = false;
  std::string type;
  std::string body;
};

Answer ANSWER;
Arrived ARRIVED;

std::string headerOf(const Value& headers, const std::string& name) {
  if (!headers.is_map()) return "";
  for (const auto& kv : *headers.as_map()) {
    std::string key = kv.first;
    std::transform(key.begin(), key.end(), key.begin(), ::tolower);
    if (key == name && kv.second.is_string()) return kv.second.as_string();
  }
  return "";
}

Value fetchValue() {
  vs::Injector fetch = [](vs::Injection&, const Value& args, const std::string&,
                          const Value&) -> Value {
    Value def = vs::getelem(args, Value(int64_t(1)));
    ARRIVED.seen = true;
    ARRIVED.type = headerOf(getp(def, "headers"), "content-type");
    Value body = getp(def, "body");
    ARRIVED.body = body.is_string() ? body.as_string() : "";
    Value out = vmap();
    map_put(out, "status", Value(200));
    map_put(out, "statusText", Value("OK"));
    map_put(out, "headers", vmap({ { "content-type", Value(ANSWER.type) },
      { "content-length", Value(std::to_string(ANSWER.body.size())) } }));
    map_put(out, "body", Value(ANSWER.body));
    Value parsed = Value::undef();
    if (ANSWER.type == "application/json") parsed = vs::parse_json(ANSWER.body);
    map_put(out, "json", json_thunk(parsed));
    return out;
  };
  return Value(fetch);
}

// `file:<name>` NUL 0xFF CR LF `--`: a part that ends early, or is read as a
// C string, loses its tail.
std::string content(const std::string& name) {
  return "file:" + name + std::string("\0\xFF\r\n--", 6);
}

struct Part {
  std::string name;
  std::string value;
  bool file = false;
  std::string filename;
  std::string type;
  bool typed = false;

  bool operator==(const Part& o) const {
    return name == o.name && value == o.value && file == o.file && filename == o.filename &&
      typed == o.typed && type == o.type;
  }
};

Part textPart(const std::string& name, const std::string& value) {
  Part p;
  p.name = name;
  p.value = value;
  return p;
}

std::string paramOf(const std::string& head, const std::string& key, bool* found) {
  std::size_t at = head.find(key);
  *found = std::string::npos != at;
  if (!*found) return "";
  at += key.size();
  return head.substr(at, head.find('"', at) - at);
}

bool multipartParts(std::vector<Part>& out) {
  std::size_t b = ARRIVED.type.find("boundary=");
  if (std::string::npos == b) return false;
  std::string delim = "--" + ARRIVED.type.substr(b + 9);
  const std::string& body = ARRIVED.body;
  std::string close = delim + "--\r\n";
  if (body.size() < close.size() || 0 != body.compare(body.size() - close.size(), close.size(), close)) {
    return false;
  }
  std::size_t at = body.find(delim);
  while (std::string::npos != at) {
    std::size_t start = at + delim.size();
    std::size_t next = body.find(delim, start);
    if (std::string::npos == next) break;
    if (0 != body.compare(start, 2, "\r\n")) return false;
    start += 2;
    std::size_t hend = body.find("\r\n\r\n", start);
    if (std::string::npos == hend || hend > next) return false;
    std::string head = body.substr(start, hend - start);
    Part p;
    bool found = false;
    p.name = paramOf(head, "; name=\"", &found);
    p.filename = paramOf(head, "; filename=\"", &p.file);
    std::size_t ct = head.find("Content-Type: ");
    if (std::string::npos != ct) {
      p.typed = true;
      p.type = head.substr(ct + 14, head.find('\r', ct) - ct - 14);
    }
    p.value = body.substr(hend + 4, next - (hend + 4) - 2);
    out.push_back(p);
    at = next;
  }
  return true;
}

int hexv(char c) {
  return '0' <= c && c <= '9' ? c - '0' : 'A' <= c && c <= 'F' ? c - 'A' + 10 :
    'a' <= c && c <= 'f' ? c - 'a' + 10 : -1;
}

std::string formDecode(const std::string& s) {
  std::string out;
  for (std::size_t i = 0; i < s.size(); i++) {
    if ('+' == s[i]) out += ' ';
    else if ('%' == s[i] && i + 2 < s.size() + 0 && 0 <= hexv(s[i + 1]) && 0 <= hexv(s[i + 2])) {
      out += static_cast<char>(hexv(s[i + 1]) * 16 + hexv(s[i + 2]));
      i += 2;
    } else out += s[i];
  }
  return out;
}

void formParts(std::vector<Part>& out) {
  const std::string& s = ARRIVED.body;
  std::size_t at = 0;
  while (at < s.size()) {
    std::size_t amp = s.find('&', at);
    std::string pair = s.substr(at, std::string::npos == amp ? std::string::npos : amp - at);
    std::size_t eq = pair.find('=');
    Part p;
    p.name = formDecode(pair.substr(0, eq));
    p.value = std::string::npos == eq ? "" : formDecode(pair.substr(eq + 1));
    out.push_back(p);
    if (std::string::npos == amp) break;
    at = amp + 1;
  }
}

// The arrived parts the case declares, in order, against the expected ones.
bool partsMatch(const std::vector<Part>& got, const std::vector<Part>& expect,
                const std::string& label) {
  std::vector<Part> kept;
  for (const auto& g : got) {
    if (std::any_of(expect.begin(), expect.end(), [&](const Part& e) { return e.name == g.name; })) {
      kept.push_back(g);
    }
  }
  if (kept == expect) return true;
  std::cerr << "codec: " << label << ": " << kept.size() << " part(s) arrived, " <<
    expect.size() << " expected\n";
  return false;
}

int RAN = 0;
int FAILED = 0;
std::shared_ptr<ProjectNameSDK> CLIENT;

void report(bool ok, const std::string& label, const std::string& why = "") {
  RAN++;
  if (!ok) {
    FAILED++;
    std::cerr << "codec: FAIL " << label << (why.empty() ? "" : ": " + why) << "\n";
  }
}

Value params(const Value& point) {
  Value out = vmap();
  Value parts = getp(point, "parts");
  if (!parts.is_list()) return out;
  for (const auto& p : *parts.as_list()) {
    if (!p.is_string()) continue;
    const std::string& s = p.as_string();
    if (2 < s.size() && '{' == s.front() && '}' == s.back()) {
      map_put(out, s.substr(1, s.size() - 2), Value("p1"));
    }
  }
  return out;
}

std::optional<std::string> actionOf(const Value& point) {
  Value a = getp(getp(point, "select"), "$action");
  if (a.is_string()) return a.as_string();
  return std::nullopt;
}

Value callData(const Value& point) {
  Value data = params(point);
  if (auto a = actionOf(point)) map_put(data, "$action", Value(*a));
  return data;
}

SdkEntityPtr fresh(const std::string& ename, const Value& point) {
  SdkEntityPtr e = CLIENT->entityByName(ename);
  e->data(params(point));
  e->match(params(point));
  return e;
}

SdkEntityPtr sendWith(SdkEntityPtr e, const std::string& op, const Value& data,
                      BinarySources sources) {
  if ("update" == op) return e->updateWith(data, std::move(sources), Value::undef());
  if ("patch" == op) return e->patchWith(data, std::move(sources), Value::undef());
  return e->createWith(data, std::move(sources), Value::undef());
}

void encodedCase(const std::string& ename, const std::string& op, const Value& point,
                 const std::string& label) {
  Value rb = getp(point, "body");
  bool form = "form" == as_str(getp(rb, "kind"));
  Value data = callData(point);
  BinarySources sources;
  std::vector<Part> expect;

  Value fields = getp(rb, "fields");
  if (fields.is_list()) {
    for (const auto& field : *fields.as_list()) {
      std::string name = as_str(getp(field, "name"));
      Value media = getp(field, "media");
      if (is_true(getp(field, "binary"))) {
        std::optional<std::string> type;
        if (!form) type = media.is_string() ? media.as_string() : "application/octet-stream";
        sources.push_back({ name, binary::bytes(content(name), "/local/dir/" + name + ".bin", type) });
        Part p;
        p.name = name;
        p.value = content(name);
        if (!form) {
          p.file = true;
          p.filename = name + ".bin";
          p.typed = true;
          p.type = *type;
        }
        expect.push_back(p);
      } else if (is_true(getp(field, "list"))) {
        map_put(data, name, vlist({ Value("a"), Value("b c") }));
        expect.push_back(textPart(name, "a"));
        expect.push_back(textPart(name, "b c"));
      } else if (getp(field, "join").is_string()) {
        map_put(data, name, vlist({ Value("a"), Value("b") }));
        expect.push_back(textPart(name, "a" + getp(field, "join").as_string() + "b"));
      } else {
        std::string text = "v\"" + name + "\r\n";
        map_put(data, name, Value(text));
        Part p;
        p.name = name;
        p.value = text;
        if (!form && media.is_string()) {
          p.typed = true;
          p.type = media.as_string();
        }
        expect.push_back(p);
      }
    }
  }

  ANSWER = Answer();
  ARRIVED = Arrived();
  SdkEntityPtr e = CLIENT->entityByName(ename);
  SdkEntityPtr got = sendWith(e, op, data, std::move(sources));
  std::vector<Part> parts;
  bool ok = got == e && ARRIVED.seen;
  if (ok && form) {
    ok = ARRIVED.type == as_str(getp(rb, "media"));
    formParts(parts);
  } else if (ok) {
    ok = multipartParts(parts);
  }
  report(ok && partsMatch(parts, expect, label), label);
}

void rawSendCase(const std::string& ename, const std::string& op, const Value& point,
                 const std::string& label) {
  Value rb = getp(point, "body");
  std::string media = as_str(getp(rb, "media"));
  SdkEntityPtr e = fresh(ename, point);
  ANSWER = Answer();
  ARRIVED = Arrived();
  std::string want;
  bool ok = true;
  if (is_true(getp(rb, "binary"))) {
#if CODEC_HAS_HANDLE
    want = content(label);
    SdkEntityPtr got = binaryHandle(e, actionOf(point)).put(binary::bytes(want, std::nullopt, media));
    ok = got == e;
#else
    ok = false;
#endif
  } else {
    want = "text \"" + label + "\"\n";
    Value data = callData(point);
    map_put(data, "$body", Value(want));
    sendWith(e, op, data, BinarySources());
  }
  report(ok && ARRIVED.seen && ARRIVED.body == want && ARRIVED.type == media, label);
}

void rawReadCase(const std::string& ename, const Value& point, const std::string& label) {
  Value rs = getp(point, "response");
  std::string media = as_str(getp(rs, "media"));
  SdkEntityPtr e = fresh(ename, point);
  bool ok = false;
  ANSWER.type = media;
  if (is_true(getp(rs, "binary"))) {
#if CODEC_HAS_HANDLE
    ANSWER.body = content(label);
    std::vector<uint8_t> got = binaryHandle(e, actionOf(point)).bytes();
    ok = std::string(got.begin(), got.end()) == ANSWER.body;
    if (ok) {
      std::string code;
      try {
        e->load(callData(point), Value::undef());
      } catch (const SdkErrorPtr& err) {
        code = err->code;
      }
      ok = "binary_sink_required" == code;
    }
#endif
  } else {
    ANSWER.body = "caf\xC3\xA9 " + label;
    SdkEntityPtr got = e->load(callData(point), Value::undef());
    Value body = getp(e->data(), "$body");
    ok = got == e && body.is_string() && body.as_string() == ANSWER.body;
  }
  report(ok, label);
}

std::vector<std::string> sortedKeys(const Value& m) {
  std::vector<std::string> out;
  if (m.is_map()) {
    for (const auto& kv : *m.as_map()) out.push_back(kv.first);
  }
  std::sort(out.begin(), out.end());
  return out;
}

}  // namespace

int main() {
  CLIENT = std::make_shared<ProjectNameSDK>(vmap({ { "base", Value("http://127.0.0.1:1") },
    { "system", vmap({ { "fetch", fetchValue() } }) } }));

  Value entities = getp(sharedConfig(), "entity");
  for (const auto& ename : sortedKeys(entities)) {
    if (!CLIENT->entityByName(ename)) continue;
    Value ops = getp(getp(entities, ename), "op");
    for (const auto& op : sortedKeys(ops)) {
      bool writes = "create" == op || "update" == op || "patch" == op;
      Value points = getp(getp(ops, op), "points");
      if (!points.is_list()) continue;
      for (const auto& point : *points.as_list()) {
        auto action = actionOf(point);
        std::string label = ename + "." + op + (action ? ":" + *action : "");
        std::string rbk = as_str(getp(getp(point, "body"), "kind"));
        try {
          if (writes && ("form" == rbk || "multipart" == rbk)) encodedCase(ename, op, point, label);
          if (writes && "raw" == rbk) rawSendCase(ename, op, point, label);
          if ("load" == op && "raw" == as_str(getp(getp(point, "response"), "kind"))) {
            rawReadCase(ename, point, label);
          }
        } catch (const SdkErrorPtr& err) {
          report(false, label, err->code + ": " + err->msg);
        }
      }
    }
  }

  std::cout << "codec: ran " << RAN << " case(s), " << FAILED << " failed\n";
  if (0 == RAN) std::cerr << "codec: this SDK has no point to drive\n";
  return 0 < RAN && 0 == FAILED ? 0 : 1;
}
