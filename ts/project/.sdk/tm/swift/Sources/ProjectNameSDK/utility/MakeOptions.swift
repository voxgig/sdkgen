// ProjectName SDK utility: makeOptions - merge, validate and derive the
// client options.

import Foundation

private func buildOptSpec() -> Value {
  let authPrefix = VMap()
  authPrefix.entries["prefix"] = .string("")

  let headers = VMap()
  headers.entries["`$CHILD`"] = .string("`$STRING`")

  let allow = VMap()
  allow.entries["method"] = .string("GET,PUT,POST,PATCH,DELETE,OPTIONS")
  allow.entries["op"] = .string("create,update,load,list,remove,command,direct")

  let entityChild = VMap()
  entityChild.entries["`$OPEN`"] = .bool(true)
  entityChild.entries["active"] = .bool(false)
  entityChild.entries["alias"] = .map(VMap())
  let entity = VMap()
  entity.entries["`$CHILD`"] = .map(entityChild)

  let featureChild = VMap()
  featureChild.entries["`$OPEN`"] = .bool(true)
  featureChild.entries["active"] = .bool(false)
  let feature = VMap()
  feature.entries["`$CHILD`"] = .map(featureChild)

  let testEntity = VMap()
  testEntity.entries["`$OPEN`"] = .bool(true)
  let test = VMap()
  test.entries["active"] = .bool(false)
  test.entries["entity"] = .map(testEntity)

  let clean = VMap()
  clean.entries["keys"] = .string("key,token,id")

  let spec = VMap()
  spec.entries["apikey"] = .string("")
  spec.entries["base"] = .string("http://localhost:8000")
  spec.entries["prefix"] = .string("")
  spec.entries["suffix"] = .string("")
  spec.entries["auth"] = .map(authPrefix)
  spec.entries["headers"] = .map(headers)
  spec.entries["allow"] = .map(allow)
  spec.entries["entity"] = .map(entity)
  spec.entries["feature"] = .map(feature)
  spec.entries["utility"] = .map(VMap())
  spec.entries["system"] = .map(VMap())
  spec.entries["test"] = .map(test)
  spec.entries["clean"] = .map(clean)

  return .map(spec)
}

func makeOptionsUtil(_ ctx: Context) -> VMap {
  let options = ctx.options ?? VMap()

  // Merge custom utility overrides onto the utility object. Read from the
  // original options before clone for safety.
  if let customUtils = gp(options, "utility").asMap {
    if let utility = ctx.utility {
      for (k, v) in customUtils.entries {
        utility.custom[k] = v.asNative ?? v
      }
    }
  }

  let opts = clone(.map(options)).asMap ?? VMap()

  let config = ctx.config ?? VMap()
  let cfgopts = gp(config, "options").asMap ?? VMap()

  let optspec = buildOptSpec()

  // Preserve system.fetch across merge/validate (closures survive Clone, but
  // validation reshapes the system block).
  let sysFetch = gpath(opts, "system", "fetch")

  let merged = merge(.list([.map(VMap()), .map(cfgopts), .map(opts)]))
  let validated = validate(merged, optspec)
  let result = validated.asMap ?? VMap()

  // Restore system.fetch.
  if !isNil(sysFetch) {
    if let sm = gp(result, "system").asMap {
      sm.entries["fetch"] = sysFetch
    } else {
      let sm = VMap()
      sm.entries["fetch"] = sysFetch
      result.entries["system"] = .map(sm)
    }
  }

  // Derived clean config.
  var cleanKeys = "key,token,id"
  if let cks = gpath(result, "clean", "keys").asString { cleanKeys = cks }

  let filtered = cleanKeys.split(separator: ",", omittingEmptySubsequences: false)
    .map { $0.trimmingCharacters(in: .whitespaces) }
    .filter { $0 != "" }
    .map { escre(.string($0)) }
  let keyre = filtered.joined(separator: "|")

  let derived = VMap()
  derived.entries["clean"] = .map(VMap())
  if keyre != "" {
    let cm = VMap()
    cm.entries["keyre"] = .string(keyre)
    derived.entries["clean"] = .map(cm)
  }
  result.entries["__derived__"] = .map(derived)

  return result
}
