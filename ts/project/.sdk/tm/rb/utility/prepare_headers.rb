# ProjectName SDK utility: prepare_headers
require_relative 'struct/voxgig_struct'
require_relative 'param'
require_relative 'media'
module ProjectNameUtilities
  PrepareHeaders = ->(ctx) {
    options = ctx.client.options_map
    headers = VoxgigStruct.getprop(options, "headers")
    out = headers ? VoxgigStruct.clone(headers) : {}
    out = {} unless out.is_a?(Hash)
    out = ProjectNameUtilities.media_headers(ctx.point, out)
    # A header argument replaces a default of the same name, whatever its case.
    ProjectNameUtilities.call_args(ctx, "header").each do |_name, orig, val|
      next if val.nil?
      wire = orig.downcase
      out.delete_if { |k, _| k.is_a?(String) && k.downcase == wire }
      out[wire] = VoxgigStruct.stringify(val)
    end
    out
  }
end
