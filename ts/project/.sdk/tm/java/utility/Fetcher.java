package JAVAPACKAGE.utility;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import java.util.zip.GZIPInputStream;
import java.util.zip.Inflater;
import java.util.zip.InflaterInputStream;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.SdkError;
import JAVAPACKAGE.utility.struct.Struct;

@SuppressWarnings({"unchecked"})
public final class Fetcher {

  private Fetcher() {}

  // Clients keyed by proxy. Each HttpClient owns a connection pool and a
  // selector thread, so one per request reused nothing; one per key pools
  // across calls. None follows a redirect: followRedirects does.
  private static final ConcurrentHashMap<String, HttpClient> CLIENTS =
      new ConcurrentHashMap<>();

  private static HttpClient clientFor(Map<String, Object> fetchdef) {
    Object praw = fetchdef.get("proxy");
    final String proxy = praw instanceof String ? (String) praw : "";

    return CLIENTS.computeIfAbsent(proxy, key -> {
      HttpClient.Builder clientb =
          HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER);
      if (!"".equals(proxy)) {
        try {
          URI proxyUri = URI.create(proxy);
          int port = proxyUri.getPort() < 0 ? 80 : proxyUri.getPort();
          clientb.proxy(ProxySelector.of(new InetSocketAddress(proxyUri.getHost(), port)));
        }
        catch (RuntimeException e) {
          // Unparseable proxy target: direct connection, as the go transport.
        }
      }
      return clientb.build();
    });
  }

  static final String GETONLY_ENV = "VOXGIG_GETONLY_GUARD";

  // A GET-only live run refuses any other method before it is sent. The error
  // names the path alone: the query can carry a credential.
  static SdkError getOnlyRefusal(String fullurl, String method) {
    method = method.toUpperCase(java.util.Locale.ROOT);
    if (!"TRUE".equals(System.getenv(GETONLY_ENV)) || "GET".equals(method)) {
      return null;
    }
    String rest = fullurl;
    int scheme = rest.indexOf("://");
    if (scheme >= 0) {
      rest = rest.substring(scheme + 3).replaceFirst("^[^/?#]*", "");
    }
    String path = rest.split("[?#]", 2)[0];
    return new SdkError("fetch_getonly_block",
        "[GET-ONLY GUARD] blocked " + method + " " + ("".equals(path) ? "/" : path), null);
  }

  private static final List<Integer> REDIRECT_STATUS = List.of(301, 302, 303, 307, 308);
  private static final int REDIRECT_MAX = 5;
  private static final List<String> CREDENTIAL_HEADERS =
      List.of("authorization", "cookie", "proxy-authorization");

  // Scheme, host and port, the scheme's own port made explicit.
  private static String originOf(URI uri) {
    String scheme = String.valueOf(uri.getScheme()).toLowerCase(Locale.ROOT);
    int port = uri.getPort() < 0 ? ("https".equals(scheme) ? 443 : 80) : uri.getPort();
    String host = uri.getHost() == null ? String.valueOf(uri.getRawAuthority()) : uri.getHost();
    return scheme + "://" + host.toLowerCase(Locale.ROOT) + ":" + port;
  }

  // What another origin is not sent: the names every client drops, and
  // whatever the SDK holds as a secret, by its name or by its value. Where
  // no registry is at hand to ask, the clean module answers.
  private static boolean isCredential(Context ctx, String name, Object value) {
    if (CREDENTIAL_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
      return true;
    }
    return ctx != null && ctx.utility != null && ctx.utility.cleanSecret != null
        ? ctx.utility.cleanSecret.apply(ctx, name, value)
        : Clean.cleanSecret(ctx, name, value);
  }

  // A reference of a query alone keeps the path, as RFC 3986 resolves it;
  // URI.resolve follows RFC 2396 there and drops the last segment.
  public static URI resolveLocation(URI from, String location) {
    String loc = location.trim();
    if (loc.startsWith("?")) {
      String base = from.toString();
      int cut = base.indexOf('?');
      int hash = base.indexOf('#');
      if (cut < 0 || (0 <= hash && hash < cut)) {
        cut = hash;
      }
      return URI.create((cut < 0 ? base : base.substring(0, cut)) + loc);
    }
    return from.resolve(URI.create(loc));
  }

  // Left to follow, the JDK client sends another origin every header it does
  // not know for a credential, and a 307's body with them. Followed here
  // instead: each hop passes the GET-only guard; past REDIRECT_MAX hops, or
  // where a body would go to another origin, the 3xx is the answer.
  static Map<String, Object> followRedirects(Context ctx, String fullurl,
      Map<String, Object> fetchdef) {
    // "manual" (set by the station feature's middleware under a hosts
    // policy) is answered by the 3xx, like any other response.
    boolean manual = "manual".equals(fetchdef.get("redirect"));
    String url = fullurl;
    Map<String, Object> def = fetchdef;

    for (int hops = 0; ; hops++) {
      Map<String, Object> res = defaultHttpFetch(url, def);
      Object location = Struct.getprop(res.get("headers"), "location", null);
      if (manual || !(location instanceof String)
          || !REDIRECT_STATUS.contains(res.get("status")) || REDIRECT_MAX <= hops) {
        return res;
      }

      URI from;
      URI next;
      try {
        from = URI.create(url);
        next = resolveLocation(from, (String) location);
      }
      catch (RuntimeException e) {
        return res;
      }

      // As the JDK client follows: to the same scheme, or up to https.
      String scheme = next.getScheme();
      if (scheme == null
          || !(scheme.equalsIgnoreCase(from.getScheme()) || "https".equalsIgnoreCase(scheme))) {
        return res;
      }

      // As the JDK client rewrites it: a 303, and a 301 or 302 answering a
      // POST, become a GET without the body.
      Object given = def.get("method");
      String method = given instanceof String && !"".equals(given)
          ? ((String) given).toUpperCase(Locale.ROOT) : "GET";
      int status = (Integer) res.get("status");
      boolean toget = 303 == status
          || ("POST".equals(method) && 307 != status && 308 != status);
      boolean cross = !originOf(next).equals(originOf(from));
      Object body = toget ? null : def.get("body");

      // A stream is read once, so it cannot be sent again either.
      if (body != null && (cross || body instanceof InputStream)) {
        return res;
      }

      Map<String, Object> headers = new LinkedHashMap<>();
      if (def.get("headers") instanceof Map) {
        for (Map.Entry<String, Object> h : ((Map<String, Object>) def.get("headers")).entrySet()) {
          boolean dropped = (toget && h.getKey().toLowerCase(Locale.ROOT).startsWith("content-"))
              || (cross && isCredential(ctx, h.getKey(), h.getValue()));
          if (!dropped) {
            headers.put(h.getKey(), h.getValue());
          }
        }
      }

      Map<String, Object> nextdef = new LinkedHashMap<>(def);
      nextdef.put("method", toget ? "GET" : method);
      nextdef.put("headers", headers);
      if (body == null) {
        nextdef.remove("body");
      }

      url = next.toString();
      def = nextdef;
    }
  }

  static Map<String, Object> defaultHttpFetch(String fullurl, Map<String, Object> fetchdef) {
    String method = fetchdef.get("method") instanceof String
        ? (String) fetchdef.get("method") : "";
    if ("".equals(method)) {
      method = "GET";
    }
    SdkError refused = getOnlyRefusal(fullurl, method);
    if (refused != null) {
      throw refused;
    }

    HttpRequest.BodyPublisher bodyPublisher = HttpRequest.BodyPublishers.noBody();
    Object body = fetchdef.get("body");
    if (body instanceof String && !"".equals(body)) {
      bodyPublisher = HttpRequest.BodyPublishers.ofString((String) body);
    }
    else if (body instanceof byte[]) {
      bodyPublisher = HttpRequest.BodyPublishers.ofByteArray((byte[]) body);
    }
    else if (body instanceof InputStream) {
      InputStream stream = (InputStream) body;
      bodyPublisher = HttpRequest.BodyPublishers.ofInputStream(() -> stream);
    }

    HttpRequest.Builder reqb;
    try {
      reqb = HttpRequest.newBuilder(URI.create(fullurl)).method(method, bodyPublisher);
    }
    catch (RuntimeException e) {
      throw new RuntimeException("fetch: invalid url: " + fullurl, e);
    }

    boolean hasUA = false;
    Object headersRaw = fetchdef.get("headers");
    if (headersRaw instanceof Map) {
      for (Map.Entry<String, Object> h : ((Map<String, Object>) headersRaw).entrySet()) {
        if (h.getValue() instanceof String) {
          if ("user-agent".equalsIgnoreCase(h.getKey())) {
            hasUA = true;
          }
          reqb.setHeader(h.getKey(), (String) h.getValue());
        }
      }
    }
    // Default User-Agent — some CDNs block Java's default. Use the project's
    // agent (main.kit.http.useragent, browser-shaped by default) unless the
    // caller already set one, and record it with the headers the request sent.
    if (!hasUA) {
      String agent = "PROJECTUSERAGENT";
      reqb.setHeader("User-Agent", agent);
      if (headersRaw instanceof Map) {
        ((Map<String, Object>) headersRaw).put("user-agent", agent);
      }
    }

    HttpResponse<String> resp;
    try {
      resp = clientFor(fetchdef).send(reqb.build(), decodedText());
    }
    catch (Exception e) {
      throw new RuntimeException("fetch: " + e.getMessage(), e);
    }

    Map<String, Object> headers = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> h : resp.headers().map().entrySet()) {
      List<String> vals = h.getValue();
      if (vals.size() == 1) {
        headers.put(h.getKey().toLowerCase(), vals.get(0));
      }
      else {
        headers.put(h.getKey().toLowerCase(), String.join(", ", vals));
      }
    }

    String bodyText = resp.body() == null ? "" : resp.body();
    Object parsed = null;
    boolean unreadable = false;
    if (!bodyText.isBlank()) {
      try {
        parsed = Json.parse(bodyText);
      }
      catch (RuntimeException e) {
        unreadable = true;
      }
    }
    final Object jsonBody = parsed;

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("status", resp.statusCode());
    out.put("statusText", statusText(resp.statusCode()));
    out.put("headers", headers);
    out.put("json", (Supplier<Object>) () -> jsonBody);
    out.put("body", bodyText);
    out.put("unreadable", unreadable);
    return out;
  }

  // The body as text, as BodyHandlers.ofString reads it, once a gzip or
  // deflate Content-Encoding is undone: HttpClient decodes none, and a server
  // may compress its answer whatever the request asked for.
  static HttpResponse.BodyHandler<String> decodedText() {
    return info -> {
      String encoding = info.headers().firstValue("content-encoding").orElse("")
          .trim().toLowerCase();
      Charset charset = charsetOf(info.headers().firstValue("content-type").orElse(""));
      return HttpResponse.BodySubscribers.mapping(
          HttpResponse.BodySubscribers.ofByteArray(),
          bytes -> {
            try {
              return new String(decodeBody(bytes, encoding), charset);
            }
            catch (IOException e) {
              throw new UncheckedIOException(
                  "response body is not valid " + encoding + " data: " + e.getMessage(), e);
            }
          });
    };
  }

  // Deflate is zlib-wrapped, or raw as some servers send it.
  static byte[] decodeBody(byte[] bytes, String encoding) throws IOException {
    if (bytes == null || bytes.length == 0) {
      return bytes == null ? new byte[0] : bytes;
    }
    if ("gzip".equals(encoding) || "x-gzip".equals(encoding)) {
      try (InputStream in = new GZIPInputStream(new ByteArrayInputStream(bytes))) {
        return in.readAllBytes();
      }
    }
    if ("deflate".equals(encoding)) {
      boolean zlib = bytes.length > 1 && (bytes[0] & 0x0f) == 8
          && (((bytes[0] & 0xff) << 8) | (bytes[1] & 0xff)) % 31 == 0;
      try (InputStream in = new InflaterInputStream(
          new ByteArrayInputStream(bytes), new Inflater(!zlib))) {
        return in.readAllBytes();
      }
    }
    return bytes;
  }

  static Charset charsetOf(String contentType) {
    for (String part : contentType.split(";")) {
      String[] kv = part.trim().split("=", 2);
      if (kv.length == 2 && "charset".equalsIgnoreCase(kv[0].trim())) {
        try {
          return Charset.forName(kv[1].trim().replace("\"", ""));
        }
        catch (RuntimeException e) {
          return StandardCharsets.UTF_8;
        }
      }
    }
    return StandardCharsets.UTF_8;
  }

  // HTTP/2 responses carry no reason phrase; use the standard text for
  // common codes so statusText stays informative.
  static String statusText(int status) {
    switch (status) {
      case 200: return "OK";
      case 201: return "Created";
      case 202: return "Accepted";
      case 204: return "No Content";
      case 301: return "Moved Permanently";
      case 302: return "Found";
      case 304: return "Not Modified";
      case 400: return "Bad Request";
      case 401: return "Unauthorized";
      case 403: return "Forbidden";
      case 404: return "Not Found";
      case 405: return "Method Not Allowed";
      case 408: return "Request Timeout";
      case 409: return "Conflict";
      case 422: return "Unprocessable Entity";
      case 425: return "Too Early";
      case 429: return "Too Many Requests";
      case 500: return "Internal Server Error";
      case 502: return "Bad Gateway";
      case 503: return "Service Unavailable";
      case 504: return "Gateway Timeout";
      default: return "";
    }
  }

  static Object fetcher(Context ctx, String fullurl, Map<String, Object> fetchdef) {
    if (!"live".equals(ctx.client.mode)) {
      throw ctx.makeError("fetch_mode_block",
          "Request blocked by mode: \"" + ctx.client.mode
              + "\" (URL was: \"" + fullurl + "\")");
    }

    Map<String, Object> options = ctx.client.optionsMap();
    if (Boolean.TRUE.equals(Struct.getpath(options,
        List.of("feature", "test", "active")))) {
      throw ctx.makeError("fetch_test_block",
          "Request blocked as test feature is active"
              + " (URL was: \"" + fullurl + "\")");
    }

    Object sysFetch = Struct.getpath(options, List.of("system", "fetch"));
    if (sysFetch == Struct.UNDEF) {
      sysFetch = null;
    }

    if (sysFetch == null) {
      return followRedirects(ctx, fullurl, fetchdef);
    }

    if (sysFetch instanceof BiFunction) {
      return ((BiFunction<String, Map<String, Object>, Object>) sysFetch)
          .apply(fullurl, fetchdef);
    }

    throw ctx.makeError("fetch_invalid", "system.fetch is not a valid function");
  }
}
