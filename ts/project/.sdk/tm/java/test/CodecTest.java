package JAVAPACKAGE.sdktest;

// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity.

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import JAVAPACKAGE.core.Entity;
import JAVAPACKAGE.core.ProjectNameSDK;
import JAVAPACKAGE.core.SdkEntity;
import JAVAPACKAGE.core.SdkError;

@SuppressWarnings({"unchecked"})
public class CodecTest {

  private static final String HANDLE = "JAVAPACKAGE.utility.codec.HandleCodec";

  private static final List<String> WRITES = List.of("create", "update", "patch");

  private record Answer(int status, String type, byte[] body) {}

  private record Arrived(String method, String url, String type, byte[] body) {}

  /** One expected item: a text value, or a file part. */
  private record Expect(String name, String value, String file, String filename, String type) {}

  @FunctionalInterface
  private interface Run {
    void run(ProjectNameSDK client) throws Exception;
  }

  private record Case(String name, Run run) {}

  private static HttpServer server;
  private static String base = "";
  private static volatile Answer answer = new Answer(200, "application/json", new byte[0]);
  private static final List<Arrived> arrivals = new ArrayList<>();
  private static int ran = 0;
  private static int failed = 0;

  private static final ProjectNameSDK PROBE =
      new ProjectNameSDK(new LinkedHashMap<>(Map.of("base", "http://127.0.0.1:1")));

  private static Map<String, Object> config() {
    return PROBE.getRootCtx().config;
  }

  // Entity name to the client method that builds one.
  private static Map<String, Method> accessors() {
    Map<String, Method> out = new TreeMap<>();
    for (Method m : ProjectNameSDK.class.getMethods()) {
      if (1 != m.getParameterCount() || !Map.class.isAssignableFrom(m.getParameterTypes()[0])
          || !Entity.class.isAssignableFrom(m.getReturnType())) {
        continue;
      }
      try {
        Entity ent = (Entity) m.invoke(PROBE, new Object[] {null});
        Map<String, Object> entities = (Map<String, Object>) config().get("entity");
        if (ent != null && entities != null && entities.containsKey(ent.getName())) {
          out.put(ent.getName(), m);
        }
      }
      catch (ReflectiveOperationException | RuntimeException e) {
        continue;
      }
    }
    return out;
  }

  private static Map<String, Object> params(Map<String, Object> point) {
    Map<String, Object> out = new LinkedHashMap<>();
    Object parts = point.get("parts");
    if (parts instanceof List) {
      for (Object part : (List<Object>) parts) {
        Matcher m = Pattern.compile("^\\{(.+)\\}$").matcher(String.valueOf(part));
        if (m.matches()) {
          out.put(m.group(1), "p1");
        }
      }
    }
    return out;
  }

  private static String action(Map<String, Object> point) {
    Object select = point.get("select");
    Object act = select instanceof Map ? ((Map<String, Object>) select).get("$action") : null;
    return act instanceof String ? (String) act : null;
  }

  private static Map<String, Object> select(Map<String, Object> point) {
    Map<String, Object> out = new LinkedHashMap<>();
    if (action(point) != null) {
      out.put("$action", action(point));
    }
    return out;
  }

  private static byte[] content(String name) {
    return ("file:" + name + "\u0000ÿ\r\n--").getBytes(StandardCharsets.ISO_8859_1);
  }

  private static String latin1(byte[] bytes) {
    return new String(bytes, StandardCharsets.ISO_8859_1);
  }

  private static String utf8AsLatin1(String text) {
    return latin1(text.getBytes(StandardCharsets.UTF_8));
  }

  private static Object call(Object target, String method, Class<?>[] types, Object... args)
      throws Exception {
    try {
      return target.getClass().getMethod(method, types).invoke(target, args);
    }
    catch (InvocationTargetException e) {
      throw e.getCause() instanceof Exception ? (Exception) e.getCause() : e;
    }
  }

  private static Object handle(Object ent, String slot) throws Exception {
    return null == slot ? call(ent, "binary", new Class<?>[] {})
        : call(ent, "binary", new Class<?>[] {String.class}, slot);
  }

  // The data a form or multipart point is sent, and the items it must arrive as.
  private static List<Expect> plan(ProjectNameSDK client, Map<String, Object> body,
      Map<String, Object> data) {
    boolean form = "form".equals(body.get("kind"));
    List<Expect> expect = new ArrayList<>();
    Object fields = body.get("fields");
    for (Object f : fields instanceof List ? (List<Object>) fields : List.of()) {
      Map<String, Object> field = (Map<String, Object>) f;
      String name = String.valueOf(field.get("name"));
      Object media = field.get("media");
      if (Boolean.TRUE.equals(field.get("binary"))) {
        String type = form ? null
            : media instanceof String ? (String) media : "application/octet-stream";
        data.put(name, client.binary.bytes(content(name), "/local/dir/" + name + ".bin", type));
        expect.add(form ? new Expect(name, latin1(content(name)), null, null, null)
            : new Expect(name, null, latin1(content(name)), name + ".bin", type));
      }
      else if (Boolean.TRUE.equals(field.get("list"))) {
        data.put(name, List.of("a", "b c"));
        expect.add(new Expect(name, "a", null, null, null));
        expect.add(new Expect(name, "b c", null, null, null));
      }
      else if (field.get("join") instanceof String) {
        data.put(name, List.of("a", "b"));
        expect.add(new Expect(name, "a" + field.get("join") + "b", null, null, null));
      }
      else {
        data.put(name, "v\"" + name + "\r\n");
        expect.add(new Expect(name, utf8AsLatin1("v\"" + name + "\r\n"), null, null, null));
      }
    }
    return expect;
  }

  private static List<Expect> multipart(Arrived arrived) {
    Matcher bm = Pattern.compile("boundary=([^;]+)").matcher(arrived.type());
    assertTrue(bm.find(), "no boundary in " + arrived.type());
    String boundary = bm.group(1);
    String text = latin1(arrived.body());
    assertTrue(text.endsWith("--" + boundary + "--\r\n"), "the body does not close");
    String[] chunks = text.split(Pattern.quote("--" + boundary), -1);
    Pattern disp = Pattern.compile(
        "^Content-Disposition: form-data; name=\"([^\"]*)\"(?:; filename=\"([^\"]*)\")?$",
        Pattern.MULTILINE);
    Pattern ctype = Pattern.compile("^Content-Type: (.*)$", Pattern.MULTILINE);
    List<Expect> parts = new ArrayList<>();
    for (int i = 1; i < chunks.length - 1; i++) {
      String chunk = chunks[i];
      int at = chunk.indexOf("\r\n\r\n");
      String head = chunk.substring(2, at);
      String body = chunk.substring(at + 4, chunk.length() - 2);
      Matcher dm = disp.matcher(head);
      assertTrue(dm.find(), "a part without a disposition: " + head);
      Matcher cm = ctype.matcher(head);
      String type = cm.find() ? cm.group(1) : null;
      parts.add(null == dm.group(2) ? new Expect(dm.group(1), body, null, null, null)
          : new Expect(dm.group(1), null, body, dm.group(2), type));
    }
    return parts;
  }

  // Form pairs, each value its bytes as latin1.
  private static List<Expect> form(Arrived arrived) {
    List<Expect> out = new ArrayList<>();
    String text = latin1(arrived.body());
    if (text.isEmpty()) {
      return out;
    }
    for (String pair : text.split("&")) {
      String[] kv = pair.split("=", 2);
      out.add(new Expect(unescape(kv[0]), unescape(kv.length < 2 ? "" : kv[1]),
          null, null, null));
    }
    return out;
  }

  private static String unescape(String text) {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if ('+' == c) {
        out.write(' ');
      }
      else if ('%' == c) {
        out.write(Integer.parseInt(text.substring(i + 1, i + 3), 16));
        i += 2;
      }
      else {
        out.write(c);
      }
    }
    return latin1(out.toByteArray());
  }

  private static List<Expect> only(List<Expect> got, List<Expect> expect) {
    List<Expect> out = new ArrayList<>();
    for (Expect g : got) {
      if (expect.stream().anyMatch((e) -> e.name().equals(g.name()))) {
        out.add(g);
      }
    }
    return out;
  }

  private static Arrived arrived() {
    synchronized (arrivals) {
      assertFalse(arrivals.isEmpty(), "nothing arrived");
      return arrivals.get(arrivals.size() - 1);
    }
  }

  private static void answer(int status, String type, byte[] body) {
    answer = new Answer(status, type, body);
  }

  private static byte[] json() {
    return "{\"id\":\"p1\"}".getBytes(StandardCharsets.UTF_8);
  }

  private static List<Case> cases() {
    List<Case> out = new ArrayList<>();
    Map<String, Method> acc = accessors();
    Map<String, Object> entities = (Map<String, Object>) config().get("entity");

    for (Map.Entry<String, Method> ae : acc.entrySet()) {
      String ename = ae.getKey();
      Method accessor = ae.getValue();
      Object opsraw = ((Map<String, Object>) entities.get(ename)).get("op");
      Map<String, Object> ops = new TreeMap<>(opsraw instanceof Map
          ? (Map<String, Object>) opsraw : Map.of());

      for (Map.Entry<String, Object> oe : ops.entrySet()) {
        String opname = oe.getKey();
        Object pointsraw = ((Map<String, Object>) oe.getValue()).get("points");
        for (Object p : pointsraw instanceof List ? (List<Object>) pointsraw : List.of()) {
          Map<String, Object> point = (Map<String, Object>) p;
          String label = ename + "." + opname
              + (null == action(point) ? "" : ":" + action(point));
          Map<String, Object> rb = point.get("body") instanceof Map
              ? (Map<String, Object>) point.get("body") : Map.of();
          Map<String, Object> rs = point.get("response") instanceof Map
              ? (Map<String, Object>) point.get("response") : Map.of();
          Object rbkind = rb.get("kind");

          if (("form".equals(rbkind) || "multipart".equals(rbkind)) && WRITES.contains(opname)) {
            out.add(new Case(label + " sends a " + rbkind + " body", (client) -> {
              Map<String, Object> data = new LinkedHashMap<>();
              data.putAll(params(point));
              data.putAll(select(point));
              List<Expect> expect = plan(client, rb, data);
              answer(200, "application/json", json());
              SdkEntity ent = (SdkEntity) accessor.invoke(client, new Object[] {null});
              call(ent, opname, new Class<?>[] {Map.class, Map.class}, data, null);
              Arrived got = arrived();
              if ("form".equals(rbkind)) {
                assertEquals(rb.get("media"), got.type());
                assertEquals(expect, only(form(got), expect));
              }
              else {
                assertEquals(expect, only(multipart(got), expect));
              }
            }));
          }

          if ("raw".equals(rbkind) && WRITES.contains(opname)) {
            boolean bin = Boolean.TRUE.equals(rb.get("binary"));
            out.add(new Case(label + " sends a raw " + (bin ? "binary" : "text") + " body",
                (client) -> {
                  answer(200, "application/json", json());
                  SdkEntity ent = (SdkEntity) accessor.invoke(client, new Object[] {null});
                  ent.data(params(point));
                  ent.match(params(point));
                  if (bin) {
                    Object h = handle(ent, action(point));
                    Object got = call(h, "put", new Class<?>[] {Object.class},
                        client.binary.bytes(content(label), null, (String) rb.get("media")));
                    assertSame(ent, got);
                    assertArrayEquals(content(label), arrived().body());
                  }
                  else {
                    Map<String, Object> data = select(point);
                    data.put("$body", "text \"" + label + "\"\n");
                    call(ent, opname, new Class<?>[] {Map.class, Map.class}, data, null);
                    assertEquals("text \"" + label + "\"\n",
                        new String(arrived().body(), StandardCharsets.UTF_8));
                  }
                  assertEquals(rb.get("media"), arrived().type());
                }));
          }

          if ("raw".equals(rs.get("kind")) && "load".equals(opname)) {
            boolean bin = Boolean.TRUE.equals(rs.get("binary"));
            out.add(new Case(label + " reads a raw " + (bin ? "binary" : "text") + " body",
                (client) -> {
                  SdkEntity ent = (SdkEntity) accessor.invoke(client, new Object[] {null});
                  ent.data(params(point));
                  ent.match(params(point));
                  Map<String, Object> req = new LinkedHashMap<>(params(point));
                  req.putAll(select(point));
                  if (bin) {
                    answer(200, (String) rs.get("media"), content(label));
                    Object h = handle(ent, action(point));
                    byte[] bytes = (byte[]) call(h, "bytes", new Class<?>[] {});
                    assertArrayEquals(content(label), bytes);
                    SdkError refused = null;
                    try {
                      ent.load(req, null);
                    }
                    catch (SdkError err) {
                      refused = err;
                    }
                    assertNotNull(refused, "a plain load of bytes was not refused");
                    assertEquals("binary_sink_required", refused.code);
                  }
                  else {
                    answer(200, (String) rs.get("media"),
                        ("café " + label).getBytes(StandardCharsets.UTF_8));
                    Object got = ent.load(req, null);
                    assertSame(ent, got);
                    assertEquals("café " + label,
                        ((Map<String, Object>) ent.data()).get("$body"));
                  }
                }));
          }
        }
      }
    }
    return out;
  }

  @BeforeAll
  public static void listen() throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", (exchange) -> {
      byte[] body = exchange.getRequestBody().readAllBytes();
      String type = exchange.getRequestHeaders().getFirst("content-type");
      synchronized (arrivals) {
        arrivals.add(new Arrived(exchange.getRequestMethod(),
            exchange.getRequestURI().toString(), type == null ? "" : type, body));
      }
      Answer a = answer;
      exchange.getResponseHeaders().set("content-type", a.type());
      exchange.sendResponseHeaders(a.status(), 0 == a.body().length ? -1 : a.body().length);
      try (OutputStream os = exchange.getResponseBody()) {
        os.write(a.body());
      }
    });
    server.start();
    base = "http://127.0.0.1:" + server.getAddress().getPort();
  }

  @AfterAll
  public static void report() {
    System.out.println("codec: ran " + ran + " case(s), " + failed + " failed");
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  public void thisSdkHasAPointToDrive() {
    assertFalse(cases().isEmpty(), "no form, multipart or raw point was found");
  }

  // The handle over a recording entity, with the slots of every kind.
  private static Object stubHandle(List<Object[]> calls, String slot) throws Exception {
    Class<?> handle;
    Class<?> def;
    try {
      handle = Class.forName(HANDLE + "$BinaryHandle");
      def = Class.forName(HANDLE + "$SlotDef");
    }
    catch (ClassNotFoundException e) {
      Assumptions.abort("this SDK was generated without a binary handle");
      return null;
    }
    java.lang.reflect.Constructor<?> mk = def.getConstructor(String.class, String.class,
        String.class);
    Map<String, Object> slots = new LinkedHashMap<>();
    slots.put("", mk.newInstance("", "load", null));
    slots.put("audio", mk.newInstance("audio", "load", "update"));
    slots.put("cover", mk.newInstance("cover", null, "create"));
    SdkEntity[] self = new SdkEntity[1];
    self[0] = (SdkEntity) Proxy.newProxyInstance(SdkEntity.class.getClassLoader(),
        new Class<?>[] {SdkEntity.class}, (proxy, method, args) -> {
          if ("getName".equals(method.getName())) {
            return "episode";
          }
          calls.add(new Object[] {method.getName(), args[0], args[1]});
          Map<String, Object> transfer =
              (Map<String, Object>) ((Map<String, Object>) args[1]).get("transfer");
          if ("read".equals(transfer.get("direction"))) {
            transfer.put("bytes", content("handle"));
          }
          return self[0];
        });
    return handle.getConstructors()[0].newInstance(self[0], null, slots, slot);
  }

  private static String code(Exception err) {
    return err instanceof SdkError ? ((SdkError) err).code : String.valueOf(err);
  }

  @Test
  public void aHandleReadIsOneLoadOfTheSlotsAction() throws Exception {
    List<Object[]> calls = new ArrayList<>();
    Map<String, Object> explain = new LinkedHashMap<>();
    Map<String, Object> ctrl = new LinkedHashMap<>();
    ctrl.put("explain", explain);
    Object got = call(stubHandle(calls, "audio"), "bytes",
        new Class<?>[] {Map.class, Map.class}, null, ctrl);
    assertArrayEquals(content("handle"), (byte[]) got);
    assertEquals(1, calls.size());
    assertEquals("load", calls.get(0)[0]);
    assertEquals(Map.of("$action", "audio"), calls.get(0)[1]);
    Map<String, Object> sent = (Map<String, Object>) calls.get(0)[2];
    assertSame(explain, sent.get("explain"));
    assertEquals("audio", ((Map<String, Object>) sent.get("transfer")).get("slot"));
    assertEquals("read", ((Map<String, Object>) sent.get("transfer")).get("direction"));

    calls.clear();
    call(stubHandle(calls, ""), "bytes", new Class<?>[] {});
    assertEquals("load", calls.get(0)[0]);
    assertEquals(Map.of(), calls.get(0)[1]);
  }

  @Test
  public void aHandleWriteSendsTheSourceAndResolvesToTheEntity() throws Exception {
    List<Object[]> calls = new ArrayList<>();
    Object src = PROBE.binary.bytes(content("put"), null, "audio/wav");
    Object got = call(stubHandle(calls, "audio"), "put", new Class<?>[] {Object.class}, src);
    assertEquals("update", calls.get(0)[0]);
    assertEquals(Map.of("$action", "audio", "$body", src), calls.get(0)[1]);
    assertEquals("write", ((Map<String, Object>) ((Map<String, Object>) calls.get(0)[2])
        .get("transfer")).get("direction"));
    assertTrue(got instanceof SdkEntity);

    calls.clear();
    call(stubHandle(calls, "cover"), "put", new Class<?>[] {Object.class}, src);
    assertEquals("create", calls.get(0)[0]);
    assertEquals(1, calls.size());
  }

  @Test
  public void aHandleRefusesWhatCoreCannotDo() throws Exception {
    List<Object[]> calls = new ArrayList<>();
    Object h = stubHandle(calls, "audio");
    for (String what : List.of("save", "stream", "open")) {
      Exception err = null;
      try {
        call(h, what, new Class<?>[] {Object[].class}, (Object) new Object[0]);
      }
      catch (Exception e) {
        err = e;
      }
      assertEquals("binary_feature_inactive", code(err), what);
    }
    Exception ranged = null;
    try {
      call(h, "bytes", new Class<?>[] {Map.class, Map.class}, Map.of("range", "0-1"), null);
    }
    catch (Exception e) {
      ranged = e;
    }
    assertEquals("binary_feature_inactive", code(ranged));

    Object[][] refused = {
        {"nope", "bytes", "binary_slot_unknown"},
        {"cover", "bytes", "binary_slot_direction"},
        {"", "put", "binary_slot_direction"},
    };
    for (Object[] r : refused) {
      Exception err = null;
      try {
        Object hh = stubHandle(calls, (String) r[0]);
        if ("bytes".equals(r[1])) {
          call(hh, "bytes", new Class<?>[] {});
        }
        else {
          call(hh, "put", new Class<?>[] {Object.class}, "x");
        }
      }
      catch (Exception e) {
        err = e;
      }
      assertEquals(r[2], code(err), r[0] + " " + r[1]);
    }
    assertTrue(calls.isEmpty(), "a refused call ran an operation");
  }

  @TestFactory
  public Stream<DynamicTest> codec() {
    return cases().stream().map((kase) -> DynamicTest.dynamicTest(kase.name(), () -> {
      ran++;
      synchronized (arrivals) {
        arrivals.clear();
      }
      answer(200, "application/json", new byte[0]);
      try {
        Map<String, Object> opts = new LinkedHashMap<>();
        opts.put("base", base);
        kase.run().run(new ProjectNameSDK(opts));
      }
      catch (Throwable err) {
        failed++;
        throw err;
      }
    }));
  }
}
