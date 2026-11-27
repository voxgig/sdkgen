package SCALAPACKAGE.utility

import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.{Map => JMap}
import SCALAPACKAGE.core._
import SCALAPACKAGE.utility.struct.Struct

// The multipart codec: multipart/form-data.
object MultipartCodec {

  private val MultipartMedia = "multipart/form-data"

  private val OctetMedia = "application/octet-stream"

  private val Crlf = "\r\n"

  private lazy val random = new SecureRandom()

  def multipartBoundary(ctx: Context): String = {
    val bytes = new Array[Byte](16)
    random.nextBytes(bytes)
    bytes.map(b => "%02x".format(b & 0xff)).mkString
  }

  // Inside a quoted header parameter nothing may end the quote or the line.
  def quoted(text: String): String =
    text.replace("\\", "%5C").replace("\"", "%22").replace("\r", "%0D").replace("\n", "%0A")

  // A local path never leaves: only its last segment, and nothing for an empty one.
  def baseName(name: String): String = {
    if (name == null) return null
    val base = name.split("[\\\\/]", -1).last
    if (base.isEmpty) null else base
  }

  private final class Part(val name: String, val filename: String, val mediaType: String,
      val content: Array[Byte])

  private def media(field: JMap[String, Object]): String = field.get("media") match {
    case s: String => s
    case _ => null
  }

  private def filePart(ctx: Context, name: String, field: JMap[String, Object], value: Object): Part = {
    var content = value
    var filename: String = null
    var mediaType: String = null
    value match {
      case s: BinarySource =>
        content = s.data
        filename = baseName(s.name)
        mediaType = s.mediaType
      case _ =>
    }
    if (Binary.isStream(content)) {
      throw ctx.makeError("binary_feature_inactive", "The multipart field \"" + name +
        "\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.")
    }
    if (mediaType == null) mediaType = media(field)
    if (mediaType == null) mediaType = OctetMedia
    new Part(name, filename, mediaType, Binary.toBytes(content))
  }

  private def textPart(name: String, field: JMap[String, Object], value: Object): Part =
    new Part(name, null, media(field), Binary.toBytes(value))

  def encodeMultipart(ctx: Context, data: Object, lifted: JMap[String, Object]): BodyEncoded = {
    val body = Struct.getprop(ctx.point, "body")
    val boundary = ctx.utility.multipartBoundary(ctx)
    val out = new ByteArrayOutputStream()
    def write(text: String): Unit = out.write(text.getBytes(StandardCharsets.UTF_8))

    for (item <- Binary.bodyItems(body, data, lifted)) {
      val part = if (item.binary) filePart(ctx, item.name, item.field, item.value)
        else textPart(item.name, item.field, item.value)

      if (part.mediaType != null && (part.mediaType.contains("\r") || part.mediaType.contains("\n"))) {
        throw ctx.makeError("binary_source_refused", "The media type of the multipart field \"" +
          item.name + "\" contains a line break.")
      }

      write("--" + boundary + Crlf +
        "Content-Disposition: form-data; name=\"" + quoted(part.name) + "\"" +
        (if (part.filename == null) "" else "; filename=\"" + quoted(part.filename) + "\"") + Crlf +
        (if (part.mediaType == null) "" else "Content-Type: " + part.mediaType + Crlf) + Crlf)
      out.write(part.content)
      write(Crlf)
    }

    write("--" + boundary + "--" + Crlf)

    val declared = Struct.getprop(body, "media") match {
      case s: String => s.split(";", 2)(0).trim
      case _ => ""
    }
    new BodyEncoded((if (declared.isEmpty) MultipartMedia else declared) + "; boundary=" + boundary,
      out.toByteArray)
  }
}
