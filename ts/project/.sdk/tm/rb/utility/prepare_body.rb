# ProjectName SDK utility: prepare_body
require_relative 'media'
module ProjectNameUtilities
  PrepareBody = ->(ctx) {
    return nil unless ctx.op.input == "data"
    return ProjectNameUtilities.raw_body(ctx.reqdata) if ProjectNameUtilities.raw_request?(ctx.point)
    ctx.utility.transform_request.call(ctx)
  }
end
