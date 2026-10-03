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
    # A cookie argument travels in the cookie header as name=value, after any
    # cookies the caller's headers already send.
    cookies = ProjectNameUtilities.call_args(ctx, "cookie").reject { |_name, _orig, val| val.nil? }
      .map { |_name, orig, val| "#{orig}=#{VoxgigStruct.stringify(val)}" }
    unless cookies.empty?
      given = out.keys.select { |k| k.is_a?(String) && k.downcase == "cookie" }
      sent = given.map { |k| out[k] }.select { |v| v.is_a?(String) && !v.empty? }
      given.each { |k| out.delete(k) }
      out["cookie"] = (sent + cookies).join("; ")
    end
    out
  }
end
