package SCALAPACKAGE.utility

import java.io.{ByteArrayOutputStream, InputStream}
import java.nio.charset.StandardCharsets
import java.util.LinkedHashMap
import SCALAPACKAGE.core._
import SCALAPACKAGE.utility.struct.Struct

// The raw codec: a response body that is not JSON, read to a bound.
object RawCodec {

  private val DefaultMax = 16777216L

  def maxBuffer(ctx: Context): Long = {
    for (v <- Seq(Struct.getprop(ctx.options, "maxBuffer"), Schema.optspec.get("maxBuffer"))) {
      v match {
        case n: java.lang.Number if java.lang.Double.isFinite(n.doubleValue) && 0 <= n.doubleValue =>
          return n.longValue
        case _ =>
      }
    }
    DefaultMax
  }

  private def cancel(body: Object): Unit = body match {
    case in: InputStream => try in.close() catch { case _: Exception => }
    case _ =>
  }

  private def tooLarge(ctx: Context, code: String, max: Long, declared: java.lang.Long): SdkError =
    ctx.makeError(code, "response: body " + (if (declared == null) "is longer than" else
      "of " + declared + " bytes exceeds") + " maxBuffer (" + max + " bytes)")

  // The whole body, refused past the bound: by its declared length before a
  // byte is read, else by the count as it arrives.
  def readBounded(ctx: Context, response: Response, max: Long, code: String): Array[Byte] = {
    val body = if (response == null) null else response.body
    val length = Response.headerValue(if (response == null) null else response.headers,
      "content-length").trim
    if (length.matches("[0-9]+") && max < BigInt(length)) {
      cancel(body)
      throw tooLarge(ctx, code, max, java.lang.Long.valueOf(BigInt(length).min(Long.MaxValue).toLong))
    }

    body match {
      case in: InputStream =>
        try {
          val out = new ByteArrayOutputStream()
          val chunk = new Array[Byte](8192)
          var count = 0L
          var read = in.read(chunk)
          while (0 <= read) {
            count += read
            if (max < count) throw tooLarge(ctx, code, max, null)
            out.write(chunk, 0, read)
            read = in.read(chunk)
          }
          out.toByteArray
        }
        finally cancel(in)
      case _ =>
        val bytes = body match {
          case null => Array.emptyByteArray
          case other if Binary.isBytes(other) => Binary.toBytes(other)
          case s: String => s.getBytes(StandardCharsets.UTF_8)
          case other if Struct.isnode(other) => Struct.jsonify(other, java.util.Map.of("indent", 0))
              .getBytes(StandardCharsets.UTF_8)
          case other => Binary.itemText(other).getBytes(StandardCharsets.UTF_8)
        }
        if (max < bytes.length) throw tooLarge(ctx, code, max, null)
        bytes
    }
  }

  // A raw success body: text into the record under `$body`; bytes only into
  // a binary handle's read, never into the record.
  def readRaw(ctx: Context): Unit = {
    val response = ctx.response
    val result = ctx.result
    val transfer = ctx.ctrl.transfer
    val max = maxBuffer(ctx)

    if (java.lang.Boolean.TRUE == Struct.getprop(Struct.getprop(ctx.point, "response"), "binary")) {
      result.body = null
      if (transfer != null && "read" == transfer.get("direction"))
        transfer.put("bytes", readBounded(ctx, response, max, "binary_too_large"))
      else cancel(if (response == null) null else response.body)
      return
    }

    val text = new String(readBounded(ctx, response, max, "response_too_large"), StandardCharsets.UTF_8)
    val out = new LinkedHashMap[String, Object]()
    out.put(Media.RawBody, text)
    result.body = out
  }
}
