# ProjectName SDK utility: binary handle
require_relative '../media'
require_relative '../../core/error'

# An entity's named bytes. Each call is one run of the entity's own
# operation on the slot's point; in core only whole, in-memory bodies move.
# A slot, as the entity component derived it from the model, is the action
# whose points move its bytes ("" for the entity's own) and the operations
# that read and write them: `{ "action", "read"?, "write"? }`.
class ProjectNameBinaryHandle
  def initialize(entity, slots, slot = nil)
    @entity = entity
    @slot = slot.nil? ? "" : slot.to_s
    @def = slots[@slot]
  end

  def name
    @slot
  end

  # The whole body, within maxBuffer.
  def bytes(opts = nil, ctrl = nil)
    raise inactive("read a range") if opts.is_a?(Hash) && !(opts["range"] || opts[:range]).nil?
    slot = direction("read")
    transfer = { "slot" => @slot, "direction" => "read" }
    @entity.public_send(slot["read"], slot_select(slot), (ctrl || {}).merge("transfer" => transfer))
    transfer["bytes"] || "".b
  end

  # Sends in-memory content as the slot's body; answers the entity.
  def put(source, ctrl = nil)
    slot = direction("write")
    transfer = { "slot" => @slot, "direction" => "write" }
    @entity.public_send(slot["write"], slot_select(slot).merge(ProjectNameUtilities::RAW_BODY => source),
      (ctrl || {}).merge("transfer" => transfer))
    @entity
  end

  def save(*)
    raise inactive("save")
  end

  def stream(*)
    raise inactive("stream")
  end

  def open(*)
    raise inactive("open")
  end

  private

  def slot_select(slot)
    slot["action"].to_s.empty? ? {} : { "$action" => slot["action"] }
  end

  def direction(way)
    if @def.nil?
      raise ProjectNameError.new("Entity \"#{@entity.get_name}\" has no binary slot \"#{@slot}\".",
        code: "binary_slot_unknown")
    end
    if @def[way].nil?
      raise ProjectNameError.new("The binary slot \"#{@slot}\" of entity \"#{@entity.get_name}\" " \
        "cannot be #{way == 'read' ? 'read' : 'written'}.", code: "binary_slot_direction")
    end
    @def
  end

  def inactive(what)
    ProjectNameError.new("The binary slot \"#{@slot}\" of entity \"#{@entity.get_name}\" cannot " \
      "#{what} without the binary feature; in core it answers bytes and put.",
      code: "binary_feature_inactive")
  end
end
