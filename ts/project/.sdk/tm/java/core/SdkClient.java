package JAVAPACKAGE.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import JAVAPACKAGE.utility.struct.Struct;

/**
 * Shared client runtime for the ProjectName SDK. The generated
 * ProjectNameSDK class extends this with the API-specific entity accessors;
 * everything transport- and pipeline-related lives here so features and
 * utilities can reference a fixed type.
 */
@SuppressWarnings({"unchecked"})
public abstract class SdkClient {

  public String mode = "live";
  public List<Feature> features = new ArrayList<>();

  protected Map<String, Object> options;
  protected Utility utility;
  protected Context rootctx;

  protected SdkClient(Map<String, Object> options) {
    this.utility = new Utility();

    Map<String, Object> config = Config.makeConfig();

    Map<String, Object> ctxmap = new LinkedHashMap<>();
    ctxmap.put("client", this);
    ctxmap.put("utility", this.utility);
    ctxmap.put("config", config);
    if (options != null) {
      ctxmap.put("options", options);
    }
    ctxmap.put("shared", new LinkedHashMap<String, Object>());

    this.rootctx = this.utility.makeContext.apply(ctxmap, null);

    this.options = this.utility.makeOptions.apply(this.rootctx);

    if (Boolean.TRUE.equals(Struct.getpath(this.options,
        List.of("feature", "test", "active")))) {
      this.mode = "test";
    }

    this.rootctx.options = this.options;

    // Add features from config/options.
    Map<String, Object> featureOpts =
        Helpers.toMapAny(Struct.getprop(this.options, "feature"));
    if (featureOpts != null) {
      for (List<Object> item : Struct.items(featureOpts)) {
        String fname = item.get(0) instanceof String ? (String) item.get(0) : null;
        Map<String, Object> fopts = Helpers.toMapAny(item.get(1));
        if (fname != null && fopts != null
            && Boolean.TRUE.equals(fopts.get("active"))) {
          Feature f = Config.makeFeature(fname);
          if (f != null) {
            this.utility.featureAdd.apply(this.rootctx, f);
          }
        }
      }
    }

    // Add extension features.
    Object extend = Struct.getprop(this.options, "extend");
    if (extend instanceof List) {
      for (Object f : (List<Object>) extend) {
        if (f instanceof Feature) {
          this.utility.featureAdd.apply(this.rootctx, (Feature) f);
        }
      }
    }

    // Initialize features.
    for (Feature f : new ArrayList<>(this.features)) {
      this.utility.featureInit.apply(this.rootctx, f);
    }

    this.utility.featureHook.apply(this.rootctx, "PostConstruct");
  }

  public Map<String, Object> optionsMap() {
    Object out = Struct.clone(this.options);
    if (out instanceof Map) {
      return (Map<String, Object>) out;
    }
    return new LinkedHashMap<>();
  }

  public Utility getUtility() {
    return this.utility.copy();
  }

  public Context getRootCtx() {
    return this.rootctx;
  }

  public Map<String, Object> prepare(Map<String, Object> fetchargs) {
    Utility utility = this.utility;

    if (fetchargs == null) {
      fetchargs = new LinkedHashMap<>();
    }

    Map<String, Object> ctrl = Helpers.toMapAny(Struct.getprop(fetchargs, "ctrl"));
    if (ctrl == null) {
      ctrl = new LinkedHashMap<>();
    }

    Map<String, Object> ctxmap = new LinkedHashMap<>();
    ctxmap.put("opname", "prepare");
    ctxmap.put("ctrl", ctrl);
    Context ctx = utility.makeContext.apply(ctxmap, this.rootctx);

    Map<String, Object> options = this.options;

    Object pathRaw = Struct.getprop(fetchargs, "path");
    String path = pathRaw instanceof String ? (String) pathRaw : "";
    Object methodRaw = Struct.getprop(fetchargs, "method");
    String method = methodRaw instanceof String ? (String) methodRaw : "";
    if ("".equals(method)) {
      method = "GET";
    }

    Map<String, Object> params = Helpers.toMapAny(Struct.getprop(fetchargs, "params"));
    if (params == null) {
      params = new LinkedHashMap<>();
    }
    Map<String, Object> query = Helpers.toMapAny(Struct.getprop(fetchargs, "query"));
    if (query == null) {
      query = new LinkedHashMap<>();
    }

    Map<String, Object> headers = utility.prepareHeaders.apply(ctx);

    Object base = Struct.getprop(options, "base");
    Object prefix = Struct.getprop(options, "prefix");
    Object suffix = Struct.getprop(options, "suffix");

    Map<String, Object> specmap = new LinkedHashMap<>();
    specmap.put("base", base instanceof String ? base : "");
    specmap.put("prefix", prefix instanceof String ? prefix : "");
    specmap.put("suffix", suffix instanceof String ? suffix : "");
    specmap.put("path", path);
    specmap.put("method", method);
    specmap.put("params", params);
    specmap.put("query", query);
    specmap.put("headers", headers);
    specmap.put("body", Struct.getprop(fetchargs, "body"));
    specmap.put("step", "start");
    ctx.spec = new Spec(specmap);

    // Merge user-provided headers.
    Map<String, Object> uheaders = Helpers.toMapAny(Struct.getprop(fetchargs, "headers"));
    if (uheaders != null) {
      ctx.spec.headers.putAll(uheaders);
    }

    utility.prepareAuth.apply(ctx);

    return utility.makeFetchDef.apply(ctx);
  }

  public Map<String, Object> direct(Map<String, Object> fetchargs) {
    Utility utility = this.utility;

    if (fetchargs == null) {
      fetchargs = new LinkedHashMap<>();
    }

    Map<String, Object> ctrl = Helpers.toMapAny(Struct.getprop(fetchargs, "ctrl"));
    if (ctrl == null) {
      ctrl = new LinkedHashMap<>();
    }

    Map<String, Object> ctxmap = new LinkedHashMap<>();
    ctxmap.put("opname", "direct");
    ctxmap.put("ctrl", ctrl);
    Context ctx = utility.makeContext.apply(ctxmap, this.rootctx);

    Map<String, Object> out = new LinkedHashMap<>();

    Map<String, Object> fetchdef;
    try {
      fetchdef = this.prepare(fetchargs);
    }
    catch (RuntimeException err) {
      out.put("ok", false);
      out.put("err", err);
      return out;
    }

    Object url = fetchdef.get("url");
    Object fetched;
    try {
      fetched = utility.fetcher.fetch(ctx,
          url instanceof String ? (String) url : "", fetchdef);
    }
    catch (RuntimeException err) {
      out.put("ok", false);
      out.put("err", err);
      return out;
    }

    if (fetched == null) {
      out.put("ok", false);
      out.put("err", ctx.makeError("direct_no_response", "response: undefined"));
      return out;
    }

    if (fetched instanceof Map) {
      Map<String, Object> fm = (Map<String, Object>) fetched;
      int status = Helpers.toInt(Struct.getprop(fm, "status"));
      Object headers = Struct.getprop(fm, "headers");

      // No-body responses (204, 304) and explicit zero content-length
      // must skip JSON parsing — parsing an empty body errors.
      String contentLength = "";
      if (headers instanceof Map) {
        Object cl = ((Map<String, Object>) headers).get("content-length");
        if (cl != null) {
          contentLength = String.valueOf(cl);
        }
      }
      boolean noBody = status == 204 || status == 304 || "0".equals(contentLength);

      Object jsonData = null;
      if (!noBody) {
        Object jf = Struct.getprop(fm, "json");
        if (jf instanceof Supplier) {
          // The supplier returns null on parse error in our fetcher.
          jsonData = ((Supplier<Object>) jf).get();
        }
      }

      out.put("ok", status >= 200 && status < 300);
      out.put("status", status);
      out.put("headers", headers);
      out.put("data", jsonData);
      return out;
    }

    out.put("ok", false);
    out.put("err", ctx.makeError("direct_invalid", "invalid response type"));
    return out;
  }

  /** Builds SDK options with the test feature enabled (shared by testSDK). */
  protected static Map<String, Object> testOptions(
      Map<String, Object> testopts, Map<String, Object> sdkopts) {

    Map<String, Object> sopts = sdkopts == null
        ? new LinkedHashMap<>()
        : (Map<String, Object>) Struct.clone(sdkopts);

    Map<String, Object> topts = testopts == null
        ? new LinkedHashMap<>()
        : (Map<String, Object>) Struct.clone(testopts);
    topts.put("active", true);

    Struct.setpath(sopts, List.of("feature", "test"), topts);

    return sopts;
  }
}
