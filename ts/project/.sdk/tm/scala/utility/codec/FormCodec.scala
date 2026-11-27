package SCALAPACKAGE.utility

import java.util.{Map => JMap}
import SCALAPACKAGE.core._
import SCALAPACKAGE.utility.struct.Struct

// The form codec: application/x-www-form-urlencoded.
object FormCodec {

  private val FormMedia = "application/x-www-form-urlencoded"

  private val Hex = "0123456789ABCDEF"

  // Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
  def formEscape(bytes: Array[Byte]): String = {
    val out = new StringBuilder()
    for (b <- bytes) {
      val c = b & 0xff
      if (('0' <= c && c <= '9') || ('A' <= c && c <= 'Z') || ('a' <= c && c <= 'z') ||
          '*' == c || '-' == c || '.' == c || '_' == c) out.append(c.toChar)
      else if (0x20 == c) out.append('+')
      else out.append('%').append(Hex.charAt(c >> 4)).append(Hex.charAt(c & 15))
    }
    out.toString
  }

  private def formValue(ctx: Context, name: String, value: Object): Array[Byte] = {
    val content = value match {
      case s: BinarySource => s.data
      case other => other
    }
    if (Binary.isStream(content)) {
      throw ctx.makeError("binary_source_refused", "The form field \"" + name +
        "\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.")
    }
    Binary.toBytes(content)
  }

  def encodeForm(ctx: Context, data: Object, lifted: JMap[String, Object]): BodyEncoded = {
    val body = Struct.getprop(ctx.point, "body")
    val pairs = Binary.bodyItems(body, data, lifted).map { item =>
      formEscape(Binary.toBytes(item.name)) + "=" + formEscape(formValue(ctx, item.name, item.value))
    }
    val media = Struct.getprop(body, "media") match {
      case s: String if s.nonEmpty => s
      case _ => FormMedia
    }
    new BodyEncoded(media, pairs.mkString("&"))
  }
}
