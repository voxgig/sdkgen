# ProjectName SDK utility: transform_request
require_relative 'struct/voxgig_struct'
require_relative '../core/helpers'
require_relative 'param'
module ProjectNameUtilities
  # `$action` selects the point (see MakePoint); it is never an API field, so
  # the body is a copy without it. The caller's hash is left untouched.
  def self.strip_action(reqdata)
    omit_keys(reqdata, ["$action"])
  end

  # A header or query argument travels where PrepareHeaders or PrepareQuery
  # sends it, so the body is built from the request data without it.
  def self.routed_arg_names(ctx)
    (call_args(ctx, "header") + call_args(ctx, "query")).map(&:first)
  end

  def self.omit_keys(reqdata, names)
    return reqdata unless reqdata.is_a?(Hash) && names.any? { |n| reqdata.key?(n) }
    reqdata.reject { |k, _| names.include?(k) }
  end

  TransformRequest = ->(ctx) {
    spec = ctx.spec
    point = ctx.point
    spec.step = "reqform" if spec
    data = ProjectNameUtilities.omit_keys(ctx.reqdata, ProjectNameUtilities.routed_arg_names(ctx))
    transform = ProjectNameHelpers.to_map(VoxgigStruct.getprop(point, "transform"))
    return ProjectNameUtilities.strip_action(data) unless transform
    reqform = VoxgigStruct.getprop(transform, "req")
    return ProjectNameUtilities.strip_action(data) unless reqform
    ProjectNameUtilities.strip_action(VoxgigStruct.transform({ "reqdata" => data }, reqform))
  }
end
