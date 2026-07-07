# ProjectName SDK utility: make_context
require_relative '../core/context'
module ProjectNameUtilities
  MakeContext = ->(ctxmap, basectx) {
    ProjectNameContext.new(ctxmap, basectx)
  }
end
