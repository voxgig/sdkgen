# ProjectName SDK utility: param
require_relative 'struct/voxgig_struct'
require_relative '../core/helpers'
module ProjectNameUtilities
  Param = ->(ctx, paramdef) {
    point = ctx.point
    spec = ctx.spec
    match_val = ctx.match
    reqmatch = ctx.reqmatch
    data = ctx.data
    reqdata = ctx.reqdata

    pt = VoxgigStruct.typify(paramdef)
    key = if (VoxgigStruct::T_string & pt) > 0
            paramdef
          else
            k = VoxgigStruct.getprop(paramdef, "name")
            k.is_a?(String) ? k : ""
          end

    akey = ""
    if point
      alias_map = ProjectNameHelpers.to_map(VoxgigStruct.getprop(point, "alias"))
      if alias_map
        ak = VoxgigStruct.getprop(alias_map, key)
        akey = ak if ak.is_a?(String)
      end
    end

    val = VoxgigStruct.getprop(reqmatch, key)
    val = VoxgigStruct.getprop(match_val, key) if val.nil?

    if val.nil? && !akey.empty?
      spec.alias_map[akey] = key if spec
      val = VoxgigStruct.getprop(reqmatch, akey)
    end

    val = VoxgigStruct.getprop(reqdata, key) if val.nil?
    val = VoxgigStruct.getprop(data, key) if val.nil?

    if val.nil? && !akey.empty?
      val = VoxgigStruct.getprop(reqdata, akey)
      val = VoxgigStruct.getprop(data, akey) if val.nil?
    end

    val
  }

  # The arguments a point declares in one location, query or header, each
  # with the name it travels under and the value this call passes in its
  # match or else its data. Unlike a path parameter, the entity's stored match
  # and data never supply one.
  def self.call_args(ctx, kind)
    defs = ctx.point ? VoxgigStruct.getpath(ctx.point, "args.#{kind}") : nil
    return [] unless defs.is_a?(Array)
    defs.each_with_object([]) do |ad, out|
      name = VoxgigStruct.getprop(ad, "name")
      next unless name.is_a?(String) && !name.empty?
      wire = VoxgigStruct.getprop(ad, "orig")
      wire = name unless wire.is_a?(String) && !wire.empty?
      val = VoxgigStruct.getprop(ctx.reqmatch || {}, name)
      val = VoxgigStruct.getprop(ctx.reqdata || {}, name) if val.nil?
      out << [name, wire, val]
    end
  end
end
