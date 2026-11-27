package KOTLINPACKAGE.core

/** Builds the file sources a binary field or a raw body takes: bytes, or a String's UTF-8. */
class Binary {

  fun bytes(data: Any?, name: String? = null, type: String? = null): BinarySource =
    BinarySource(BinarySource.toBytes(data), name, type)

  fun bytes(data: Any?, opts: Map<String, Any?>?): BinarySource =
    bytes(data, opts?.get("name") as? String, opts?.get("type") as? String)
}
