package SCALAPACKAGE.utility

import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.{ArrayList, IdentityHashMap, LinkedHashMap, List => JList, Map => JMap}
import SCALAPACKAGE.core._
import SCALAPACKAGE.utility.struct.Struct

// The sources a request's binary fields carry, lifted out of its data, and the
// items a form or multipart body sends.
object Binary {

  private val MAXDEPTH = 32

  final class BodyItem(val name: String, val field: JMap[String, Object], val value: Object,
      val binary: Boolean)

  def isBytes(value: Object): Boolean = value match {
    case _: Array[Byte] | _: ByteBuffer => true
    case _ => false
  }

  def isStream(value: Object): Boolean = value.isInstanceOf[java.io.InputStream]

  def toBytes(value: Object): Array[Byte] = value match {
    case b: Array[Byte] => b
    case b: ByteBuffer =>
      val dup = b.duplicate()
      val out = new Array[Byte](dup.remaining())
      dup.get(out)
      out
    case s: String => s.getBytes(StandardCharsets.UTF_8)
    case other => itemText(other).getBytes(StandardCharsets.UTF_8)
  }

  // A plain value as the text of a form pair or a multipart part.
  def itemText(value: Object): String = value match {
    case null => "null"
    case s: String => s
    case b: java.lang.Boolean => if (b.booleanValue) "true" else "false"
    case n @ (_: java.lang.Integer | _: java.lang.Long | _: java.lang.Short | _: java.lang.Byte |
        _: java.math.BigInteger) => n.toString
    case n: java.lang.Number =>
      val d = n.doubleValue
      if (java.lang.Double.isFinite(d) && Math.floor(d) == d && Math.abs(d) < 1e21) d.toLong.toString
      else n.toString.toLowerCase(java.util.Locale.ROOT)
    case other => Struct.jsonify(other, java.util.Map.of("indent", 0))
  }

  // The path of the first source in a value, or null.
  private def sourceAt(value: Object, path: String, depth: Int,
      seen: IdentityHashMap[Object, Object]): String = {
    if (value == null || MAXDEPTH <= depth || seen.containsKey(value)) return null
    value match {
      case _: BinarySource => return path
      case _ if isBytes(value) || isStream(value) => return null
      case _ =>
    }
    def at(key: String) = if ("" == path) key else path + "." + key
    seen.put(value, value)
    value match {
      case m: JMap[_, _] =>
        val it = m.asInstanceOf[JMap[Object, Object]].entrySet().iterator()
        while (it.hasNext) {
          val e = it.next()
          val found = sourceAt(e.getValue, at(String.valueOf(e.getKey)), depth + 1, seen)
          if (found != null) return found
        }
      case l: JList[_] =>
        var i = 0
        while (i < l.size()) {
          val found = sourceAt(l.get(i).asInstanceOf[Object], at(i.toString), depth + 1, seen)
          if (found != null) return found
          i += 1
        }
      case _ =>
    }
    null
  }

  private def fieldsOf(body: Object): Seq[JMap[String, Object]] =
    Struct.getprop(body, "fields") match {
      case l: JList[_] => l.toArray.toSeq.collect {
        case f: JMap[_, _] if f.get("name").isInstanceOf[String] => f.asInstanceOf[JMap[String, Object]]
      }
      case _ => Seq.empty
    }

  // The data keys whose values are file content: a multipart or form body's
  // binary fields, and the whole of a raw body.
  def binaryNames(point: Object): Seq[String] = {
    val body = Struct.getprop(point, "body")
    Struct.getprop(body, "kind") match {
      case "raw" => Seq(Media.RawBody)
      case "multipart" | "form" =>
        fieldsOf(body).filter(f => java.lang.Boolean.TRUE == f.get("binary"))
          .map(f => f.get("name").asInstanceOf[String])
      case _ => Seq.empty
    }
  }

  // Moves the values of binary fields out of the request data, before a hook,
  // a transform, validation or clean reads it. A source anywhere else is refused.
  def liftSources(ctx: Context): Unit = {
    if (ctx.sources != null) return

    val names = binaryNames(ctx.point)
    val lifted = new LinkedHashMap[String, Object]()
    var reqdata = ctx.reqdata

    if (reqdata != null && names.exists(n => reqdata.containsKey(n))) {
      reqdata = new LinkedHashMap[String, Object](reqdata)
      for (name <- names if reqdata.containsKey(name)) lifted.put(name, reqdata.remove(name))
    }

    var stray = sourceAt(reqdata, "", 0, new IdentityHashMap[Object, Object]())
    if (stray == null) stray = sourceAt(ctx.reqmatch, "", 0, new IdentityHashMap[Object, Object]())
    if (stray != null) {
      throw ctx.makeError("binary_source_refused", "A binary source was passed in \"" + stray +
        "\", which is not a field the operation declares binary.")
    }

    ctx.reqdata = reqdata
    ctx.sources = lifted
  }

  // A response the model declares to be bytes is read only through the
  // entity's binary handle, never into its data.
  def bytesRefused(ctx: Context): Unit = {
    val response = Struct.getprop(ctx.point, "response")
    if ("raw" != Struct.getprop(response, "kind") ||
        java.lang.Boolean.TRUE != Struct.getprop(response, "binary") || ctx.ctrl.transfer != null) return
    val call = Struct.getprop(Struct.getprop(ctx.point, "select"), "$action") match {
      case action: String => "binary(\"" + action + "\")"
      case _ => "binary()"
    }
    throw ctx.makeError("binary_sink_required", "Operation \"" +
      (if (ctx.op == null) "" else ctx.op.name) + "\" on entity \"" +
      (if (ctx.op == null) "" else ctx.op.entity) + "\" answers bytes, which never enter the entity's data: " +
      "read them with entity." + call + ".bytes().")
  }

  // The values a form or multipart body carries, in wire order: the fields the
  // model declares, in its order, then any other key of the data, in code point
  // order. A list repeats its field per item, or is one value joined by the
  // field's `join`; an absent or null value sends nothing.
  def bodyItems(body: Object, data: Object, lifted: JMap[String, Object]): Seq[BodyItem] = {
    val fields = fieldsOf(body)
    val declared = fields.map(f => f.get("name").asInstanceOf[String])
    val plain: JMap[String, Object] = data match {
      case m: JMap[_, _] => m.asInstanceOf[JMap[String, Object]]
      case _ => new LinkedHashMap[String, Object]()
    }

    val rest = plain.keySet().toArray(Array.empty[String]).toSeq.filter(k => !declared.contains(k))
      .sortWith(codePointLess)
    val names = declared.filter(n => plain.containsKey(n) || lifted.containsKey(n)) ++ rest

    val items = new ArrayList[BodyItem]()
    for (name <- names) {
      val field = fields.find(f => name == f.get("name")).getOrElse {
        val f = new LinkedHashMap[String, Object]()
        f.put("name", name)
        f
      }
      val value = if (lifted.containsKey(name)) lifted.get(name) else plain.get(name)
      val file = java.lang.Boolean.TRUE == field.get("binary")
      value match {
        case null =>
        case l: JList[_] =>
          val present = l.toArray.toSeq.filter(_ != null)
          field.get("join") match {
            case join: String if !file =>
              items.add(new BodyItem(name, field, present.map(itemText).mkString(join), file))
            case _ => present.foreach(item => items.add(new BodyItem(name, field, item, file)))
          }
        case _ => items.add(new BodyItem(name, field, value, file))
      }
    }
    items.toArray(Array.empty[BodyItem]).toSeq
  }

  private def codePointLess(a: String, b: String): Boolean = {
    val x = a.codePoints().toArray
    val y = b.codePoints().toArray
    var i = 0
    while (i < x.length && i < y.length) {
      if (x(i) != y(i)) return x(i) < y(i)
      i += 1
    }
    x.length < y.length
  }
}
