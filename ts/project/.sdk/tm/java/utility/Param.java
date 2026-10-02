package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;
import JAVAPACKAGE.core.Spec;
import JAVAPACKAGE.utility.struct.Struct;

final class Param {

  private Param() {}

  static Object param(Context ctx, Object paramdef) {
    Map<String, Object> point = ctx.point;
    Spec spec = ctx.spec;
    Map<String, Object> match = ctx.match;
    Map<String, Object> reqmatch = ctx.reqmatch;
    Map<String, Object> data = ctx.data;
    Map<String, Object> reqdata = ctx.reqdata;

    int pt = Struct.typify(paramdef);

    String key;
    if (0 < (Struct.T_string & pt)) {
      key = paramdef instanceof String ? (String) paramdef : "";
    }
    else {
      Object k = Struct.getprop(paramdef, "name");
      key = k instanceof String ? (String) k : "";
    }

    String akey = "";
    if (point != null) {
      Map<String, Object> alias = Helpers.toMapAny(Struct.getprop(point, "alias"));
      if (alias != null) {
        Object ak = Struct.getprop(alias, key);
        if (ak instanceof String) {
          akey = (String) ak;
        }
      }
    }

    Object val = Struct.getprop(reqmatch, key, null);

    if (val == null) {
      val = Struct.getprop(match, key, null);
    }

    if (val == null && !"".equals(akey)) {
      if (spec != null) {
        spec.alias.put(akey, key);
      }
      val = Struct.getprop(reqmatch, akey, null);
    }

    if (val == null) {
      val = Struct.getprop(reqdata, key, null);
    }

    if (val == null) {
      val = Struct.getprop(data, key, null);
    }

    if (val == null && !"".equals(akey)) {
      val = Struct.getprop(reqdata, akey, null);
      if (val == null) {
        val = Struct.getprop(data, akey, null);
      }
    }

    return val;
  }

  // One argument a point declares, with the name it travels under and the
  // value the call passes for it.
  record CallArg(String name, String wire, Object val) {}

  // The arguments a point declares in one location, query or header, each
  // with the name it travels under and the value this call passes in its
  // match or else its data. Unlike a path parameter, the entity's stored
  // match and data never supply one.
  @SuppressWarnings("unchecked")
  static List<CallArg> callArgs(Context ctx, String kind) {
    List<CallArg> out = new ArrayList<>();
    Object defs = ctx.point == null ? null : Struct.getpath(ctx.point, List.of("args", kind));
    if (defs instanceof List) {
      for (Object ad : (List<Object>) defs) {
        Object name = Struct.getprop(ad, "name", null);
        if (!(name instanceof String) || ((String) name).isEmpty()) {
          continue;
        }
        Object orig = Struct.getprop(ad, "orig", null);
        String wire = orig instanceof String && !((String) orig).isEmpty() ? (String) orig : (String) name;
        Object val = ctx.reqmatch == null ? null : Struct.getprop(ctx.reqmatch, name, null);
        if (val == null && ctx.reqdata != null) {
          val = Struct.getprop(ctx.reqdata, name, null);
        }
        out.add(new CallArg((String) name, wire, val));
      }
    }
    return out;
  }
}
