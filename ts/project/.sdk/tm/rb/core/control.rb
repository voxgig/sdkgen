# ProjectName SDK control

class ProjectNameControl
  attr_accessor :throw_err, :err, :explain, :actor, :paging, :transfer

  def initialize(opts = {})
    @throw_err = opts[:throw_err]
    @err = nil
    @explain = opts[:explain]
    # Per-call audit actor (used by the audit feature).
    @actor = opts[:actor]
    # Per-call paging override (read by the paging feature when it is active).
    @paging = opts[:paging]
    # Set by an entity's binary handle: the slot and the direction its bytes move.
    @transfer = opts[:transfer]
  end
end
