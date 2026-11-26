# ProjectName SDK utility: prepare_body
require_relative 'struct/voxgig_struct'
require_relative 'media'
module ProjectNameUtilities
  PrepareBody = ->(ctx) {
    if ctx.op.input == "data"
      return ProjectNameUtilities.raw_body(ctx.reqdata) if ProjectNameUtilities.raw_request?(ctx.point)
      return ctx.utility.transform_request.call(ctx)
    end
    fields = ctx.point ? VoxgigStruct.getprop(ctx.point, "fields") : nil
    return nil unless fields.is_a?(Array) && !fields.empty?
    ProjectNameUtilities.match_body(ctx, fields)
  }

  # A list, load or remove routed to a method with a body sends the match
  # fields that body declares, never a path parameter, and never a header,
  # cookie or query argument the body does not also declare as a field.
  def self.match_body(ctx, fields)
    point = ctx.point
    params = VoxgigStruct.getprop(point, "params")
    routed = params.is_a?(Array) ? params.dup : []
    ["params", "header", "cookie", "query"].each do |kind|
      defs = VoxgigStruct.getpath(point, "args.#{kind}")
      next unless defs.is_a?(Array)
      defs.each do |ad|
        next unless kind == "params" || true != VoxgigStruct.getprop(ad, "field")
        routed << VoxgigStruct.getprop(ad, "name")
      end
    end
    body = {}
    fields.each do |name|
      val = VoxgigStruct.getprop(ctx.reqmatch || {}, name)
      body[name] = val if !val.nil? && name != "$action" && !routed.include?(name)
    end
    body
  end
end
