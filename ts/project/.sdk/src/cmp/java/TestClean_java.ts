import {
  cmp,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target } = props
  const javapackage: string = props.javapackage

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'CleanTest.' + target.ext }, () => {
    Content(render(javapackage, model.const.Name + 'SDK', auth))
  })
})


function render(jp: string, sdk: string, auth: {
  suppressed: boolean, where: string, name: string, basic: boolean
}): string {
  return `package ${jp}.sdktest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;

import org.junit.jupiter.api.Test;

import ${jp}.core.Config;
import ${jp}.core.Context;
import ${jp}.core.Entity;
import ${jp}.core.Helpers;
import ${jp}.core.${sdk};
import ${jp}.core.SdkError;
import ${jp}.core.Utility;
import ${jp}.feature.BaseFeature;
import ${jp}.utility.struct.Struct;

@SuppressWarnings({"unchecked"})
public class CleanTest {

  // Generated: the credential's wire placement is fixed when the SDK is built.
  static final boolean AUTH_SUPPRESSED = ${auth.suppressed};
  static final String AUTH_WHERE = ${JSON.stringify(auth.where)};
  static final String AUTH_NAME = ${JSON.stringify(auth.name)};
  static final boolean AUTH_BASIC = ${auth.basic};

  static final String CANARY_APIKEY = "CANARY-APIKEY-k9x2m7q4p1";
  static final String CANARY_SECRET = "CANARY-SECRET-w3e8r5t2y6";
  static final String CANARY_HEADER = "CANARY-HEADER-z1x4c7v0b3";
  static final String CANARY_VALUE = "CANARY-VALUE-n5m8b2v9c4";

  static final String MASK = "[redacted]";

  // The logger the log feature builds when handed none.
  static final String LOGGER_NAME = "${sdk}.log";

  // Every form a canary can travel in.
  static final List<String> FORMS = new ArrayList<>();

  static {
    for (String v : List.of(CANARY_APIKEY, CANARY_SECRET, CANARY_HEADER, CANARY_VALUE)) {
      FORMS.add(v);
      FORMS.add(base64(v));
      FORMS.add(URLEncoder.encode(v, StandardCharsets.UTF_8));
    }
    FORMS.add(base64(CANARY_APIKEY + ":" + CANARY_SECRET));
  }

  static String base64(String s) {
    return Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8));
  }

  static final class Sink {
    final String name;
    final String text;

    Sink(String name, String text) {
      this.name = name;
      this.text = text;
    }
  }

  static Map<String, Object> jm(Object... kv) {
    Map<String, Object> out = new LinkedHashMap<>();
    for (int i = 0; i < kv.length - 1; i += 2) {
      out.put(String.valueOf(kv[i]), kv[i + 1]);
    }
    return out;
  }

  // Header maps keep the caller's spelling; the assertion should not care.
  static Object header(Object map, String name) {
    Map<String, Object> m = Helpers.toMapAny(map);
    if (m == null) {
      return null;
    }
    for (Map.Entry<String, Object> e : m.entrySet()) {
      if (e.getKey().equalsIgnoreCase(name)) {
        return e.getValue();
      }
    }
    return null;
  }

  static List<String> leaks(String text) {
    List<String> out = new ArrayList<>();
    for (String f : FORMS) {
      if (text.contains(f)) {
        out.add(f);
      }
    }
    return out;
  }

  static boolean isFunction(Object v) {
    return v instanceof Function || v instanceof Supplier || v instanceof Consumer
        || v instanceof BiFunction || v instanceof Runnable || v instanceof Utility.CtxFn
        || v instanceof Utility.FetcherFn || v.getClass().isSynthetic();
  }

  // The SDK's JSON emitter prints only maps, lists and scalars, so the
  // sweep reads every other object the way a reflective serialiser would:
  // its public fields, plus its own toString. This is what lets the negative
  // control see the raw spec: with clean off the error carries the live Spec.
  static Object plain(Object v, int depth, IdentityHashMap<Object, Boolean> seen) {
    if (v == null || v instanceof String || v instanceof Number || v instanceof Boolean
        || v instanceof Character || v instanceof Enum) {
      return v;
    }
    if (isFunction(v)) {
      return null;
    }
    if (32 <= depth || seen.containsKey(v)) {
      return "[circular]";
    }
    seen.put(v, Boolean.TRUE);
    try {
      if (v instanceof Map) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : ((Map<?, ?>) v).entrySet()) {
          out.put(String.valueOf(e.getKey()), plain(e.getValue(), depth + 1, seen));
        }
        return out;
      }
      if (v instanceof List) {
        List<Object> out = new ArrayList<>();
        for (Object e : (List<Object>) v) {
          out.add(plain(e, depth + 1, seen));
        }
        return out;
      }
      if (v instanceof Context) {
        return plain(((Context) v).record(), depth + 1, seen);
      }
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("$string", String.valueOf(v));
      if (v instanceof Throwable) {
        out.put("$message", String.valueOf(((Throwable) v).getMessage()));
      }
      for (Field f : v.getClass().getFields()) {
        if (Modifier.isStatic(f.getModifiers())) {
          continue;
        }
        try {
          out.put(f.getName(), plain(f.get(v), depth + 1, seen));
        }
        catch (ReflectiveOperationException | RuntimeException e) {
          // unreadable field: nothing to sweep
        }
      }
      return out;
    }
    finally {
      seen.remove(v);
    }
  }

  static String stack(Throwable err) {
    StringWriter sw = new StringWriter();
    err.printStackTrace(new PrintWriter(sw));
    return sw.toString();
  }

  interface Text {
    String get();
  }

  static void push(List<Sink> out, String name, Text fn) {
    try {
      out.add(new Sink(name, fn.get()));
    }
    catch (RuntimeException e) {
      // a print that throws leaks nothing
    }
  }

  // Every print of a value: the SDK's JSON, its stringify, the object's own
  // toString; for an error also the message and the stack trace.
  static void forms(List<Sink> out, String name, Object val) {
    push(out, name + ":json", () -> Struct.jsonify(plain(val, 0, new IdentityHashMap<>())));
    push(out, name + ":stringify", () -> Struct.stringify(plain(val, 0, new IdentityHashMap<>())));
    push(out, name + ":string", () -> String.valueOf(val));
    if (val instanceof Throwable) {
      push(out, name + ":message", () -> String.valueOf(((Throwable) val).getMessage()));
      push(out, name + ":stack", () -> stack((Throwable) val));
    }
    if (val instanceof SdkError) {
      push(out, name + ":map", () -> Struct.jsonify(((SdkError) val).toMap()));
    }
    if (val instanceof Context) {
      push(out, name + ":map", () -> Struct.jsonify(((Context) val).toMap()));
    }
  }

  // A sink that is BOTH a Function and a Consumer: the option spec types a
  // callback as a function, which the struct validator recognises only as
  // Function or Supplier, while the feature reads its sink as a Consumer.
  static final class Capture implements Consumer<Map<String, Object>>, Function<Object, Object> {
    final List<Sink> sinks;
    final String name;

    Capture(List<Sink> sinks, String name) {
      this.sinks = sinks;
      this.name = name;
    }

    @Override
    public void accept(Map<String, Object> rec) {
      forms(this.sinks, this.name, rec);
    }

    @Override
    public Object apply(Object rec) {
      forms(this.sinks, this.name, rec);
      return null;
    }
  }

  // Captures the serialised context from inside the pipeline: what a hook
  // author would hand to a logger.
  static final class CaptureFeature extends BaseFeature {
    final List<Sink> sinks;

    CaptureFeature(List<Sink> sinks) {
      super("capture", "0.0.1", true);
      this.sinks = sinks;
    }

    @Override
    public void preRequest(Context ctx) {
      forms(this.sinks, "ctx@PreRequest", ctx);
    }

    @Override
    public void preResponse(Context ctx) {
      forms(this.sinks, "ctx@PreResponse", ctx);
    }

    @Override
    public void preUnexpected(Context ctx) {
      forms(this.sinks, "ctx@PreUnexpected", ctx);
    }
  }

  static boolean hasFeature(String name) {
    Map<String, Object> fm = Helpers.toMapAny(Config.makeConfig().get("feature"));
    return fm != null && fm.get(name) != null;
  }

  static Map<String, Object> response(int status, Object data, Map<String, Object> headers) {
    Map<String, Object> h = new LinkedHashMap<>();
    h.put("content-type", "application/json");
    if (headers != null) {
      h.putAll(headers);
    }
    final Object body = data;
    return jm(
        "status", status,
        "statusText", status < 400 ? "OK" : "ERR",
        "headers", h,
        "json", (Supplier<Object>) () -> body,
        "body", Struct.jsonify(body));
  }

  static final class Scenario {
    final String name;
    final Utility.FetcherFn respond;

    Scenario(String name, Utility.FetcherFn respond) {
      this.name = name;
      this.respond = respond;
    }
  }

  static final List<Scenario> SCENARIOS = List.of(
      new Scenario("ok", (ctx, url, fetchdef) ->
          response(200, jm("id", "i1", "name", "n1"), jm("x-session-token", "RESP-TOKEN-a1b2c3d4e5"))),
      new Scenario("notfound", (ctx, url, fetchdef) ->
          response(404, jm("error", "no such record"), null)),
      new Scenario("server", (ctx, url, fetchdef) ->
          response(500, jm("error", "boom"), null)),
      new Scenario("transport", (ctx, url, fetchdef) -> {
        throw new RuntimeException("socket hang up (URL was: \\"" + url + "\\")");
      }),
      new Scenario("notjson", (ctx, url, fetchdef) -> jm(
          "status", 200,
          "statusText", "OK",
          "headers", new LinkedHashMap<String, Object>(),
          "json", (Supplier<Object>) () -> {
            throw new RuntimeException("Unexpected token < in JSON");
          },
          "body", "<html>")));

  static ${sdk} makeSdk(Scenario scenario, List<Sink> sinks, Map<String, Object> cleanopts) {
    Map<String, Object> feature = new LinkedHashMap<>();
    if (hasFeature("log")) {
      feature.put("log", jm("active", true));
    }
    if (hasFeature("debug")) {
      feature.put("debug", jm("active", true, "onEntry", new Capture(sinks, "debug")));
    }
    if (hasFeature("audit")) {
      feature.put("audit", jm("active", true, "sink", new Capture(sinks, "audit")));
    }
    if (hasFeature("telemetry")) {
      feature.put("telemetry", jm("active", true, "exporter", new Capture(sinks, "telemetry")));
    }
    if (hasFeature("cost")) {
      feature.put("cost", jm("active", true, "sink", new Capture(sinks, "cost")));
    }
    if (hasFeature("metrics")) {
      feature.put("metrics", jm("active", true));
    }
    if (hasFeature("clienttrack")) {
      feature.put("clienttrack", jm("active", true));
    }

    Map<String, Object> clean = jm("values", CANARY_VALUE);
    if (cleanopts != null) {
      clean.putAll(cleanopts);
    }

    List<Object> extend = new ArrayList<>();
    extend.add(new CaptureFeature(sinks));

    Map<String, Object> opts = jm(
        "apikey", CANARY_APIKEY,
        "secret", CANARY_SECRET,
        "headers", jm("X-Custom-Token", CANARY_HEADER),
        "clean", clean,
        "feature", feature,
        "extend", extend,
        "utility", jm("fetcher", scenario.respond));
    return new ${sdk}(opts);
  }

  // Every log line the log feature emits, whichever level it chooses.
  static Handler capture(List<Sink> sinks) {
    Logger logger = Logger.getLogger(LOGGER_NAME);
    Handler handler = new Handler() {
      @Override
      public void publish(LogRecord record) {
        forms(sinks, "log." + record.getLevel().getName().toLowerCase(), record.getMessage());
      }

      @Override
      public void flush() {}

      @Override
      public void close() {}
    };
    handler.setLevel(Level.ALL);
    logger.addHandler(handler);
    return handler;
  }

  static void release(Handler handler) {
    Logger.getLogger(LOGGER_NAME).removeHandler(handler);
  }

  /** One discovered operation: the client accessor plus the entity method. */
  static final class Op {
    final Method accessor;
    final Method call;

    Op(Method accessor, Method call) {
      this.accessor = accessor;
      this.call = call;
    }
  }

  static Object invoke(${sdk} client, Op op, Map<String, Object> ctrl) throws Exception {
    Object ent = op.accessor.invoke(client, new Object[] {null});
    try {
      return op.call.invoke(ent, new LinkedHashMap<String, Object>(), ctrl);
    }
    catch (InvocationTargetException ite) {
      Throwable cause = ite.getCause();
      if (cause instanceof Exception) {
        throw (Exception) cause;
      }
      throw ite;
    }
  }

  // The first operation that completes against a plain 200 with no arguments
  // (a required path parameter would fail before the request is built).
  static Op usableOp() {
    Utility.FetcherFn ok = (ctx, url, fetchdef) -> response(200, jm("id", "i1"), null);
    Map<String, Object> plainOpts = jm("apikey", CANARY_APIKEY, "utility", jm("fetcher", ok));

    Map<String, Method> accessors = new TreeMap<>();
    ${sdk} probe = new ${sdk}(plainOpts);
    for (Method m : probe.getClass().getMethods()) {
      if (1 != m.getParameterCount() || !Map.class.isAssignableFrom(m.getParameterTypes()[0])) {
        continue;
      }
      if (!Entity.class.isAssignableFrom(m.getReturnType())) {
        continue;
      }
      String entname;
      try {
        entname = ((Entity) m.invoke(probe, new Object[] {null})).getName();
      }
      catch (Exception e) {
        continue;
      }
      if (null != entname && !entname.isEmpty()) {
        accessors.put(entname, m);
      }
    }

    for (Map.Entry<String, Method> e : accessors.entrySet()) {
      Object ent;
      try {
        ent = e.getValue().invoke(probe, new Object[] {null});
      }
      catch (Exception ex) {
        continue;
      }
      for (String opname : List.of("list", "load", "create", "update", "remove")) {
        Method call;
        try {
          call = ent.getClass().getMethod(opname, Map.class, Map.class);
        }
        catch (NoSuchMethodException ex) {
          continue;
        }
        Op op = new Op(e.getValue(), call);
        try {
          invoke(new ${sdk}(plainOpts), op, new LinkedHashMap<>());
          return op;
        }
        catch (Exception ex) {
          continue;
        }
      }
    }
    return null;
  }

  static Exception drive(${sdk} sdk, Op op, Map<String, Object> ctrl, List<Sink> sinks) {
    Object out = null;
    Exception err = null;
    try {
      out = invoke(sdk, op, ctrl);
    }
    catch (Exception e) {
      err = e;
    }
    if (err != null) {
      forms(sinks, "error", err);
    }
    if (out != null) {
      forms(sinks, "result", out);
    }
    if (ctrl.get("explain") != null) {
      forms(sinks, "explain", ctrl.get("explain"));
    }
    return err;
  }

  @Test
  public void noCredentialLeavesTheSdkInAnyForm() {
    Op op = usableOp();
    assertNotNull(op, "no operation completes without arguments; nothing to sweep");

    List<Sink> sinks = new ArrayList<>();
    Map<String, Exception> errors = new LinkedHashMap<>();
    Map<String, Map<String, Object>> explains = new LinkedHashMap<>();

    Handler handler = capture(sinks);
    try {
      for (Scenario scenario : SCENARIOS) {
        for (String variant : List.of("throw", "explain", "nothrow")) {
          Map<String, Object> ctrl = new LinkedHashMap<>();
          if (!"throw".equals(variant)) {
            ctrl.put("explain", new LinkedHashMap<String, Object>());
          }
          if ("nothrow".equals(variant)) {
            ctrl.put("throw", false);
          }
          ${sdk} sdk = makeSdk(scenario, sinks, null);
          Exception err = drive(sdk, op, ctrl, sinks);
          String key = scenario.name + "/" + variant;
          if (err != null) {
            errors.put(key, err);
          }
          if (ctrl.get("explain") != null) {
            explains.put(key, (Map<String, Object>) ctrl.get("explain"));
          }
          forms(sinks, "sdk", sdk);
        }
      }
    }
    finally {
      release(handler);
    }

    List<String> leaked = new ArrayList<>();
    for (Sink s : sinks) {
      List<String> found = leaks(s.text);
      if (!found.isEmpty()) {
        leaked.add(s.name + " [" + String.join(", ", found) + "]");
      }
    }

    System.out.println("clean: swept " + sinks.size() + " surface(s), " + leaked.size() + " leak(s)");

    assertEquals(0, leaked.size(), "credential leaked through: " + String.join("; ", leaked));

    // The positive half: the slot the credential travelled in is masked,
    // and an unregistered token in a response header is masked by name.
    Exception notfound = errors.get("notfound/throw");
    assertNotNull(notfound, "the 404 scenario must throw");
    assertTrue(notfound instanceof SdkError, "the 404 scenario must throw the SDK error: " + notfound);
    SdkError sdkerr = (SdkError) notfound;
    assertEquals(404, sdkerr.status);
    Map<String, Object> spec = Helpers.toMapAny(sdkerr.spec);
    assertNotNull(spec, "the error should carry the cleaned spec as a map");
    if (!AUTH_SUPPRESSED) {
      if ("query".equals(AUTH_WHERE)) {
        assertEquals(MASK, header(spec.get("query"), AUTH_NAME));
      }
      else if ("cookie".equals(AUTH_WHERE)) {
        String cookie = String.valueOf(header(spec.get("headers"), "cookie"));
        assertTrue(cookie.contains(MASK), "cookie: " + cookie);
      }
      else {
        String cred = String.valueOf(header(spec.get("headers"), AUTH_NAME));
        assertTrue(cred.endsWith(MASK), AUTH_NAME + ": " + cred);
      }
    }
    assertEquals(MASK, header(spec.get("headers"), "x-custom-token"));

    Map<String, Object> explained = explains.get("ok/explain");
    assertNotNull(explained);
    Map<String, Object> result = Helpers.toMapAny(explained.get("result"));
    assertNotNull(result, "the explain record should carry the result");
    assertEquals(MASK, header(result.get("headers"), "x-session-token"));
  }

  @Test
  public void theSweepCanSeeALeakCleanSwitchedOffShowsTheCredential() {
    Op op = usableOp();
    assertNotNull(op);

    List<Sink> sinks = new ArrayList<>();
    ${sdk} sdk = makeSdk(SCENARIOS.get(1), sinks, jm("active", false));
    Exception err = drive(sdk, op, new LinkedHashMap<>(), sinks);
    assertNotNull(err);

    int leaked = 0;
    for (Sink s : sinks) {
      if (!leaks(s.text).isEmpty()) {
        leaked++;
      }
    }
    assertTrue(0 < leaked, "with clean off, nothing showed the canary: the sweep is blind");

    if (!AUTH_SUPPRESSED) {
      assertTrue(err instanceof SdkError, "expected the SDK error: " + err);
      String text = Struct.jsonify(plain(((SdkError) err).spec, 0, new IdentityHashMap<>()));
      assertTrue(text.contains(CANARY_APIKEY)
          || text.contains(base64(CANARY_APIKEY + ":" + CANARY_SECRET)),
          "the raw spec should carry the credential when clean is off");
    }
  }
}
`
}


export {
  TestClean
}
