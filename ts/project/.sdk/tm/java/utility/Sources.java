package JAVAPACKAGE.utility;

import java.io.InputStream;
import java.io.Reader;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.BinarySource;
import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.utility.struct.Struct;

// The file sources a point's binary fields carry: lifted out of the request
// data once the point is known, and laid out as a form or multipart body's
// items. Nothing here reads a path: a String is content.
@SuppressWarnings({"unchecked"})
public final class Sources {

  private static final int MAXDEPTH = 32;

  private Sources() {}

  /** One value a form or multipart body carries, in wire order. */
  public record Item(String name, Map<String, Object> field, Object value, boolean binary) {}

  public static boolean isBytes(Object value) {
    return value instanceof byte[] || value instanceof ByteBuffer;
  }

  public static boolean isStream(Object value) {
    return value instanceof InputStream || value instanceof Reader;
  }

  public static byte[] toBytes(Object value) {
    if (value instanceof byte[]) {
      return (byte[]) value;
    }
    if (value instanceof ByteBuffer) {
      ByteBuffer buf = ((ByteBuffer) value).duplicate();
      byte[] out = new byte[buf.remaining()];
      buf.get(out);
      return out;
    }
    return String.valueOf(value).getBytes(StandardCharsets.UTF_8);
  }

  // The path of the first source in a value, or null.
  private static String sourceAt(Object value, String path, int depth,
      IdentityHashMap<Object, Boolean> seen) {
    if (value == null || MAXDEPTH <= depth || seen.containsKey(value)) {
      return null;
    }
    if (value instanceof BinarySource) {
      return path;
    }
    if (!(value instanceof Map || value instanceof List)) {
      return null;
    }
    seen.put(value, Boolean.TRUE);
    if (value instanceof Map) {
      for (Map.Entry<?, ?> e : ((Map<?, ?>) value).entrySet()) {
        String key = String.valueOf(e.getKey());
        String found = sourceAt(e.getValue(), path.isEmpty() ? key : path + "." + key,
            depth + 1, seen);
        if (found != null) {
          return found;
        }
      }
    }
    else {
      List<Object> list = (List<Object>) value;
      for (int i = 0; i < list.size(); i++) {
        String found = sourceAt(list.get(i), path.isEmpty() ? "" + i : path + "." + i,
            depth + 1, seen);
        if (found != null) {
          return found;
        }
      }
    }
    return null;
  }

  // The data keys whose values are file content: a multipart or form body's
  // binary fields, and the whole of a raw body.
  public static List<String> binaryNames(Object point) {
    List<String> names = new ArrayList<>();
    Object body = Struct.getprop(point, "body");
    Object kind = Struct.getprop(body, "kind");
    if ("raw".equals(kind)) {
      names.add(Media.RAW_BODY);
    }
    else if ("multipart".equals(kind) || "form".equals(kind)) {
      Object fields = Struct.getprop(body, "fields");
      if (fields instanceof List) {
        for (Object field : (List<Object>) fields) {
          Object name = Struct.getprop(field, "name");
          if (Boolean.TRUE.equals(Struct.getprop(field, "binary")) && name instanceof String) {
            names.add((String) name);
          }
        }
      }
    }
    return names;
  }

  // Moves the values of binary fields out of the request data, before a hook,
  // a transform, validation or clean reads it. A source anywhere else is refused.
  public static void liftSources(Context ctx) {
    if (ctx.sources != null) {
      return;
    }

    List<String> names = binaryNames(ctx.point);
    Map<String, Object> lifted = new LinkedHashMap<>();
    Map<String, Object> reqdata = ctx.reqdata;

    if (reqdata != null && names.stream().anyMatch(reqdata::containsKey)) {
      reqdata = new LinkedHashMap<>(reqdata);
      for (String name : names) {
        if (reqdata.containsKey(name)) {
          lifted.put(name, reqdata.remove(name));
        }
      }
    }

    String stray = sourceAt(reqdata, "", 0, new IdentityHashMap<>());
    if (stray == null) {
      stray = sourceAt(ctx.reqmatch, "", 0, new IdentityHashMap<>());
    }
    if (stray != null) {
      throw ctx.makeError("binary_source_refused", "A binary source was passed in \"" + stray
          + "\", which is not a field the operation declares binary.");
    }

    ctx.reqdata = reqdata;
    ctx.sources = lifted;
  }

  // A response the model declares to be bytes is read only through the
  // entity's binary handle, never into its data.
  public static void bytesRefused(Context ctx) {
    Object response = Struct.getprop(ctx.point, "response");
    if (!"raw".equals(Struct.getprop(response, "kind"))
        || !Boolean.TRUE.equals(Struct.getprop(response, "binary"))
        || (ctx.ctrl != null && ctx.ctrl.transfer != null)) {
      return;
    }
    Object action = Struct.getprop(Struct.getprop(ctx.point, "select"), "$action", null);
    String call = action == null ? "binary()" : "binary(\"" + action + "\")";
    throw ctx.makeError("binary_sink_required", "Operation \""
        + (ctx.op == null ? "" : ctx.op.name) + "\" on entity \""
        + (ctx.op == null ? "" : ctx.op.entity) + "\" answers bytes, which never enter the "
        + "entity's data: read them with entity." + call + ".bytes().");
  }

  // A plain value as the text of a form pair or a multipart part.
  public static String itemText(Object value) {
    if (value instanceof String) {
      return (String) value;
    }
    if (value instanceof Boolean) {
      return value.toString();
    }
    if (value instanceof Double || value instanceof Float) {
      double d = ((Number) value).doubleValue();
      if (Double.isFinite(d) && Math.floor(d) == d && Math.abs(d) < 1e15) {
        return Long.toString((long) d);
      }
      return Double.toString(d).replace("E", "e");
    }
    if (value instanceof Number) {
      return value.toString();
    }
    return Struct.jsonify(value, Map.of("indent", 0));
  }

  private static int compareCodePoints(String a, String b) {
    int i = 0;
    int j = 0;
    while (i < a.length() && j < b.length()) {
      int ca = a.codePointAt(i);
      int cb = b.codePointAt(j);
      if (ca != cb) {
        return Integer.compare(ca, cb);
      }
      i += Character.charCount(ca);
      j += Character.charCount(cb);
    }
    return Integer.compare(a.length() - i, b.length() - j);
  }

  // The fields the model declares, in its order, then any other key of the
  // data, in code point order. An array repeats its field per item, or is one
  // value joined by the field's `join`; an absent or null value sends nothing.
  public static List<Item> bodyItems(Object body, Object data, Map<String, Object> lifted) {
    List<Map<String, Object>> fields = new ArrayList<>();
    Object fl = Struct.getprop(body, "fields");
    if (fl instanceof List) {
      for (Object f : (List<Object>) fl) {
        if (f instanceof Map && ((Map<String, Object>) f).get("name") instanceof String) {
          fields.add((Map<String, Object>) f);
        }
      }
    }
    Map<String, Object> plain = data instanceof Map ? (Map<String, Object>) data
        : new LinkedHashMap<>();
    if (lifted == null) {
      lifted = new LinkedHashMap<>();
    }

    List<String> declared = new ArrayList<>();
    for (Map<String, Object> f : fields) {
      declared.add((String) f.get("name"));
    }

    List<String> names = new ArrayList<>();
    for (String name : declared) {
      if (plain.containsKey(name) || lifted.containsKey(name)) {
        names.add(name);
      }
    }
    List<String> rest = new ArrayList<>();
    for (String key : plain.keySet()) {
      if (!declared.contains(key)) {
        rest.add(key);
      }
    }
    rest.sort(Sources::compareCodePoints);
    names.addAll(rest);

    List<Item> items = new ArrayList<>();
    for (String name : names) {
      Map<String, Object> field = null;
      for (Map<String, Object> f : fields) {
        if (name.equals(f.get("name"))) {
          field = f;
          break;
        }
      }
      if (field == null) {
        field = new LinkedHashMap<>();
        field.put("name", name);
      }
      Object value = lifted.containsKey(name) ? lifted.get(name) : plain.get(name);
      boolean file = Boolean.TRUE.equals(field.get("binary"));
      if (value == null || value == Struct.UNDEF) {
        continue;
      }
      if (value instanceof List) {
        List<Object> present = new ArrayList<>();
        for (Object item : (List<Object>) value) {
          if (item != null && item != Struct.UNDEF) {
            present.add(item);
          }
        }
        Object join = field.get("join");
        if (!file && join instanceof String) {
          List<String> texts = new ArrayList<>();
          for (Object item : present) {
            texts.add(itemText(item));
          }
          items.add(new Item(name, field, String.join((String) join, texts), false));
        }
        else {
          for (Object item : present) {
            items.add(new Item(name, field, item, file));
          }
        }
      }
      else {
        items.add(new Item(name, field, value, file));
      }
    }
    return items;
  }
}
