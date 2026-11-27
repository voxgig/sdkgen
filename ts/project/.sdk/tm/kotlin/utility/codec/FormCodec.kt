package KOTLINPACKAGE.utility.codec

import KOTLINPACKAGE.core.BinarySource
import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.utility.Sources
import KOTLINPACKAGE.utility.struct.Struct

/** The application/x-www-form-urlencoded encoder. */
object FormCodec {

  private const val FORM_MEDIA = "application/x-www-form-urlencoded"

  private const val HEX = "0123456789ABCDEF"

  // Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
  fun formEscape(bytes: ByteArray): String {
    val out = StringBuilder()
    for (b in bytes) {
      val c = b.toInt() and 0xff
      if (c in 0x30..0x39 || c in 0x41..0x5a || c in 0x61..0x7a ||
        0x2a == c || 0x2d == c || 0x2e == c || 0x5f == c) {
        out.append(c.toChar())
      } else if (0x20 == c) {
        out.append('+')
      } else {
        out.append('%').append(HEX[c shr 4]).append(HEX[c and 15])
      }
    }
    return out.toString()
  }

  private fun formValue(ctx: Context, name: String, value: Any?): ByteArray {
    val content = if (value is BinarySource) value.data else value
    if (Sources.isStream(content)) {
      throw ctx.makeError("binary_source_refused", "The form field \"" + name +
        "\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.")
    }
    return if (Sources.isBytes(content)) Sources.toBytes(content)
    else Sources.itemText(content).toByteArray(Charsets.UTF_8)
  }

  fun encodeForm(ctx: Context, data: Any?, lifted: Map<String, Any?>): MutableMap<String, Any?> {
    val body = Struct.getprop(ctx.point, "body", null)
    val pairs = Sources.bodyItems(body, data, lifted).map {
      formEscape(it.name.toByteArray(Charsets.UTF_8)) + "=" +
        formEscape(formValue(ctx, it.name, it.value))
    }
    val media = Struct.getprop(body, "media", null) as? String
    return linkedMapOf(
      "type" to (if (media.isNullOrEmpty()) FORM_MEDIA else media),
      "body" to pairs.joinToString("&"),
    )
  }
}
