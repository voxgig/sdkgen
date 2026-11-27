package JAVAPACKAGE.core;

import java.util.Map;

/** Builds the file sources a binary field or a raw body takes: bytes, or a String's UTF-8. */
public final class Binary {

  public BinarySource bytes(Object data) {
    return bytes(data, null, null);
  }

  public BinarySource bytes(Object data, String name, String type) {
    return new BinarySource(BinarySource.toBytes(data), name, type);
  }

  public BinarySource bytes(Object data, Map<String, Object> opts) {
    Object name = opts == null ? null : opts.get("name");
    Object type = opts == null ? null : opts.get("type");
    return bytes(data, name instanceof String ? (String) name : null,
        type instanceof String ? (String) type : null);
  }
}
