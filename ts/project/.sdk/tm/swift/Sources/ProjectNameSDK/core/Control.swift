// ProjectName SDK - per-call control block.

import Foundation

public final class Control {
  // `throw` is a Swift keyword; the pipeline reads `throwErr == false`.
  public var throwErr: Bool? = nil
  public var err: Error? = nil
  // Explain and paging carry loose data + typed products (stored via .nat).
  public var explain: VMap? = nil
  public var actor: String = ""
  public var paging: VMap? = nil
  // Set by an entity's binary handle: the slot, the direction its bytes
  // move, and the bytes a read leaves.
  public var transfer: VMap? = nil

  public init() {}
}
