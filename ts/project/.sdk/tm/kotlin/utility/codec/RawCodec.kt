package KOTLINPACKAGE.utility.codec

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.IOException
import java.io.InputStream
import java.io.Reader

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.Response
import KOTLINPACKAGE.core.Schema
import KOTLINPACKAGE.core.SdkError
import KOTLINPACKAGE.utility.Sources
import KOTLINPACKAGE.utility.struct.Struct

/** The bounded reader of a raw response body. */
object RawCodec {

  private const val DEFAULT_MAX = 16777216L

  private const val RAW_BODY = "\$body"

  fun maxBuffer(ctx: Context): Long {
    for (v in listOf(ctx.options?.get("maxBuffer"), Schema.optspec["maxBuffer"])) {
      if (v is Number) {
        val n = v.toDouble()
        if (n.isFinite() && 0 <= n) return n.toLong()
      }
    }
    return DEFAULT_MAX
  }

  private fun cancel(body: Any?) {
    if (body is Closeable) {
      try {
        body.close()
      } catch (e: IOException) {
        // Nothing more is read from it either way.
      }
    }
  }

  private fun tooLarge(ctx: Context, code: String, max: Long, declared: Long?): SdkError =
    ctx.makeError(code, "response: body " + (if (declared == null) "is longer than"
    else "of $declared bytes exceeds") + " maxBuffer ($max bytes)")

  // The whole body, refused past the bound: by its declared length before a
  // byte is read, else by the count as it arrives.
  fun readBounded(ctx: Context, response: Response?, max: Long, code: String): ByteArray {
    val body = response?.body
    val length = Response.headerValue(response?.headers, "content-length").trim()
    val declared = if (Regex("\\d{1,18}").matches(length)) length.toLong() else null

    if (declared != null && max < declared) {
      cancel(body)
      throw tooLarge(ctx, code, max, declared)
    }

    val out = ByteArrayOutputStream()
    val take = { chunk: ByteArray, n: Int ->
      if (max < out.size().toLong() + n) throw tooLarge(ctx, code, max, null)
      out.write(chunk, 0, n)
    }

    when (body) {
      is InputStream -> try {
        val chunk = ByteArray(8192)
        var n = body.read(chunk)
        while (0 <= n) {
          take(chunk, n)
          n = body.read(chunk)
        }
      } finally {
        cancel(body)
      }
      is Reader -> try {
        val chunk = CharArray(8192)
        var n = body.read(chunk)
        while (0 <= n) {
          val bytes = String(chunk, 0, n).toByteArray(Charsets.UTF_8)
          take(bytes, bytes.size)
          n = body.read(chunk)
        }
      } finally {
        cancel(body)
      }
      null -> {}
      else -> {
        val bytes = if (Sources.isBytes(body)) Sources.toBytes(body)
        else body.toString().toByteArray(Charsets.UTF_8)
        take(bytes, bytes.size)
      }
    }
    return out.toByteArray()
  }

  // A raw success body: text into the record under `$body`; bytes only into a
  // binary handle's read, never into the record.
  fun readRaw(ctx: Context) {
    val response = ctx.response
    val result = ctx.result!!
    val transfer = ctx.ctrl.transfer
    val max = maxBuffer(ctx)

    if (true == Struct.getprop(Struct.getprop(ctx.point, "response", null), "binary", null)) {
      result.body = null
      if (transfer != null && "read" == transfer["direction"]) {
        transfer["bytes"] = readBounded(ctx, response, max, "binary_too_large")
      } else {
        cancel(response?.body)
      }
      return
    }

    val bytes = readBounded(ctx, response, max, "response_too_large")
    result.body = linkedMapOf<String, Any?>(RAW_BODY to String(bytes, Charsets.UTF_8))
  }
}
