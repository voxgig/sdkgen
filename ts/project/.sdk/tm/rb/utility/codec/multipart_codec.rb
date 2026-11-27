# ProjectName SDK utility: multipart codec
require 'securerandom'
require_relative '../binary'

module ProjectNameUtilities
  MULTIPART_MEDIA = "multipart/form-data"
  OCTET_MEDIA = "application/octet-stream"
  CRLF = "\r\n"

  MultipartBoundary = ->(_ctx) { SecureRandom.hex(16) }

  # Inside a quoted header parameter nothing may end the quote or the line.
  def self.multipart_quoted(text)
    text.gsub(/[\\"\r\n]/, "\\" => "%5C", "\"" => "%22", "\r" => "%0D", "\n" => "%0A")
  end

  # A local path never leaves: only its last segment, and nothing for an empty one.
  def self.base_name(name)
    return nil unless name.is_a?(String)
    base = name.split(/[\\\/]/, -1).last.to_s
    base.empty? ? nil : base
  end

  def self.file_part(ctx, name, field, value)
    content = value
    filename = nil
    type = nil

    if source?(value)
      content = value.data
      filename = base_name(value.name)
      type = value.type
    end

    if stream?(content)
      return ctx.make_error("binary_feature_inactive",
        "The multipart field \"#{name}\" holds a stream, which needs the binary feature: " \
        "pass bytes, a Blob or a source.")
    end

    {
      "name" => name,
      "filename" => filename,
      "type" => type || field["media"] || OCTET_MEDIA,
      "content" => bytes?(content) ? content : to_bytes(item_text(content)),
    }
  end

  def self.text_part(name, field, value)
    {
      "name" => name,
      "type" => field["media"],
      "content" => bytes?(value) ? value : to_bytes(item_text(value)),
    }
  end

  EncodeMultipart = ->(ctx, data, lifted) {
    body = VoxgigStruct.getprop(ctx.point, "body")
    boundary = ctx.utility.multipart_boundary.call(ctx).to_s
    out = "".b

    ProjectNameUtilities.body_items(body, data, lifted).each do |item|
      part = if item["binary"]
               ProjectNameUtilities.file_part(ctx, item["name"], item["field"], item["value"])
             else
               ProjectNameUtilities.text_part(item["name"], item["field"], item["value"])
             end
      return part if part.is_a?(ProjectNameError)

      if part["type"].is_a?(String) && part["type"].match?(/[\r\n]/)
        return ctx.make_error("binary_source_refused",
          "The media type of the multipart field \"#{item['name']}\" contains a line break.")
      end

      head = "--#{boundary}#{CRLF}Content-Disposition: form-data; name=\"" +
        ProjectNameUtilities.multipart_quoted(part["name"]) + "\"" +
        (part["filename"].nil? ? "" : "; filename=\"" +
          ProjectNameUtilities.multipart_quoted(part["filename"]) + "\"") + CRLF +
        (part["type"].nil? ? "" : "Content-Type: #{part['type']}#{CRLF}") + CRLF
      out << ProjectNameUtilities.to_bytes(head) << part["content"].b << CRLF.b
    end

    out << "--#{boundary}--#{CRLF}".b

    media = VoxgigStruct.getprop(body, "media")
    declared = media.is_a?(String) ? media.split(";").first.to_s.strip : ""
    { "type" => (declared.empty? ? MULTIPART_MEDIA : declared) + "; boundary=" + boundary, "body" => out }
  }
end
