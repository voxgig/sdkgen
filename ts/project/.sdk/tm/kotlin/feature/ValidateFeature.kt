package KOTLINPACKAGE.feature

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.Entity
import KOTLINPACKAGE.core.Schema
import KOTLINPACKAGE.core.SdkClient
import KOTLINPACKAGE.utility.struct.Struct

// Payload validation against the model's own field types. The kotlin port of
// tm/ts/src/feature/validate/ValidateFeature.ts.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary Struct.validate speaks. The generator maps them once
// (helpers/canonSpec) and emits `Schema.entityspec`, so a field whose type
// changes in the API spec changes what this feature enforces with no edit
// anywhere.
//
// WHAT IS CHECKED
//   outbound (preSpec)  the payload the caller asked to send, against
//                       spec.op[opname] - the operation's request shape.
//   inbound  (preDone)  each record the operation returned, against
//                       spec.data - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.
@Suppress("UNCHECKED_CAST")
class ValidateFeature : BaseFeature("validate", "0.0.1", true) {

  private var client: SdkClient? = null
  private var options: MutableMap<String, Any?>? = null
  private var spec: MutableMap<String, Any?> = linkedMapOf()

  private var request = true
  private var response = false
  private var mode = "throw"

  // The `onInvalid` callback, set after construction: the model types it a
  // `$FUNCTION` and an option map read out of JSON cannot carry one.
  var onInvalid: ((MutableMap<String, Any?>) -> Unit)? = null

  override fun init(ctx: Context, options: MutableMap<String, Any?>) {
    this.client = ctx.client
    this.options = options
    this.active = FeatureOptions.foptBool(options, "active", false)

    // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    // `config.options` documents them and types them; it does not inject
    // them, because each feature entry in the spec is optional and struct
    // fills in nothing through an optional union. So every feature resolves
    // its own.
    this.request = FeatureOptions.foptBool(options, "request", true)
    this.response = FeatureOptions.foptBool(options, "response", false)

    // FAIL CLOSED. Only the exact string "report" selects report mode, so a
    // typo (`mode: "thow"`) still rejects rather than silently turning
    // enforcement off - the failure nobody would notice. The option spec
    // rejects the typo outright; this is what happens if it ever does not.
    this.mode = if ("report" == FeatureOptions.foptStr(options, "mode", "throw")) {
      "report"
    } else {
      "throw"
    }

    // `strict` is applied ONCE, here, by rebuilding the spec tree without the
    // `$OPEN` markers - rather than per call, which would clone a spec for
    // every request an SDK ever makes. REBUILT, not mutated: Schema.entityspec
    // is a lazy singleton every client in the process reads.
    this.spec = if (FeatureOptions.foptBool(options, "strict", false)) {
      close(Schema.entityspec) as MutableMap<String, Any?>
    } else {
      Schema.entityspec
    }
  }

  // Outbound. makeSpec throws a RuntimeException left in ctx.out["spec"], so
  // storing the error here rejects the operation before the request is built
  // - the same seam rbac uses one stage earlier through ctx.out["point"].
  override fun preSpec(ctx: Context) {
    if (!this.active || !this.request) {
      return
    }

    val opname = opname(ctx)
    val opspec = opSpec(entitySpec(ctx), opname) ?: return

    val errs = check(ctx, payload(ctx, opname), opspec, "request")
    if (errs.isEmpty() || "report" == this.mode) {
      return
    }

    ctx.out["spec"] = ctx.makeError(
      "validate_failed",
      "Invalid " + opname + " request for entity \"" + entname(ctx) + "\": " +
        errs.joinToString("; "),
    )
  }

  // Inbound. preDone rather than preResult: the records are extracted from
  // the response body by makeResult, which runs between the two, so at
  // preResult there is nothing to check but the envelope.
  //
  // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
  // preDone hooks fire in feature ADD order, which defaults to `test` first
  // and then names sorted - and `validate` sorts last, after audit, cost,
  // debug, metrics and telemetry. Those observers therefore record the
  // operation as a success before this hook has looked at it. Activating
  // features as an ORDERED LIST fixes it.
  override fun preDone(ctx: Context) {
    if (!this.active || !this.response) {
      return
    }

    val espec = entitySpec(ctx) ?: return
    val dataspec = espec["data"] ?: return

    val result = ctx.result ?: return
    val resdata = result.resdata ?: return

    // A list op returns many records and a load returns one; both are checked
    // against the same record spec, because they are the same entity.
    val records: List<Any?> = if (resdata is List<*>) resdata else listOf(resdata)

    val errs = mutableListOf<String>()
    for (record in records) {
      if (record == null) {
        continue
      }

      // A NON-OBJECT IS A FAILURE, not something to skip. A load that
      // answered 42 where the entity's spec wants a record must not pass this
      // feature silently - struct rejects it with the field it could not find.
      errs.addAll(check(ctx, unwrap(record), dataspec, "response"))
    }

    if (errs.isEmpty() || "report" == this.mode) {
      return
    }

    val err = ctx.makeError(
      "validate_failed",
      "Invalid response for entity \"" + entname(ctx) + "\": " +
        errs.joinToString("; "),
    )

    // BOTH, and `ok` is the load-bearing half: done returns resdata whenever
    // result.ok is true and never looks at err, so setting the error alone
    // would hand the caller the very records that failed the spec.
    result.ok = false
    result.err = err

    // AND THE DATA GOES. The load/update paths copy result.resdata into the
    // entity's own state on any non-null value, BEFORE done raises - so
    // rejecting the operation while leaving the records in place would leave
    // the caller holding an entity populated from a payload this feature had
    // just declared invalid.
    result.resdata = null
  }

  // The payload an operation is about to send.
  //
  // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  // caller's argument in reqdata over the entity's data; a match op
  // (load/list/remove) carries it in reqmatch over match. That is what the
  // entity operations pass to the context and what makePoint reads - so
  // reading reqdata for every op would check a `load(mapOf("id" to ...))`
  // against the entity's STALE stored match and reject it for the id the
  // caller had just supplied.
  private fun payload(ctx: Context, opname: String): MutableMap<String, Any?> {
    val body = "create" == opname || "update" == opname || "patch" == opname

    val base = if (body) ctx.data else ctx.match
    val req = if (body) ctx.reqdata else ctx.reqmatch

    val out = linkedMapOf<String, Any?>()
    out.putAll(base)
    out.putAll(req)

    // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    // makePoint reads it off this same argument and the request transformer
    // drops it before the body is built, so a spec built from the API's own
    // fields will never name it - and under `strict` every custom-action call
    // would be rejected for the one key that made it reachable.
    out.remove("\$action")

    return out
  }

  private fun entitySpec(ctx: Context): MutableMap<String, Any?>? {
    val espec = this.spec[entname(ctx)]
    return if (espec is MutableMap<*, *>) espec as MutableMap<String, Any?> else null
  }

  private fun opSpec(espec: MutableMap<String, Any?>?, opname: String): Any? {
    val ops = espec?.get("op")
    return if (ops is MutableMap<*, *>) (ops as MutableMap<String, Any?>)[opname] else null
  }

  private fun opname(ctx: Context): String = ctx.op.name

  private fun entname(ctx: Context): String {
    val name = ctx.entity?.name
    if (name != null && name.isNotEmpty()) {
      return name
    }
    return ctx.op.entity
  }

  // One validate call. Errors are COLLECTED, never thrown: Struct.validate
  // throws on the first failure unless given an `errs` list, and a caller
  // fixing a payload wants every problem with it, not the first one.
  private fun check(ctx: Context, data: Any?, spec: Any?, direction: String): List<String> {
    val collected = mutableListOf<Any?>()
    val opts = linkedMapOf<String, Any?>("errs" to collected)

    try {
      Struct.validate(data, spec, opts)
    } catch (e: RuntimeException) {
      // A spec this port cannot run at all (rather than a payload that fails
      // it) must not take the operation down with it: report it like any
      // other failure and let `mode` decide.
      if (collected.isEmpty()) {
        collected.add(e.message ?: e.toString())
      }
    }

    val errs = collected.map { it.toString() }

    val cb = this.onInvalid
    if (errs.isNotEmpty() && cb != null) {
      // A callback receiving every failure, whatever `mode` does with it, so
      // a client can log or count invalid payloads without changing what the
      // SDK returns.
      try {
        cb(
          linkedMapOf(
            "entity" to entname(ctx),
            "op" to opname(ctx),
            "direction" to direction,
            "errs" to errs,
            "data" to data,
          ),
        )
      } catch (e: RuntimeException) {
        // A reporting callback must not fail the operation.
      }
    }

    return errs
  }

  companion object {
    // Built rather than written, so the backticks cannot be lost in an edit.
    private val OPEN = 96.toChar().toString() + "\$OPEN" + 96.toChar().toString()

    // A RESULT RECORD AS DATA.
    //
    // makeResult turns every record of a LIST into an entity instance, so what
    // reaches preDone for a list is wrappers, not records - and a wrapper
    // checked against a field spec fails on every required field while its
    // actual data goes unchecked. A load returns the record itself, so this
    // handles both.
    private fun unwrap(record: Any?): Any? {
      if (record is Entity) {
        val data = record.data()
        if (data != null) {
          return data
        }
      }
      return record
    }

    // The spec tree with every `$OPEN` marker removed, so an undeclared key is
    // an error rather than a pass. Rebuilt rather than mutated: Schema's entity
    // spec is shared by every client in the process.
    private fun close(node: Any?): Any? {
      if (node is List<*>) {
        return node.map { close(it) }.toMutableList()
      }

      if (node is Map<*, *>) {
        val out = linkedMapOf<String, Any?>()
        for ((k, v) in node) {
          val key = k.toString()
          if (OPEN != key) {
            out[key] = close(v)
          }
        }
        return out
      }

      return node
    }
  }
}
