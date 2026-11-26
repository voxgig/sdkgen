package JAVAPACKAGE.core;

import java.util.Map;
import java.util.function.Supplier;

import JAVAPACKAGE.utility.struct.Struct;

/** A transport-level response (thin wrapper over the fetcher's map shape). */
public class Response {

  public int status = -1;
  public String statusText = "";
  public Object headers;
  public Supplier<Object> jsonFunc;
  public Object body;
  public RuntimeException err;
  // Set by a transport that could not read a non-blank body as JSON.
  public boolean unreadable;

  private static final int PREVIEW_LENGTH = 160;

  public Response(Map<String, Object> resmap) {
    Object s = Struct.getprop(resmap, "status");
    if (s != null) {
      this.status = Helpers.toInt(s);
    }

    Object st = Struct.getprop(resmap, "statusText");
    if (st instanceof String) {
      this.statusText = (String) st;
    }

    this.headers = Struct.getprop(resmap, "headers", null);

    Object jf = Struct.getprop(resmap, "json");
    if (jf instanceof Supplier) {
      this.jsonFunc = castSupplier(jf);
    }

    this.body = Struct.getprop(resmap, "body", null);

    Object e = Struct.getprop(resmap, "err");
    if (e instanceof RuntimeException) {
      this.err = (RuntimeException) e;
    }

    this.unreadable = Boolean.TRUE.equals(Struct.getprop(resmap, "unreadable"));
  }

  /**
   * A body that is not JSON. An HTTP failure keeps its own error, with the
   * response described; otherwise the code tells a wrong content type from
   * malformed JSON.
   */
  public static RuntimeException unreadableBody(Context ctx, int status, Object headers,
      Object text, Object sent, RuntimeException failed) {
    String type = headerValue(headers, "content-type");
    Object cleaned = ctx.utility.clean.apply(ctx, headerValue(sent, "user-agent"));
    String agent = cleaned == null ? "" : String.valueOf(cleaned);
    if (agent.isEmpty()) {
      agent = "transport default";
    }
    String detail = "HTTP " + status + ", content-type " + (type.isEmpty() ? "none" : type)
        + ", user-agent " + agent
        + (text != null && !isBinaryResponse(ctx.point, type) ? ", body: " + preview(ctx, text) : "");

    if (failed != null) {
      if (failed instanceof SdkError) {
        ((SdkError) failed).msg += " (" + detail + ")";
        return failed;
      }
      return new RuntimeException(failed.getMessage() + " (" + detail + ")", failed);
    }

    if (type.isEmpty() || type.toLowerCase().contains("json")) {
      return ctx.makeError("response_json_invalid",
          "response: body is not valid JSON (" + detail + ")");
    }
    return ctx.makeError("response_content_type",
        "response: expected JSON, got " + type + " (" + detail + ")");
  }

  public static String headerValue(Object headers, String name) {
    if (!(headers instanceof Map)) {
      return "";
    }
    for (Map.Entry<?, ?> entry : ((Map<?, ?>) headers).entrySet()) {
      if (name.equalsIgnoreCase(String.valueOf(entry.getKey()))) {
        return String.valueOf(entry.getValue());
      }
    }
    return "";
  }

  // A response whose body is bytes, a file's: by the model, or by the type it
  // declares. Text is no declared type, text/*, or a structured text format.
  // Only text is quoted, and clean describes bytes.
  public static boolean isBinaryResponse(Map<String, Object> point, String type) {
    Object response = point == null ? null : point.get("response");
    if (response instanceof Map && Boolean.TRUE.equals(((Map<?, ?>) response).get("binary"))) {
      return true;
    }
    String media = type.split(";", 2)[0].trim().toLowerCase(java.util.Locale.ROOT);
    return !(media.isEmpty() || media.startsWith("text/")
        || media.matches(".*(json|xml|html|javascript|ecmascript|yaml|urlencoded|graphql).*"));
  }

  // Cleaned whole: a secret the bound would split could leave its prefix.
  private static String preview(Context ctx, Object text) {
    Object cleaned = ctx.utility.clean.apply(ctx,
        String.valueOf(text).replaceAll("\\s+", " ").trim());
    String flat = cleaned == null ? "" : String.valueOf(cleaned);
    if (flat.codePointCount(0, flat.length()) <= PREVIEW_LENGTH) {
      return flat;
    }
    return flat.substring(0, flat.offsetByCodePoints(0, PREVIEW_LENGTH)) + "...";
  }

  @SuppressWarnings("unchecked")
  private static Supplier<Object> castSupplier(Object jf) {
    return (Supplier<Object>) jf;
  }
}
