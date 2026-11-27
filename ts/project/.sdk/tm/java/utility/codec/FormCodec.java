package JAVAPACKAGE.utility.codec;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.BinarySource;
import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.utility.Sources;
import JAVAPACKAGE.utility.struct.Struct;

/** The application/x-www-form-urlencoded encoder. */
public final class FormCodec {

  private static final String FORM_MEDIA = "application/x-www-form-urlencoded";

  private static final String HEX = "0123456789ABCDEF";

  private FormCodec() {}

  // Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
  public static String formEscape(byte[] bytes) {
    StringBuilder out = new StringBuilder();
    for (byte b : bytes) {
      int c = b & 0xff;
      if ((0x30 <= c && c <= 0x39) || (0x41 <= c && c <= 0x5a) || (0x61 <= c && c <= 0x7a)
          || 0x2a == c || 0x2d == c || 0x2e == c || 0x5f == c) {
        out.append((char) c);
      }
      else if (0x20 == c) {
        out.append('+');
      }
      else {
        out.append('%').append(HEX.charAt(c >> 4)).append(HEX.charAt(c & 15));
      }
    }
    return out.toString();
  }

  private static byte[] formValue(Context ctx, String name, Object value) {
    Object content = value instanceof BinarySource ? ((BinarySource) value).data : value;
    if (Sources.isStream(content)) {
      throw ctx.makeError("binary_source_refused", "The form field \"" + name
          + "\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.");
    }
    return Sources.isBytes(content) ? Sources.toBytes(content)
        : Sources.itemText(content).getBytes(StandardCharsets.UTF_8);
  }

  public static Map<String, Object> encodeForm(Context ctx, Object data,
      Map<String, Object> lifted) {
    Object body = Struct.getprop(ctx.point, "body");
    List<String> pairs = new ArrayList<>();

    for (Sources.Item item : Sources.bodyItems(body, data, lifted)) {
      byte[] value = formValue(ctx, item.name(), item.value());
      pairs.add(formEscape(item.name().getBytes(StandardCharsets.UTF_8)) + "="
          + formEscape(value));
    }

    Object media = Struct.getprop(body, "media");
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("type", media instanceof String && !((String) media).isEmpty() ? media : FORM_MEDIA);
    out.put("body", String.join("&", pairs));
    return out;
  }
}
