package JAVAPACKAGE.feature;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.SdkClient;
import JAVAPACKAGE.core.Utility;
import JAVAPACKAGE.utility.Media;

// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.
@SuppressWarnings({"unchecked"})
public class CacheFeature extends BaseFeature {

  private SdkClient client;
  private Map<String, Object> options;
  private Map<String, CacheEntry> store;
  private SecretKeySpec secret;

  private static final List<String> SAFE_METHODS = List.of("GET", "HEAD");
  private static final List<String> UNSTORED = List.of("no-store", "private", "no-cache");
  private static final Pattern MAX_AGE = Pattern.compile("^max-age\\s*=\\s*\"?(\\d+)\"?$");

  // Activity tracking (mirrors the ts client._cache record).
  public int hit = 0;
  public int miss = 0;
  public int bypass = 0;

  private static final class CacheEntry {
    long expiry;
    String scope;
    CacheSnapshot snapshot;
  }

  private static final class CacheSnapshot {
    int status;
    String statusText = "";
    Object data;
    Map<String, Object> headers = new LinkedHashMap<>();
  }

  public CacheFeature() {
    super("cache", "0.0.1", true);
  }

  @Override
  public void init(Context ctx, Map<String, Object> options) {
    this.client = ctx.client;
    this.options = options;
    this.active = FeatureOptions.foptBool(options, "active", false);

    if (!this.active) {
      return;
    }

    this.store = new LinkedHashMap<>();
    byte[] key = new byte[32];
    new SecureRandom().nextBytes(key);
    this.secret = new SecretKeySpec(key, "HmacSHA256");

    final Utility.FetcherFn inner = ctx.utility.fetcher;

    ctx.utility.fetcher = (ctx2, url, fetchdef) ->
        through(ctx2, url, fetchdef, inner);
  }

  private Object through(Context ctx, String url, Map<String, Object> fetchdef,
      Utility.FetcherFn inner) {

    String method = "GET";
    Object m = fetchdef.get("method");
    if (m instanceof String && !"".equals(m)) {
      method = ((String) m).toUpperCase();
    }

    List<String> methods = FeatureOptions.foptStrList(this.options, "methods");
    if (methods == null) {
      methods = List.of("GET");
    }
    boolean cacheable = false;
    for (String cm : methods) {
      if (cm.toUpperCase().equals(method)) {
        cacheable = true;
        break;
      }
    }
    if (!cacheable) {
      if (SAFE_METHODS.contains(method)) {
        return inner.fetch(ctx, url, fetchdef);
      }
      try {
        return inner.fetch(ctx, url, fetchdef);
      }
      finally {
        invalidate(url);
      }
    }

    String key = method + " " + url + " " + digest(fetchdef.get("headers"));
    long now = FeatureOptions.foptNow(this.options).getAsLong();

    CacheEntry hitEntry = this.store.get(key);
    if (hitEntry != null && hitEntry.expiry > now) {
      this.hit++;
      return replay(hitEntry.snapshot);
    }

    Object res;
    try {
      res = inner.fetch(ctx, url, fetchdef);
    }
    catch (RuntimeException err) {
      this.bypass++;
      throw err;
    }

    // A body that declares another type than JSON passes by, unread.
    if (storable(res) && !json(res)) {
      this.bypass++;
      return res;
    }

    if (storable(res)) {
      CacheSnapshot snapshot = snapshot(res);
      long ttl = lifetime(snapshot.headers, FeatureOptions.foptInt(this.options, "ttl", 5000));
      if (ttl <= 0) {
        this.bypass++;
        return replay(snapshot);
      }
      this.store.remove(key);
      evict();
      CacheEntry entry = new CacheEntry();
      entry.expiry = now + ttl;
      entry.scope = scope(url);
      entry.snapshot = snapshot;
      this.store.put(key, entry);
      this.miss++;
      return replay(snapshot);
    }

    this.bypass++;
    return res;
  }

  private String digest(Object headers) {
    List<String[]> pairs = new ArrayList<>();
    if (headers instanceof Map) {
      for (Map.Entry<?, ?> h : ((Map<?, ?>) headers).entrySet()) {
        if (h.getValue() != null) {
          pairs.add(new String[] {String.valueOf(h.getKey()).toLowerCase(), String.valueOf(h.getValue())});
        }
      }
    }
    pairs.sort((a, b) -> a[0].equals(b[0]) ? a[1].compareTo(b[1]) : a[0].compareTo(b[0]));
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(this.secret);
      for (String[] p : pairs) {
        mac.update((p[0] + ":" + p[1] + "\n").getBytes(StandardCharsets.UTF_8));
      }
      StringBuilder hex = new StringBuilder();
      for (byte b : mac.doFinal()) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    }
    catch (GeneralSecurityException err) {
      throw new IllegalStateException(err);
    }
  }

  private void invalidate(String url) {
    String path = scope(url);
    String collection = parent(path);
    this.store.values().removeIf((e) -> under(e.scope, path) || under(e.scope, collection));
  }

  // The configured ttl capped by the response's Cache-Control; zero when the
  // response may not be stored.
  private static long lifetime(Map<String, Object> headers, long ttl) {
    String control = "";
    for (Map.Entry<String, Object> h : headers.entrySet()) {
      if ("cache-control".equals(h.getKey().toLowerCase())) {
        control = String.valueOf(h.getValue()).toLowerCase();
      }
    }
    long life = ttl;
    for (String part : control.split(",")) {
      String directive = part.trim();
      if (UNSTORED.contains(directive)) {
        return 0;
      }
      Matcher age = MAX_AGE.matcher(directive);
      if (age.matches()) {
        try {
          life = Math.min(life, Long.parseLong(age.group(1)) * 1000);
        }
        catch (NumberFormatException err) {
          continue;
        }
      }
    }
    return life;
  }

  private static String scope(String url) {
    String out = url.split("[?#]", 2)[0];
    while (out.endsWith("/")) {
      out = out.substring(0, out.length() - 1);
    }
    return out;
  }

  private static String parent(String scope) {
    int scheme = scope.indexOf("://");
    int root = scheme < 0 ? 0 : scope.indexOf('/', scheme + 3);
    if (root < 0) {
      return scope;
    }
    return scope.substring(0, Math.max(scope.lastIndexOf('/'), root));
  }

  private static boolean under(String scope, String prefix) {
    return scope.equals(prefix) || scope.startsWith(prefix + "/");
  }

  // A body the transport could not read as JSON passes through, for the operation to report.
  private boolean storable(Object res) {
    int status = FeatureOptions.fresStatus(res);
    return status >= 200 && status < 300
        && !Boolean.TRUE.equals(((Map<String, Object>) res).get("unreadable"));
  }

  private boolean json(Object res) {
    String type = FeatureOptions.fresHeader(res, "content-type");
    return "".equals(type) || Media.isJsonMedia(type);
  }

  private CacheSnapshot snapshot(Object res) {
    Map<String, Object> rm = res instanceof Map ? (Map<String, Object>) res : null;

    CacheSnapshot snap = new CacheSnapshot();

    int status = FeatureOptions.fresStatus(res);
    if (status >= 0) {
      snap.status = status;
    }
    if (rm != null) {
      Object st = rm.get("statusText");
      if (st instanceof String) {
        snap.statusText = (String) st;
      }
      Object jf = rm.get("json");
      if (jf instanceof Supplier) {
        snap.data = ((Supplier<Object>) jf).get();
      }
      Object headers = rm.get("headers");
      if (headers instanceof Map) {
        for (Map.Entry<String, Object> h : ((Map<String, Object>) headers).entrySet()) {
          snap.headers.put(h.getKey().toLowerCase(), h.getValue());
        }
      }
    }

    return snap;
  }

  // replay builds a fresh transport-shaped response so the body stays
  // re-readable for every consumer.
  private Map<String, Object> replay(CacheSnapshot snap) {
    final Object data = snap.data;
    Map<String, Object> headers = new LinkedHashMap<>(snap.headers);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("status", snap.status);
    out.put("statusText", snap.statusText);
    out.put("body", "not-used");
    out.put("json", (Supplier<Object>) () -> data);
    out.put("headers", headers);
    return out;
  }

  // evict drops oldest entries (FIFO) until the store is under `max`.
  private void evict() {
    int max = FeatureOptions.foptInt(this.options, "max", 256);
    Iterator<String> oldest = this.store.keySet().iterator();
    while (this.store.size() >= max && oldest.hasNext()) {
      oldest.next();
      oldest.remove();
    }
  }
}
