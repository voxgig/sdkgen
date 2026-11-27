package KOTLINPACKAGE.utility.codec

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.SdkEntity
import KOTLINPACKAGE.core.SdkError

/** An entity's named bytes, reached through its binary(slot). */
object HandleCodec {

  private const val RAW_BODY = "\$body"

  /**
   * A slot the entity component derived from the model: the action whose
   * points move its bytes ("" for the entity's own), and the operations that
   * read and write them (null where the slot has none).
   */
  data class SlotDef(val action: String, val read: String?, val write: String?)

  /**
   * Each call is one run of the entity's own operation on the slot's point;
   * in core only whole, in-memory bodies move.
   */
  class BinaryHandle(
    private val entity: SdkEntity,
    private val entctx: Context?,
    slots: Map<String, SlotDef>,
    slot: String?,
  ) {
    private val slot: String = slot ?: ""
    private val def: SlotDef? = slots[this.slot]

    val name: String get() = this.slot

    // The whole body, within maxBuffer.
    fun bytes(opts: Map<String, Any?>? = null, ctrl: Map<String, Any?>? = null): ByteArray {
      if (opts?.get("range") != null) throw inactive("read a range")
      val found = direction("read")
      val transfer = linkedMapOf<String, Any?>("slot" to this.slot, "direction" to "read")
      run(found.read!!, select(found), withTransfer(ctrl, transfer))
      return transfer["bytes"] as? ByteArray ?: ByteArray(0)
    }

    // Sends in-memory content as the slot's body; resolves to the entity.
    fun put(source: Any?, ctrl: Map<String, Any?>? = null): SdkEntity {
      val found = direction("write")
      val transfer = linkedMapOf<String, Any?>("slot" to this.slot, "direction" to "write")
      val data = select(found)
      data[RAW_BODY] = source
      run(found.write!!, data, withTransfer(ctrl, transfer))
      return this.entity
    }

    fun save(vararg args: Any?): Nothing = throw inactive("save")

    fun stream(vararg args: Any?): Nothing = throw inactive("stream")

    fun open(vararg args: Any?): Nothing = throw inactive("open")

    private fun run(op: String, arg: MutableMap<String, Any?>, ctrl: MutableMap<String, Any?>) {
      when (op) {
        "load" -> this.entity.load(arg, ctrl)
        "create" -> this.entity.create(arg, ctrl)
        "update" -> this.entity.update(arg, ctrl)
        else -> this.entity.patch(arg, ctrl)
      }
    }

    private fun withTransfer(ctrl: Map<String, Any?>?, transfer: MutableMap<String, Any?>) =
      LinkedHashMap<String, Any?>(ctrl ?: mapOf()).also { it["transfer"] = transfer }

    private fun select(def: SlotDef): MutableMap<String, Any?> =
      if ("" == def.action) linkedMapOf() else linkedMapOf("\$action" to def.action)

    private fun direction(way: String): SlotDef {
      val found = this.def ?: throw error("binary_slot_unknown", "Entity \"" +
        this.entity.name + "\" has no binary slot \"" + this.slot + "\".")
      if ((if ("read" == way) found.read else found.write) == null) {
        throw error("binary_slot_direction", "The binary slot \"" + this.slot +
          "\" of entity \"" + this.entity.name + "\" cannot be " +
          (if ("read" == way) "read" else "written") + ".")
      }
      return found
    }

    private fun inactive(what: String): SdkError = error("binary_feature_inactive",
      "The binary slot \"" + this.slot + "\" of entity \"" + this.entity.name + "\" cannot " +
        what + " without the binary feature; in core it answers bytes() and put().")

    private fun error(code: String, msg: String): SdkError =
      this.entctx?.makeError(code, msg) ?: SdkError(code, msg, null)
  }
}
