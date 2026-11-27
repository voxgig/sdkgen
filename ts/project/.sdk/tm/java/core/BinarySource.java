package JAVAPACKAGE.core;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * File content a caller hands the SDK, held as given. A String is content,
 * sent encoded as UTF-8: nothing here reads a path.
 */
public final class BinarySource {

  public final String kind = "bytes";
  public final byte[] data;
  public final String name;
  public final String type;

  public BinarySource(byte[] data, String name, String type) {
    this.data = data == null ? new byte[0] : data;
    this.name = name;
    this.type = type == null || type.isEmpty() ? null : type;
  }

  public int size() {
    return this.data.length;
  }

  // A source serialised anywhere is described, never copied.
  public Map<String, Object> describe() {
    Map<String, Object> desc = new LinkedHashMap<>();
    desc.put("binary$", "bytes");
    desc.put("size", this.data.length);
    if (this.type != null) {
      desc.put("type", this.type);
    }
    return desc;
  }

  @Override
  public String toString() {
    return describe().toString();
  }

  static byte[] toBytes(Object data) {
    if (data instanceof byte[]) {
      return (byte[]) data;
    }
    if (data instanceof java.nio.ByteBuffer) {
      java.nio.ByteBuffer buf = ((java.nio.ByteBuffer) data).duplicate();
      byte[] out = new byte[buf.remaining()];
      buf.get(out);
      return out;
    }
    return String.valueOf(data).getBytes(StandardCharsets.UTF_8);
  }
}
