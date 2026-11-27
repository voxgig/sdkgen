package JAVAPACKAGE.utility.codec;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;

import JAVAPACKAGE.core.BinarySource;
import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.utility.Sources;
import JAVAPACKAGE.utility.struct.Struct;

/** The multipart/form-data encoder. */
public final class MultipartCodec {

  private static final String MULTIPART_MEDIA = "multipart/form-data";

  private static final String OCTET_MEDIA = "application/octet-stream";

  private static final String CRLF = "\r\n";

  private static final SecureRandom RANDOM = new SecureRandom();

  private MultipartCodec() {}

  public static String multipartBoundary(Context ctx) {
    byte[] bytes = new byte[16];
    RANDOM.nextBytes(bytes);
    StringBuilder out = new StringBuilder();
    for (byte b : bytes) {
      out.append(String.format("%02x", b & 0xff));
    }
    return out.toString();
  }

  // Inside a quoted header parameter nothing may end the quote or the line.
  public static String quoted(String text) {
    return text.replace("\\", "%5C").replace("\"", "%22").replace("\r", "%0D")
        .replace("\n", "%0A");
  }

  // A local path never leaves: only its last segment, and nothing for an empty one.
  public static String baseName(Object name) {
    if (!(name instanceof String)) {
      return null;
    }
    String text = (String) name;
    int cut = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
    String base = text.substring(cut + 1);
    return base.isEmpty() ? null : base;
  }

  private record Part(String name, String filename, String type, byte[] content) {}

  private static Part filePart(Context ctx, String name, Map<String, Object> field,
      Object value) {
    Object content = value;
    String filename = null;
    String type = null;

    if (value instanceof BinarySource) {
      BinarySource source = (BinarySource) value;
      content = source.data;
      filename = baseName(source.name);
      type = source.type;
    }

    if (Sources.isStream(content)) {
      throw ctx.makeError("binary_feature_inactive", "The multipart field \"" + name
          + "\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.");
    }

    Object media = field.get("media");
    if (type == null) {
      type = media instanceof String ? (String) media : OCTET_MEDIA;
    }

    return new Part(name, filename, type, Sources.isBytes(content) ? Sources.toBytes(content)
        : Sources.itemText(content).getBytes(StandardCharsets.UTF_8));
  }

  private static Part textPart(String name, Map<String, Object> field, Object value) {
    Object media = field.get("media");
    return new Part(name, null, media instanceof String ? (String) media : null,
        Sources.isBytes(value) ? Sources.toBytes(value)
            : Sources.itemText(value).getBytes(StandardCharsets.UTF_8));
  }

  public static Map<String, Object> encodeMultipart(Context ctx, Object data,
      Map<String, Object> lifted) {
    Object body = Struct.getprop(ctx.point, "body");
    String boundary = ctx.utility.multipartBoundary.apply(ctx);
    ByteArrayOutputStream out = new ByteArrayOutputStream();

    for (Sources.Item item : Sources.bodyItems(body, data, lifted)) {
      Part part = item.binary() ? filePart(ctx, item.name(), item.field(), item.value())
          : textPart(item.name(), item.field(), item.value());

      if (part.type() != null && (part.type().contains("\r") || part.type().contains("\n"))) {
        throw ctx.makeError("binary_source_refused", "The media type of the multipart field \""
            + item.name() + "\" contains a line break.");
      }

      String head = "--" + boundary + CRLF
          + "Content-Disposition: form-data; name=\"" + quoted(part.name()) + "\""
          + (part.filename() == null ? "" : "; filename=\"" + quoted(part.filename()) + "\"")
          + CRLF
          + (part.type() == null ? "" : "Content-Type: " + part.type() + CRLF) + CRLF;
      out.writeBytes(head.getBytes(StandardCharsets.UTF_8));
      out.writeBytes(part.content());
      out.writeBytes(CRLF.getBytes(StandardCharsets.UTF_8));
    }

    out.writeBytes(("--" + boundary + "--" + CRLF).getBytes(StandardCharsets.UTF_8));

    Object media = Struct.getprop(body, "media");
    String declared = media instanceof String ? ((String) media).split(";", 2)[0].trim() : "";

    Map<String, Object> encoded = new LinkedHashMap<>();
    encoded.put("type", (declared.isEmpty() ? MULTIPART_MEDIA : declared)
        + "; boundary=" + boundary);
    encoded.put("body", out.toByteArray());
    return encoded;
  }
}
