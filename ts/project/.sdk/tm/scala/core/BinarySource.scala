package SCALAPACKAGE.core

import java.nio.charset.StandardCharsets
import java.util.{LinkedHashMap, Map => JMap}
import SCALAPACKAGE.utility.struct.Struct

// File content a caller hands the SDK, held as given. A string is content,
// sent encoded as UTF-8: nothing here reads a path.
final class BinarySource private (val data: Array[Byte], val name: String, mediaType0: String) {

  val kind: String = "bytes"

  val mediaType: String = if (mediaType0 == null || mediaType0.isEmpty) null else mediaType0

  def size: Int = data.length

  // A source serialised anywhere is described, never copied.
  def describe(): JMap[String, Object] = {
    val desc = new LinkedHashMap[String, Object]()
    desc.put("binary$", "bytes")
    desc.put("size", java.lang.Integer.valueOf(size))
    if (mediaType != null) desc.put("type", mediaType)
    desc
  }

  override def toString: String = Struct.jsonify(describe(), java.util.Map.of("indent", 0))
}

// The JVM has no Blob or File value that is content rather than a path, so
// a source is built from bytes or a string alone.
object BinarySource {

  def bytes(data: Array[Byte] | String, name: String = null, mediaType: String = null): BinarySource =
    data match {
      case text: String => new BinarySource(text.getBytes(StandardCharsets.UTF_8), name, mediaType)
      case raw: Array[Byte] => new BinarySource(raw, name, mediaType)
    }
}

// An encoded request body and the content type it must be sent with.
final class BodyEncoded(val mediaType: String, val body: Object)
