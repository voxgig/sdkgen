# ProjectName SDK utility: form codec
require_relative '../binary'

module ProjectNameUtilities
  FORM_MEDIA = "application/x-www-form-urlencoded"

  # application/x-www-form-urlencoded byte serialisation: alphanumerics and
  # `*-._` as they are, a space as `+`, every other byte as %HH.
  def self.form_escape(bytes)
    out = +""
    bytes.each_byte do |byte|
      if (0x30..0x39).cover?(byte) || (0x41..0x5a).cover?(byte) || (0x61..0x7a).cover?(byte) ||
          byte == 0x2a || byte == 0x2d || byte == 0x2e || byte == 0x5f
        out << byte.chr
      elsif byte == 0x20
        out << "+"
      else
        out << format("%%%02X", byte)
      end
    end
    out
  end

  def self.form_value(ctx, name, value)
    content = source?(value) ? value.data : value
    if stream?(content)
      return ctx.make_error("binary_source_refused",
        "The form field \"#{name}\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.")
    end
    bytes?(content) ? content : to_bytes(item_text(content))
  end

  EncodeForm = ->(ctx, data, lifted) {
    body = VoxgigStruct.getprop(ctx.point, "body")
    pairs = []

    ProjectNameUtilities.body_items(body, data, lifted).each do |item|
      value = ProjectNameUtilities.form_value(ctx, item["name"], item["value"])
      return value if value.is_a?(ProjectNameError)
      pairs << ProjectNameUtilities.form_escape(ProjectNameUtilities.to_bytes(item["name"])) + "=" +
        ProjectNameUtilities.form_escape(value)
    end

    media = VoxgigStruct.getprop(body, "media")
    { "type" => media.is_a?(String) && !media.empty? ? media : FORM_MEDIA, "body" => pairs.join("&") }
  }
end
