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
}
