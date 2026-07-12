package SCALAPACKAGE.core

import java.util.{Map => JMap}

// Per-call control state: throw behaviour, explain capture, actor, paging.
class Control {

  // Tri-state: null (default: throw), TRUE, or FALSE (return fallback data).
  var throwing: java.lang.Boolean = null

  var err: RuntimeException = null

  var explain: JMap[String, Object] = null

  var actor: String = ""

  var paging: JMap[String, Object] = null
}
