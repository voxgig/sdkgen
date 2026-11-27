package KOTLINPACKAGE.core

/** Per-call control state: throw behaviour, explain capture, actor, paging. */
class Control {

  // Tri-state: null (default: throw), true, or false (return fallback data).
  var throwing: Boolean? = null

  var err: RuntimeException? = null

  var explain: MutableMap<String, Any?>? = null

  var actor: String = ""

  var paging: MutableMap<String, Any?>? = null

  // Set by an entity's binary handle: the slot, the direction its bytes move
  // (`read` or `write`), and after a read the bytes themselves.
  var transfer: MutableMap<String, Any?>? = null
}
