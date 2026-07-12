package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;
import JAVAPACKAGE.utility.struct.Struct;

@SuppressWarnings({"unchecked"})
final class MakeOptions {

  private MakeOptions() {}

  static Map<String, Object> makeOptions(Context ctx) {
    Map<String, Object> options = ctx.options;
    if (options == null) {
      options = new LinkedHashMap<>();
    }

    // Merge custom utility overrides onto the utility object.
    // Read from original options before clone for parity with the donors.
    Map<String, Object> customUtils = Helpers.toMapAny(options.get("utility"));
    if (customUtils != null && ctx.utility != null) {
      ctx.utility.custom.putAll(customUtils);
    }

    Map<String, Object> opts = (Map<String, Object>) Struct.clone(options);

    Map<String, Object> config = ctx.config;
    if (config == null) {
      config = new LinkedHashMap<>();
    }
    Map<String, Object> cfgopts = Helpers.toMapAny(config.get("options"));
    if (cfgopts == null) {
      cfgopts = new LinkedHashMap<>();
    }

    Map<String, Object> optspec = (Map<String, Object>) Json.parse(
        "{"
        + "\"apikey\": \"\","
        + "\"base\": \"http://localhost:8000\","
        + "\"prefix\": \"\","
        + "\"suffix\": \"\","
        + "\"auth\": { \"prefix\": \"\" },"
        + "\"headers\": { \"`$CHILD`\": \"`$STRING`\" },"
        + "\"allow\": {"
        + "  \"method\": \"GET,PUT,POST,PATCH,DELETE,OPTIONS\","
        + "  \"op\": \"create,update,load,list,remove,command,direct\""
        + "},"
        + "\"entity\": { \"`$CHILD`\": {"
        + "  \"`$OPEN`\": true, \"active\": false, \"alias\": {} } },"
        + "\"feature\": { \"`$CHILD`\": {"
        + "  \"`$OPEN`\": true, \"active\": false } },"
        + "\"utility\": {},"
        + "\"system\": {},"
        + "\"test\": { \"active\": false, \"entity\": { \"`$OPEN`\": true } },"
        + "\"clean\": { \"keys\": \"key,token,id\" }"
        + "}");

    // Preserve system.fetch before merge/validate.
    Object sysFetch = Struct.getpath(opts, List.of("system", "fetch"));

    List<Object> mergeList = new ArrayList<>();
    mergeList.add(new LinkedHashMap<String, Object>());
    mergeList.add(cfgopts);
    mergeList.add(opts);
    Object merged = Struct.merge(mergeList);

    Map<String, Object> vopts = new LinkedHashMap<>();
    vopts.put("errs", new ArrayList<>());
    Object validated = Struct.validate(merged, optspec, vopts);
    opts = (Map<String, Object>) validated;

    // Restore system.fetch.
    if (sysFetch != null) {
      Map<String, Object> sys = Helpers.toMapAny(opts.get("system"));
      if (sys != null) {
        sys.put("fetch", sysFetch);
      }
      else {
        Map<String, Object> sm = new LinkedHashMap<>();
        sm.put("fetch", sysFetch);
        opts.put("system", sm);
      }
    }

    // Derived clean config.
    String cleanKeys = "key,token,id";
    Object ck = Struct.getpath(opts, List.of("clean", "keys"));
    if (ck instanceof String) {
      cleanKeys = (String) ck;
    }

    List<String> filtered = new ArrayList<>();
    for (String p : cleanKeys.split(",")) {
      p = p.trim();
      if (!"".equals(p)) {
        filtered.add(Struct.escre(p));
      }
    }
    String keyre = String.join("|", filtered);

    Map<String, Object> derived = new LinkedHashMap<>();
    Map<String, Object> derivedClean = new LinkedHashMap<>();
    if (!"".equals(keyre)) {
      derivedClean.put("keyre", keyre);
    }
    derived.put("clean", derivedClean);
    opts.put("__derived__", derived);

    return opts;
  }
}
