package SCALAPACKAGE.utility

import java.util.{LinkedHashMap, Map => JMap}
import SCALAPACKAGE.core._

// A slot the entity component derived from the model: the action whose
// points move its bytes ("" for the entity's own), and the operations that
// read and write them (null for none).
final case class BinarySlotDef(action: String, read: String, write: String)

// An entity's named bytes. Each call is one run of the entity's own
// operation on the slot's point; in core only whole, in-memory bodies move.
class BinaryHandle[E <: SdkEntity](entity: E, entctx: Context, slots: JMap[String, BinarySlotDef],
    slot0: String) {

  private val slot: String = if (slot0 == null) "" else slot0

  private val slotdef: BinarySlotDef = slots.get(slot)

  def name: String = slot

  // The whole body, within maxBuffer.
  def bytes(opts: JMap[String, Object] = null, ctrl: JMap[String, Object] = null): Array[Byte] = {
    if (opts != null && opts.get("range") != null) throw inactive("read a range")
    val sd = direction("read")
    val transfer = new LinkedHashMap[String, Object]()
    transfer.put("slot", slot)
    transfer.put("direction", "read")
    run(sd.read, select(sd), withTransfer(ctrl, transfer))
    transfer.get("bytes") match {
      case b: Array[Byte] => b
      case _ => Array.emptyByteArray
    }
  }

  // Sends in-memory content as the slot's body; resolves to the entity.
  def put(source: Object, ctrl: JMap[String, Object] = null): E = {
    val sd = direction("write")
    val transfer = new LinkedHashMap[String, Object]()
    transfer.put("slot", slot)
    transfer.put("direction", "write")
    val reqdata = select(sd)
    reqdata.put(Media.RawBody, source)
    run(sd.write, reqdata, withTransfer(ctrl, transfer))
    entity
  }

  def save(args: Object*): Array[Byte] = throw inactive("save")

  def stream(args: Object*): Iterator[Object] = throw inactive("stream")

  def open(args: Object*): Object = throw inactive("open")

  private def run(op: String, args: JMap[String, Object], ctrl: JMap[String, Object]): Object = op match {
    case "load" => entity.load(args, ctrl)
    case "create" => entity.create(args, ctrl)
    case "update" => entity.update(args, ctrl)
    case "patch" => entity.patch(args, ctrl)
    case _ => throw Helpers.unsupportedOp(op, entity.getName())
  }

  private def withTransfer(ctrl: JMap[String, Object], transfer: JMap[String, Object]): JMap[String, Object] = {
    val merged = if (ctrl == null) new LinkedHashMap[String, Object]() else new LinkedHashMap[String, Object](ctrl)
    merged.put("transfer", transfer)
    merged
  }

  private def select(sd: BinarySlotDef): JMap[String, Object] = {
    val out = new LinkedHashMap[String, Object]()
    if ("" != sd.action) out.put("$action", sd.action)
    out
  }

  private def direction(way: String): BinarySlotDef = {
    if (slotdef == null) {
      throw entctx.makeError("binary_slot_unknown", "Entity \"" + entity.getName() +
        "\" has no binary slot \"" + slot + "\".")
    }
    if (null == (if ("read" == way) slotdef.read else slotdef.write)) {
      throw entctx.makeError("binary_slot_direction", "The binary slot \"" + slot +
        "\" of entity \"" + entity.getName() + "\" cannot be " +
        (if ("read" == way) "read" else "written") + ".")
    }
    slotdef
  }

  private def inactive(what: String): SdkError =
    entctx.makeError("binary_feature_inactive", "The binary slot \"" + slot +
      "\" of entity \"" + entity.getName() + "\" cannot " + what +
      " without the binary feature; in core it answers bytes() and put().")
}
