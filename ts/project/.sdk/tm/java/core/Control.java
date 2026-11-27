package JAVAPACKAGE.core;

import java.util.Map;

/** Per-call control state: throw behaviour, explain capture, actor, paging. */
public class Control {

  // Tri-state: null (default: throw), TRUE, or FALSE (return fallback data).
  public Boolean throwing;

  public RuntimeException err;

  public Map<String, Object> explain;

  public String actor = "";

  public Map<String, Object> paging;

  // Set by an entity's binary handle: the slot, the direction its bytes move
  // (`read` or `write`), and after a read the bytes themselves.
  public Map<String, Object> transfer;
}
