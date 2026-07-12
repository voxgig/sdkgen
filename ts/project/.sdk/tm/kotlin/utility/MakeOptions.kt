package KOTLINPACKAGE.utility

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.Helpers
import KOTLINPACKAGE.utility.struct.Struct

@Suppress("UNCHECKED_CAST")
fun makeOptions(ctx: Context): MutableMap<String, Any?> {
  var options = ctx.options
  if (options == null) {
    options = linkedMapOf()
  }

  // Merge custom utility overrides onto the utility object.
  // Read from original options before clone for parity with the donors.
  val customUtils = Helpers.toMapAny(options["utility"])
  if (customUtils != null && ctx.utility != null) {
    ctx.utility!!.custom.putAll(customUtils)
  }

  var opts = Struct.clone(options) as MutableMap<String, Any?>

  var config = ctx.config
  if (config == null) {
    config = linkedMapOf()
  }
  var cfgopts = Helpers.toMapAny(config["options"])
  if (cfgopts == null) {
    cfgopts = linkedMapOf()
  }

  val optspec = Json.parse(
    "{" +
      "\"apikey\": \"\"," +
      "\"base\": \"http://localhost:8000\"," +
      "\"prefix\": \"\"," +
      "\"suffix\": \"\"," +
      "\"auth\": { \"prefix\": \"\" }," +
      "\"headers\": { \"`\$CHILD`\": \"`\$STRING`\" }," +
      "\"allow\": {" +
      "  \"method\": \"GET,PUT,POST,PATCH,DELETE,OPTIONS\"," +
      "  \"op\": \"create,update,load,list,remove,command,direct\"" +
      "}," +
      "\"entity\": { \"`\$CHILD`\": {" +
      "  \"`\$OPEN`\": true, \"active\": false, \"alias\": {} } }," +
      "\"feature\": { \"`\$CHILD`\": {" +
      "  \"`\$OPEN`\": true, \"active\": false } }," +
      "\"utility\": {}," +
      "\"system\": {}," +
      "\"test\": { \"active\": false, \"entity\": { \"`\$OPEN`\": true } }," +
      "\"clean\": { \"keys\": \"key,token,id\" }" +
      "}",
  ) as MutableMap<String, Any?>

  // Preserve system.fetch before merge/validate.
  var sysFetch = Struct.getpath(opts, listOf("system", "fetch"))
  if (sysFetch === Struct.UNDEF) {
    sysFetch = null
  }

  val mergeList = mutableListOf<Any?>()
  mergeList.add(linkedMapOf<String, Any?>())
  mergeList.add(cfgopts)
  mergeList.add(opts)
  val merged = Struct.merge(mergeList)

  val vopts = linkedMapOf<String, Any?>()
  vopts["errs"] = mutableListOf<Any?>()
  val validated = Struct.validate(merged, optspec, vopts)
  opts = validated as MutableMap<String, Any?>

  // Restore system.fetch.
  if (sysFetch != null) {
    val sys = Helpers.toMapAny(opts["system"])
    if (sys != null) {
      sys["fetch"] = sysFetch
    } else {
      val sm = linkedMapOf<String, Any?>()
      sm["fetch"] = sysFetch
      opts["system"] = sm
    }
  }

  // Derived clean config.
  var cleanKeys = "key,token,id"
  val ck = Struct.getpath(opts, listOf("clean", "keys"))
  if (ck is String) {
    cleanKeys = ck
  }

  val filtered = mutableListOf<String>()
  for (pRaw in cleanKeys.split(",")) {
    val p = pRaw.trim()
    if ("" != p) {
      filtered.add(Struct.escre(p))
    }
  }
  val keyre = filtered.joinToString("|")

  val derived = linkedMapOf<String, Any?>()
  val derivedClean = linkedMapOf<String, Any?>()
  if ("" != keyre) {
    derivedClean["keyre"] = keyre
  }
  derived["clean"] = derivedClean
  opts["__derived__"] = derived

  return opts
}
