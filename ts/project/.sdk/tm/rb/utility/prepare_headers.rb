# ProjectName SDK utility: prepare_headers
require_relative 'struct/voxgig_struct'
module ProjectNameUtilities
  PrepareHeaders = ->(ctx) {
    options = ctx.client.options_map
    headers = VoxgigStruct.getprop(options, "headers")
    out = headers ? VoxgigStruct.clone(headers) : {}
    out = {} unless out.is_a?(Hash)
    # A header parameter travels as a header, under the name the definition
    # gives it, and only from this call's own arguments.
    hl = ctx.point ? VoxgigStruct.getpath(ctx.point, "args.header") : nil
    if hl.is_a?(Array)
      hl.each do |hd|
        name = VoxgigStruct.getprop(hd, "name")
        next unless name.is_a?(String) && !name.empty?
        orig = VoxgigStruct.getprop(hd, "orig")
        orig = name unless orig.is_a?(String) && !orig.empty?
        val = VoxgigStruct.getprop(ctx.reqmatch || {}, name)
        val = VoxgigStruct.getprop(ctx.reqdata || {}, name) if val.nil?
        out[orig.downcase] = VoxgigStruct.stringify(val) unless val.nil?
      end
    end
    out
  }
end
