package KOTLINPACKAGE.core

import java.nio.ByteBuffer

/**
 * File content a caller hands the SDK, held as given. A String is content,
 * sent encoded as UTF-8: nothing here reads a path.
 */
class BinarySource(data: ByteArray?, val name: String?, type: String?) {

  val kind: String = "bytes"
  val data: ByteArray = data ?: ByteArray(0)
  val type: String? = if (type.isNullOrEmpty()) null else type

  val size: Int get() = this.data.size

  // A source serialised anywhere is described, never copied.
  fun describe(): MutableMap<String, Any?> {
    val desc = linkedMapOf<String, Any?>("binary\$" to "bytes", "size" to this.data.size)
    if (this.type != null) {
      desc["type"] = this.type
    }
    return desc
  }

  override fun toString(): String = describe().toString()

  companion object {
    internal fun toBytes(data: Any?): ByteArray = when (data) {
      is ByteArray -> data
      is ByteBuffer -> {
        val buf = data.duplicate()
        ByteArray(buf.remaining()).also { buf.get(it) }
      }
      else -> data.toString().toByteArray(Charsets.UTF_8)
    }
  }
}
