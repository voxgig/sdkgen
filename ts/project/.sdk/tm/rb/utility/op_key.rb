# ProjectName SDK utility: op_key
require_relative 'struct/voxgig_struct'
module ProjectNameUtilities
  # The custom action a call names: `$action` in its own request argument,
  # never in a response.
  def self.op_action(ctx)
    op = ctx&.op
    req = op && op.input == "data" ? ctx.reqdata : ctx&.reqmatch
    action = req.is_a?(Hash) ? VoxgigStruct.getprop(req, "$action") : nil
    action.is_a?(String) && !action.empty? ? action : nil
  end

  # The keys an operation is looked up and filed by, most specific first:
  # `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
  def self.op_keys(ctx)
    op = ctx&.op
    name = op_key_part(op&.name) || "_"
    entity = op_key_part(op&.entity)
    if entity.nil? && ctx&.entity.respond_to?(:get_name)
      entity = op_key_part(ctx.entity.get_name)
    end
    base = "#{entity || '_'}.#{name}"
    action = op_action(ctx)
    action.nil? ? [base, name, "*"] : ["#{base}:#{action}", base, name, "*"]
  end

  def self.op_key_part(val)
    val.is_a?(String) && !val.empty? ? val : nil
  end
end
