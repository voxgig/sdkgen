package KOTLINPACKAGE.utility

import java.io.InputStream
import java.io.Reader
import java.nio.ByteBuffer

import KOTLINPACKAGE.core.BinarySource
import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.utility.struct.Struct

// The file sources a point's binary fields carry: lifted out of the request
// data once the point is known, and laid out as a form or multipart body's
// items. Nothing here reads a path: a String is content.
@Suppress("UNCHECKED_CAST")
object Sources {

  private const val MAXDEPTH = 32

  /** One value a form or multipart body carries, in wire order. */
  data class Item(val name: String, val field: Map<String, Any?>, val value: Any, val binary: Boolean)

  fun isBytes(value: Any?): Boolean = value is ByteArray || value is ByteBuffer

  fun isStream(value: Any?): Boolean = value is InputStream || value is Reader

  fun toBytes(value: Any?): ByteArray = when (value) {
    is ByteArray -> value
    is ByteBuffer -> {
      val buf = value.duplicate()
      ByteArray(buf.remaining()).also { buf.get(it) }
    }
    else -> value.toString().toByteArray(Charsets.UTF_8)
  }

  // The path of the first source in a value, or null.
  private fun sourceAt(value: Any?, path: String, depth: Int, seen: MutableList<Any>): String? {
    if (value == null || MAXDEPTH <= depth || seen.any { it === value }) return null
    if (value is BinarySource) return path
    if (value !is Map<*, *> && value !is List<*>) return null
    seen.add(value)
    val entries: List<Pair<String, Any?>> = if (value is Map<*, *>) {
      value.entries.map { it.key.toString() to it.value }
    } else {
      (value as List<*>).mapIndexed { i, v -> i.toString() to v }
    }
    for ((key, child) in entries) {
      val found = sourceAt(child, if (path.isEmpty()) key else "$path.$key", depth + 1, seen)
      if (found != null) return found
    }
    return null
  }

  // The data keys whose values are file content: a multipart or form body's
  // binary fields, and the whole of a raw body.
  fun binaryNames(point: Any?): List<String> {
    val body = Struct.getprop(point, "body", null)
    val kind = Struct.getprop(body, "kind", null)
    if ("raw" == kind) return listOf(Media.RAW_BODY)
    if ("multipart" != kind && "form" != kind) return listOf()
    val fields = Struct.getprop(body, "fields", null) as? List<*> ?: return listOf()
    return fields.filter { true == Struct.getprop(it, "binary", null) }
      .mapNotNull { Struct.getprop(it, "name", null) as? String }
  }

  // Moves the values of binary fields out of the request data, before a hook,
  // a transform, validation or clean reads it. A source anywhere else is refused.
  fun liftSources(ctx: Context) {
    if (ctx.sources != null) return

    val names = binaryNames(ctx.point)
    val lifted = linkedMapOf<String, Any?>()
    var reqdata = ctx.reqdata

    if (names.any { reqdata.containsKey(it) }) {
      reqdata = LinkedHashMap(reqdata)
      for (name in names) {
        if (reqdata.containsKey(name)) {
          lifted[name] = reqdata.remove(name)
        }
      }
    }

    val stray = sourceAt(reqdata, "", 0, mutableListOf())
      ?: sourceAt(ctx.reqmatch, "", 0, mutableListOf())
    if (stray != null) {
      throw ctx.makeError("binary_source_refused", "A binary source was passed in \"" + stray +
        "\", which is not a field the operation declares binary.")
    }

    ctx.reqdata = reqdata
    ctx.sources = lifted
  }

  // A response the model declares to be bytes is read only through the
  // entity's binary handle, never into its data.
  fun bytesRefused(ctx: Context) {
    val response = Struct.getprop(ctx.point, "response", null)
    if ("raw" != Struct.getprop(response, "kind", null) ||
      true != Struct.getprop(response, "binary", null) || ctx.ctrl.transfer != null) {
      return
    }
    val action = Struct.getprop(Struct.getprop(ctx.point, "select", null), "\$action", null)
    val call = if (action == null) "binary()" else "binary(\"$action\")"
    throw ctx.makeError("binary_sink_required", "Operation \"" + ctx.op.name +
      "\" on entity \"" + ctx.op.entity + "\" answers bytes, which never enter the entity's " +
      "data: read them with entity." + call + ".bytes().")
  }

  // A plain value as the text of a form pair or a multipart part.
  fun itemText(value: Any?): String = when (value) {
    is String -> value
    is Boolean -> value.toString()
    is Double, is Float -> {
      val d = (value as Number).toDouble()
      if (d.isFinite() && Math.floor(d) == d && Math.abs(d) < 1e15) d.toLong().toString()
      else d.toString().replace("E", "e")
    }
    is Number -> value.toString()
    else -> Struct.jsonify(value, mapOf("indent" to 0))
  }

  private fun compareCodePoints(a: String, b: String): Int {
    var i = 0
    var j = 0
    while (i < a.length && j < b.length) {
      val ca = a.codePointAt(i)
      val cb = b.codePointAt(j)
      if (ca != cb) return ca.compareTo(cb)
      i += Character.charCount(ca)
      j += Character.charCount(cb)
    }
    return (a.length - i).compareTo(b.length - j)
  }

  // The fields the model declares, in its order, then any other key of the
  // data, in code point order. An array repeats its field per item, or is one
  // value joined by the field's `join`; an absent or null value sends nothing.
  fun bodyItems(body: Any?, data: Any?, lifted: Map<String, Any?>?): List<Item> {
    val fields = (Struct.getprop(body, "fields", null) as? List<*> ?: listOf<Any?>())
      .filter { it is Map<*, *> && it["name"] is String }
      .map { it as Map<String, Any?> }
    val plain = data as? Map<String, Any?> ?: mapOf()
    val sources = lifted ?: mapOf()
    val declared = fields.map { it["name"] as String }

    val names = declared.filter { plain.containsKey(it) || sources.containsKey(it) } +
      plain.keys.filter { !declared.contains(it) }.sortedWith { a, b -> compareCodePoints(a, b) }

    val items = mutableListOf<Item>()
    for (name in names) {
      val field = fields.firstOrNull { name == it["name"] } ?: mapOf("name" to name)
      val value = if (sources.containsKey(name)) sources[name] else plain[name]
      val file = true == field["binary"]
      if (value == null || value === Struct.UNDEF) continue
      if (value is List<*>) {
        val present = value.filter { it != null && it !== Struct.UNDEF }.map { it!! }
        val join = field["join"]
        if (!file && join is String) {
          items.add(Item(name, field, present.joinToString(join) { itemText(it) }, false))
        } else {
          present.forEach { items.add(Item(name, field, it, file)) }
        }
      } else {
        items.add(Item(name, field, value, file))
      }
    }
    return items
  }
}
