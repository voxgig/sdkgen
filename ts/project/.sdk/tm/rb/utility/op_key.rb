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

  # The key a call is filed under where a consumer reads it: the first key,
  # with the action cleaned as the `action` field of a record, so a
  # sensitive key name masks it as well as a registered value.
  def self.op_file_key(ctx)
    keys = op_keys(ctx)
    action = op_action(ctx)
    return keys[0] if action.nil?
    clean = ctx.utility.respond_to?(:clean) ? ctx.utility.clean : nil
    out = clean.respond_to?(:call) ? clean.call(ctx, { "action" => action }) : nil
    cleaned = out.is_a?(Hash) ? out["action"] : nil
    "#{keys[1]}:#{cleaned.is_a?(String) ? cleaned : action}"
  end

  def self.op_key_part(val)
    val.is_a?(String) && !val.empty? ? val : nil
  end
end
