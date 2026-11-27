package JAVAPACKAGE.utility.codec;

import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Response;
import JAVAPACKAGE.core.Result;
import JAVAPACKAGE.core.Schema;
import JAVAPACKAGE.core.SdkError;
import JAVAPACKAGE.utility.Sources;
import JAVAPACKAGE.utility.struct.Struct;

/** The bounded reader of a raw response body. */
public final class RawCodec {

  private static final long DEFAULT_MAX = 16777216L;

  private static final String RAW_BODY = "$body";

  private RawCodec() {}

  public static long maxBuffer(Context ctx) {
    Object[] given = {
        ctx.options == null ? null : ctx.options.get("maxBuffer"),
        Schema.optspec().get("maxBuffer"),
    };
    for (Object val : given) {
      if (val instanceof Number) {
        double n = ((Number) val).doubleValue();
        if (Double.isFinite(n) && 0 <= n) {
          return (long) n;
        }
      }
    }
    return DEFAULT_MAX;
  }

  private static void cancel(Object body) {
    if (body instanceof Closeable) {
      try {
        ((Closeable) body).close();
      }
      catch (IOException e) {
        // Nothing more is read from it either way.
      }
    }
  }

  private static SdkError tooLarge(Context ctx, String code, long max, Long declared) {
    return ctx.makeError(code, "response: body " + (declared == null ? "is longer than"
        : "of " + declared + " bytes exceeds") + " maxBuffer (" + max + " bytes)");
  }

  // The whole body, refused past the bound: by its declared length before a
  // byte is read, else by the count as it arrives.
  public static byte[] readBounded(Context ctx, Response response, long max, String code) {
    Object body = response == null ? null : response.body;
    String length = Response.headerValue(response == null ? null : response.headers,
        "content-length").trim();
    Long declared = length.matches("\\d+") && length.length() < 19 ? Long.valueOf(length) : null;

    if (declared != null && max < declared) {
      cancel(body);
      throw tooLarge(ctx, code, max, declared);
    }

    ByteArrayOutputStream out = new ByteArrayOutputStream();
    if (body instanceof InputStream || body instanceof Reader) {
      InputStream in = body instanceof InputStream ? (InputStream) body : null;
      try {
        if (in != null) {
          byte[] chunk = new byte[8192];
          for (int n = in.read(chunk); 0 <= n; n = in.read(chunk)) {
            take(ctx, code, max, out, chunk, n);
          }
        }
        else {
          char[] chunk = new char[8192];
          Reader reader = (Reader) body;
          for (int n = reader.read(chunk); 0 <= n; n = reader.read(chunk)) {
            byte[] bytes = new String(chunk, 0, n).getBytes(StandardCharsets.UTF_8);
            take(ctx, code, max, out, bytes, bytes.length);
          }
        }
      }
      catch (IOException e) {
        throw new UncheckedIOException(e);
      }
      finally {
        cancel(body);
      }
    }
    else if (body != null) {
      byte[] bytes = Sources.isBytes(body) ? Sources.toBytes(body)
          : String.valueOf(body).getBytes(StandardCharsets.UTF_8);
      take(ctx, code, max, out, bytes, bytes.length);
    }
    return out.toByteArray();
  }

  private static void take(Context ctx, String code, long max, ByteArrayOutputStream out,
      byte[] chunk, int n) {
    if (max < (long) out.size() + n) {
      throw tooLarge(ctx, code, max, null);
    }
    out.write(chunk, 0, n);
  }

  // A raw success body: text into the record under `$body`; bytes only into a
  // binary handle's read, never into the record.
  public static void readRaw(Context ctx) {
    Response response = ctx.response;
    Result result = ctx.result;
    Map<String, Object> transfer = ctx.ctrl == null ? null : ctx.ctrl.transfer;
    long max = maxBuffer(ctx);

    if (Boolean.TRUE.equals(Struct.getprop(Struct.getprop(ctx.point, "response"), "binary"))) {
      result.body = null;
      if (transfer != null && "read".equals(transfer.get("direction"))) {
        transfer.put("bytes", readBounded(ctx, response, max, "binary_too_large"));
      }
      else {
        cancel(response == null ? null : response.body);
      }
      return;
    }

    byte[] bytes = readBounded(ctx, response, max, "response_too_large");
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(RAW_BODY, new String(bytes, StandardCharsets.UTF_8));
    result.body = body;
  }
}
