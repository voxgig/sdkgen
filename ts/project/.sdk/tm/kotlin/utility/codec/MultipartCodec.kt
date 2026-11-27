package KOTLINPACKAGE.utility.codec

import java.io.ByteArrayOutputStream
import java.security.SecureRandom

import KOTLINPACKAGE.core.BinarySource
import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.utility.Sources
import KOTLINPACKAGE.utility.struct.Struct

/** The multipart/form-data encoder. */
object MultipartCodec {

  private const val MULTIPART_MEDIA = "multipart/form-data"

  private const val OCTET_MEDIA = "application/octet-stream"

  private const val CRLF = "\r\n"

  private val RANDOM = SecureRandom()

  fun multipartBoundary(ctx: Context): String {
    val bytes = ByteArray(16)
    RANDOM.nextBytes(bytes)
    return bytes.joinToString("") { String.format("%02x", it.toInt() and 0xff) }
  }

  // Inside a quoted header parameter nothing may end the quote or the line.
  fun quoted(text: String): String =
    text.replace("\\", "%5C").replace("\"", "%22").replace("\r", "%0D").replace("\n", "%0A")

  // A local path never leaves: only its last segment, and nothing for an empty one.
  fun baseName(name: Any?): String? {
    if (name !is String) return null
    val base = name.substring(maxOf(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1)
    return base.ifEmpty { null }
  }

  private class Part(val name: String, val filename: String?, val type: String?, val content: ByteArray)

  private fun filePart(ctx: Context, name: String, field: Map<String, Any?>, value: Any?): Part {
    var content = value
    var filename: String? = null
    var type: String? = null

    if (value is BinarySource) {
      content = value.data
      filename = baseName(value.name)
      type = value.type
    }

    if (Sources.isStream(content)) {
      throw ctx.makeError("binary_feature_inactive", "The multipart field \"" + name +
        "\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.")
    }

    return Part(name, filename, type ?: (field["media"] as? String) ?: OCTET_MEDIA,
      if (Sources.isBytes(content)) Sources.toBytes(content)
      else Sources.itemText(content).toByteArray(Charsets.UTF_8))
  }

  private fun textPart(name: String, field: Map<String, Any?>, value: Any?): Part =
    Part(name, null, field["media"] as? String,
      if (Sources.isBytes(value)) Sources.toBytes(value)
      else Sources.itemText(value).toByteArray(Charsets.UTF_8))

  fun encodeMultipart(ctx: Context, data: Any?, lifted: Map<String, Any?>): MutableMap<String, Any?> {
    val body = Struct.getprop(ctx.point, "body", null)
    val boundary = ctx.utility!!.multipartBoundary!!(ctx)
    val out = ByteArrayOutputStream()

    for (item in Sources.bodyItems(body, data, lifted)) {
      val part = if (item.binary) filePart(ctx, item.name, item.field, item.value)
      else textPart(item.name, item.field, item.value)

      val type = part.type
      if (type != null && (type.contains('\r') || type.contains('\n'))) {
        throw ctx.makeError("binary_source_refused", "The media type of the multipart field \"" +
          item.name + "\" contains a line break.")
      }

      val head = "--" + boundary + CRLF +
        "Content-Disposition: form-data; name=\"" + quoted(part.name) + "\"" +
        (if (part.filename == null) "" else "; filename=\"" + quoted(part.filename) + "\"") + CRLF +
        (if (type == null) "" else "Content-Type: " + type + CRLF) + CRLF
      out.writeBytes(head.toByteArray(Charsets.UTF_8))
      out.writeBytes(part.content)
      out.writeBytes(CRLF.toByteArray(Charsets.UTF_8))
    }

    out.writeBytes(("--" + boundary + "--" + CRLF).toByteArray(Charsets.UTF_8))

    val declared = (Struct.getprop(body, "media", null) as? String)?.split(";", limit = 2)?.get(0)?.trim() ?: ""
    return linkedMapOf(
      "type" to (declared.ifEmpty { MULTIPART_MEDIA }) + "; boundary=" + boundary,
      "body" to out.toByteArray(),
    )
  }
}
