# ProjectName SDK utility: binary
require 'json'
require_relative 'struct/voxgig_struct'
require_relative 'media'

# File content a caller hands the SDK, held as bytes. A String is content,
# sent as its UTF-8 encoding: nothing here reads a path.
class ProjectNameBinarySource
  attr_reader :data, :name, :type

  def initialize(data, opts = {})
    @data = data
    name = ProjectNameUtilities.binary_opt(opts, "name")
    type = ProjectNameUtilities.binary_opt(opts, "type")
    @name = name if name.is_a?(String)
    @type = type if type.is_a?(String) && !type.empty?
  end

  def kind
    "bytes"
  end

  def size
    @data.bytesize
  end

  # A source serialised anywhere is described, never copied.
  def to_h
    desc = { "binary$" => "bytes", "size" => size }
    desc["type"] = @type unless @type.nil?
    desc
  end

  def to_json(*args)
    to_h.to_json(*args)
  end

  def to_s
    "BinarySource " + JSON.generate(to_h)
  end

  def inspect
    to_s
  end
end

# The one source core builds. Ruby has no platform blob: a String of bytes
# (binary encoding) is taken as it is, any other String as its UTF-8.
module ProjectNameBinary
  def self.bytes(data, opts = {})
    ProjectNameBinarySource.new(ProjectNameUtilities.to_bytes(data), opts || {})
  end
end

module ProjectNameUtilities
  BINARY_MAXDEPTH = 32

  def self.binary_opt(opts, key)
    return nil unless opts.is_a?(Hash)
    opts.key?(key) ? opts[key] : opts[key.to_sym]
  end

  def self.bytes?(value)
    value.is_a?(String) && value.encoding == Encoding::BINARY
  end

  def self.stream?(value)
    !value.is_a?(String) && value.respond_to?(:read)
  end

  def self.to_bytes(value)
    return value.b if value.is_a?(String) && value.encoding == Encoding::BINARY
    return value.encode(Encoding::UTF_8).b if value.is_a?(String)
    value.to_s.encode(Encoding::UTF_8).b
  end

  def self.source?(value)
    value.is_a?(ProjectNameBinarySource)
  end

  # The path of the first source in a value, or nil.
  def self.source_at(value, path, depth, seen)
    return nil if depth >= BINARY_MAXDEPTH || seen.any? { |s| s.equal?(value) }
    return path if source?(value)
    pairs = if value.is_a?(Hash)
              value.map { |k, v| [k.to_s, v] }
            elsif value.is_a?(Array)
              value.each_with_index.map { |v, i| [i.to_s, v] }
            end
    return nil if pairs.nil?
    seen.push(value)
    pairs.each do |key, item|
      found = source_at(item, path.empty? ? key : path + "." + key, depth + 1, seen)
      return found unless found.nil?
    end
    nil
  end

  # The data keys whose values are file content: a multipart or form body's
  # binary fields, and the whole of a raw body.
  def self.binary_names(point)
    body = VoxgigStruct.getprop(point, "body")
    kind = VoxgigStruct.getprop(body, "kind")
    return [RAW_BODY] if kind == "raw"
    return [] unless kind == "multipart" || kind == "form"
    fields = VoxgigStruct.getprop(body, "fields")
    (fields.is_a?(Array) ? fields : []).select { |f|
      f.is_a?(Hash) && true == f["binary"] && f["name"].is_a?(String)
    }.map { |f| f["name"] }
  end

  # Moves the values of binary fields out of the request data, before a hook,
  # a transform, validation or clean reads it. A source anywhere else is
  # refused. Answers the refusal, or nil.
  def self.lift_sources(ctx)
    return nil unless ctx.sources.nil?

    names = binary_names(ctx.point)
    lifted = {}
    reqdata = ctx.reqdata

    if reqdata.is_a?(Hash) && names.any? { |name| reqdata.key?(name) }
      reqdata = reqdata.dup
      names.each do |name|
        lifted[name] = reqdata.delete(name) if reqdata.key?(name)
      end
    end

    stray = source_at(reqdata, "", 0, []) || source_at(ctx.reqmatch, "", 0, [])
    unless stray.nil?
      return ctx.make_error("binary_source_refused",
        "A binary source was passed in \"#{stray}\", which is not a field the operation declares binary.")
    end

    ctx.reqdata = reqdata
    ctx.sources = lifted
    nil
  end

  # A response the model declares to be bytes is read only through the
  # entity's binary handle, never into its data.
  def self.bytes_refused(ctx)
    response = VoxgigStruct.getprop(ctx.point, "response")
    return nil unless VoxgigStruct.getprop(response, "kind") == "raw" &&
      true == VoxgigStruct.getprop(response, "binary") && ctx.ctrl.transfer.nil?
    action = VoxgigStruct.getprop(VoxgigStruct.getprop(ctx.point, "select"), "$action")
    call = action.nil? ? "binary" : "binary(\"#{action}\")"
    ctx.make_error("binary_sink_required",
      "Operation \"#{ctx.op&.name}\" on entity \"#{ctx.op&.entity}\" answers bytes, which never " \
      "enter the entity's data: read them with entity.#{call}.bytes.")
  end

  # A plain value as the text of a form pair or a multipart part.
  def self.item_text(value)
    return value if value.is_a?(String)
    if value.is_a?(Float) && value.finite? && value == value.floor && value.abs < 1e21
      return value.to_i.to_s
    end
    return value.to_s if value.is_a?(Numeric) || value == true || value == false
    JSON.generate(value)
  end

  # The values a form or multipart body carries, in wire order: the fields
  # the model declares, in its order, then any other key of the data, in
  # code point order. An array repeats its field per item, or is one value
  # joined by the field's `join`; an absent or nil value sends nothing.
  def self.body_items(body, data, lifted)
    fields = VoxgigStruct.getprop(body, "fields")
    fields = (fields.is_a?(Array) ? fields : []).select { |f| f.is_a?(Hash) && f["name"].is_a?(String) }
    declared = fields.map { |f| f["name"] }
    plain = data.is_a?(Hash) ? data : {}

    names = declared.select { |name| plain.key?(name) || lifted.key?(name) } +
      plain.keys.map(&:to_s).reject { |key| declared.include?(key) }.sort

    items = []
    names.each do |name|
      field = fields.find { |f| f["name"] == name } || { "name" => name }
      value = lifted.key?(name) ? lifted[name] : plain[name]
      file = true == field["binary"]
      next if value.nil?
      if value.is_a?(Array)
        present = value.reject(&:nil?)
        if !file && field["join"].is_a?(String)
          items << { "name" => name, "field" => field, "binary" => file,
            "value" => present.map { |item| item_text(item) }.join(field["join"]) }
        else
          present.each { |item| items << { "name" => name, "field" => field, "value" => item, "binary" => file } }
        end
      else
        items << { "name" => name, "field" => field, "value" => value, "binary" => file }
      end
    end
    items
  end
end
