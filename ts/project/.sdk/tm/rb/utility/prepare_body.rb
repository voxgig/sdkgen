# ProjectName SDK utility: prepare_body
require_relative 'struct/voxgig_struct'
require_relative 'media'
require_relative 'binary'
module ProjectNameUtilities
  # A refusal is answered as the body; make_spec raises it.
  PrepareBody = ->(ctx) {
    if ctx.op.input == "data"
      refused = ProjectNameUtilities.lift_sources(ctx)
      return refused unless refused.nil?
      return ProjectNameUtilities.raw_source(ctx) if ProjectNameUtilities.raw_request?(ctx.point)
      body = ctx.utility.transform_request.call(ctx)
      kind = VoxgigStruct.getpath(ctx.point, "body.kind")
      return ProjectNameUtilities.encode_body(ctx, kind, body) if kind == "form" || kind == "multipart"
      return body
    end
    fields = ctx.point ? VoxgigStruct.getprop(ctx.point, "fields") : nil
    return nil unless fields.is_a?(Array) && !fields.empty?
    ProjectNameUtilities.match_body(ctx, fields)
  }

  # A source is sent as its bytes. An IO can be read once, so it is read
  # here, before the first attempt, and a retry sends the same bytes again.
  def self.raw_source(ctx)
    raw = (ctx.sources || {})[RAW_BODY]
    raw = raw.data if source?(raw)
    raw.respond_to?(:read) && !raw.is_a?(String) ? raw.read : raw
  end

  # The encoded body, with its content type replacing any the headers carry:
  # a multipart boundary is the encoder's alone to choose.
  def self.encode_body(ctx, kind, data)
    encode = ctx.utility.codec.is_a?(Hash) ? ctx.utility.codec[kind] : nil
    unless encode.respond_to?(:call)
      return ctx.make_error("body_codec_missing", "This SDK was generated without a #{kind} encoder.")
    end

    encoded = encode.call(ctx, data, ctx.sources || {})
    return encoded if encoded.is_a?(ProjectNameError)

    headers = ctx.spec ? ctx.spec.headers : nil
    if headers.is_a?(Hash)
      headers.delete_if { |k, _| k.to_s.downcase == "content-type" }
      headers["content-type"] = encoded["type"]
    end
    encoded["body"]
  end

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
