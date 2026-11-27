# ProjectName SDK utility: raw codec
require 'json'
require_relative '../../schema'
require_relative '../binary'
require_relative '../media'

module ProjectNameUtilities
  RAW_DEFAULT_MAX = 16777216
  RAW_CHUNK = 65536

  def self.max_buffer(ctx)
    opts = ctx.options.is_a?(Hash) ? ctx.options : {}
    [opts["maxBuffer"], ProjectNameSchema::OPTSPEC["maxBuffer"]].each do |val|
      n = Float(val.to_s, exception: false)
      return n.floor if !val.nil? && !n.nil? && n.finite? && n >= 0
    end
    RAW_DEFAULT_MAX
  end

  def self.raw_cancel(body)
    body.close if !body.is_a?(String) && body.respond_to?(:close)
  rescue StandardError
    nil
  end

  def self.raw_too_large(ctx, code, max, declared = nil)
    ctx.make_error(code, "response: body " +
      (declared.nil? ? "is longer than" : "of #{declared} bytes exceeds") + " maxBuffer (#{max} bytes)")
  end

  # Each chunk of a body as it arrives: a String is one chunk, an IO is read
  # in pieces, and a list of Strings is its items.
  def self.raw_chunks(body)
    return [body] if body.is_a?(String)
    if body.respond_to?(:read)
      return Enumerator.new do |out|
        loop do
          piece = body.read(RAW_CHUNK)
          break if piece.nil? || piece.empty?
          out << piece
        end
      end
    end
    return body if body.is_a?(Array) && body.all? { |c| c.is_a?(String) }
    return body if body.is_a?(Enumerator)
    [body.is_a?(Hash) || body.is_a?(Array) ? JSON.generate(body) : body.to_s]
  end

  # The whole body, refused past the bound: by its declared length before a
  # byte is read, else by the count as it arrives. Answers bytes or the refusal.
  def self.read_bounded(ctx, response, max, code)
    body = response.body
    length = header_value(response.headers, "content-length").strip
    declared = length.match?(/\A\d+\z/) ? length.to_i : nil

    if !declared.nil? && max < declared
      raw_cancel(body)
      return raw_too_large(ctx, code, max, declared)
    end

    out = "".b
    return out if body.nil?
    raw_chunks(body).each do |chunk|
      bytes = to_bytes(chunk)
      if max < out.bytesize + bytes.bytesize
        raw_cancel(body)
        return raw_too_large(ctx, code, max)
      end
      out << bytes
    end
    out
  end

  # A raw success body: text into the record under `$body`; bytes only into a
  # binary handle's read, never into the record. A refusal is the result's error.
  ReadRaw = ->(ctx) {
    response = ctx.response
    result = ctx.result
    transfer = ctx.ctrl.transfer
    max = ProjectNameUtilities.max_buffer(ctx)

    if true == VoxgigStruct.getpath(ctx.point, "response.binary")
      result.body = nil
      if transfer.is_a?(Hash) && transfer["direction"] == "read"
        bytes = ProjectNameUtilities.read_bounded(ctx, response, max, "binary_too_large")
        return result.err = bytes if bytes.is_a?(ProjectNameError)
        transfer["bytes"] = bytes
      else
        ProjectNameUtilities.raw_cancel(response.body)
      end
      return nil
    end

    bytes = ProjectNameUtilities.read_bounded(ctx, response, max, "response_too_large")
    return result.err = bytes if bytes.is_a?(ProjectNameError)
    result.body = { RAW_BODY => bytes.force_encoding(Encoding::UTF_8).scrub("�") }
    nil
  }
end
