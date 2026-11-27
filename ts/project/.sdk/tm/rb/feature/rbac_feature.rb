# ProjectName SDK rbac feature
#
# Client-side role/permission enforcement. Before an operation resolves its
# endpoint, the required permission for that entity+operation is checked
# against the permissions the client holds; a disallowed call is
# short-circuited with an "rbac_denied" error and never touches the
# network. Required permissions come from "rules" (keyed by
# "<entity>.<op>:<action>", "<entity>.<op>", "<op>", or "*", most specific
# first); the default when no rule matches is
# controlled by "deny" (default: allow when unspecified). Held permissions
# are the "permissions" list (a "*" grants everything).

require_relative 'base_feature'
require_relative '../utility/op_key'

class ProjectNameRbacFeature < ProjectNameBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "rbac"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @granted = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    @granted = {}
    perms = @options["permissions"]
    if perms.is_a?(Array)
      perms.each { |p| @granted[p] = true }
    end
  end

  def PrePoint(ctx)
    return unless @active

    required = _required(ctx)
    if required.nil?
      # No rule: honour the default policy.
      return _reject(ctx, "<default-deny>") if @options["deny"] == true
      return
    end

    if @granted["*"] || @granted[required]
      _track(ctx, required, true)
      return
    end

    _reject(ctx, required)
  end

  def _required(ctx)
    rules = @options["rules"] || {}
    ProjectNameUtilities.op_keys(ctx).each do |key|
      return rules[key] unless rules[key].nil?
    end
    nil
  end

  def _reject(ctx, required)
    _track(ctx, required, false)
    err = ctx.make_error("rbac_denied",
      "Permission \"#{required}\" required for operation \"#{_opname(ctx)}\"")
    # Short-circuit endpoint resolution; make_point surfaces this error
    # before any network use.
    ctx.out["point"] = err
    err
  end

  def _track(ctx, required, allowed)
    track = @client.instance_variable_get(:@_rbac)
    if track.nil?
      track = { "allowed" => 0, "denied" => 0, "last" => nil }
      @client.instance_variable_set(:@_rbac, track)
    end
    track[allowed ? "allowed" : "denied"] += 1
    last = {
      "required" => required,
      "allowed" => allowed,
      "op" => ctx.op ? ctx.op.name : nil,
    }
    action = ProjectNameUtilities.op_action(ctx)
    last["action"] = action unless action.nil?
    track["last"] = ctx.utility.clean.call(ctx, last)
  end

  def _opname(ctx)
    name = (ctx.op && !ctx.op.name.empty?) ? ctx.op.name : "?"
    action = ProjectNameUtilities.op_action(ctx)
    action.nil? ? name : "#{name}:#{action}"
  end
end
