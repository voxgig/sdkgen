package KOTLINPACKAGE.sdktest

// Where this SDK's prepareAuth puts the credential. The API's own scheme
// decides the container and the name, so the auth tests read them from a
// probe run instead of assuming the authorization header. `pair` is the
// `<scheme>=` lead-in of a cookie credential, which rides the header bag
// under "cookie"; it is empty for a header or query credential.

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue

import KOTLINPACKAGE.core.ProjectNameSDK
import KOTLINPACKAGE.core.Spec

data class AuthCredential(val bag: String, val name: String, val pair: String) {

  fun container(spec: Spec): MutableMap<String, Any?> = if ("query" == bag) spec.query else spec.headers

  companion object {
    private val COOKIE_PAIR = Regex("[^=;]+=K")

    // Null is a public API, a legitimate shape.
    fun probe(basic: Boolean): AuthCredential? {
      val client = ProjectNameSDK.testSDK(null, linkedMapOf<String, Any?>(
        "apikey" to "K",
        "secret" to (if (basic) "S" else ""),
        "auth" to linkedMapOf<String, Any?>("prefix" to "Bearer", "basic" to basic),
      ))
      val utility = client.getUtility()
      val ctx = utility.makeContext(
        linkedMapOf<String, Any?>("client" to client, "utility" to utility), client.getRootCtx())
      val spec = Spec(linkedMapOf<String, Any?>())
      ctx.spec = spec
      utility.prepareAuth(ctx)
      for (bag in listOf("headers", "query")) {
        val entry = (if ("query" == bag) spec.query else spec.headers).entries.firstOrNull() ?: continue
        val text = entry.value
        val pair = if ("headers" == bag && "cookie" == entry.key && text is String && COOKIE_PAIR.matches(text))
          text.dropLast(1) else ""
        return AuthCredential(bag, entry.key, pair)
      }
      return null
    }

    // The second probe switches Basic on: an HTTP Basic API's config carries
    // `auth.basic: true`, whose branch writes nothing without a secret, so a
    // probe left on that branch would read an auth-active SDK as public.
    fun discover(): AuthCredential? {
      val cred = probe(false)
      assertEquals(null == cred, null == probe(true), "credential probe missed Basic auth")
      return cred
    }

    fun expected(cred: AuthCredential?, prefix: String, key: String): Any? = when {
      null == cred -> null
      "" != cred.pair -> cred.pair + key
      "headers" == cred.bag && "" != prefix -> "$prefix $key"
      else -> key
    }

    fun actual(spec: Spec, cred: AuthCredential?): Any? {
      if (null != cred) return cred.container(spec)[cred.name]
      assertTrue(spec.headers.isEmpty() && spec.query.isEmpty(), "public API placed a credential")
      return null
    }

    fun contains(spec: Spec, cred: AuthCredential?): Boolean {
      if (null != cred) return cred.container(spec).containsKey(cred.name)
      actual(spec, cred)
      return false
    }

    fun seed(cred: AuthCredential?): Spec {
      val spec = Spec(linkedMapOf<String, Any?>())
      if (null != cred) cred.container(spec)[cred.name] = expected(cred, "", "stale")
      return spec
    }

    // The corpus states the credential as `headers.authorization`, a
    // placeholder for wherever this SDK puts it. Only that entry moves: every
    // other header and query parameter stays where the corpus put it.
    @Suppress("UNCHECKED_CAST")
    fun retarget(node: Any?, cred: AuthCredential): Any? {
      if (node is List<*>) return node.map { retarget(it, cred) }.toMutableList()
      if (node !is Map<*, *>) return node
      val out = linkedMapOf<String, Any?>()
      for ((key, value) in node) {
        if ("headers" == key && value is Map<*, *>) {
          val headers = linkedMapOf<String, Any?>()
          for ((hk, hv) in value) if ("authorization" != hk) headers[hk.toString()] = hv
          out["headers"] = headers
        } else {
          out[key.toString()] = retarget(value, cred)
        }
      }
      val source = node["headers"]
      if (source is Map<*, *> && source.containsKey("authorization")) {
        val value = source["authorization"]
        val bag = out[cred.bag] as? MutableMap<String, Any?>
          ?: linkedMapOf<String, Any?>().also { out[cred.bag] = it }
        bag[cred.name] = if ("" != cred.pair && value is String) expected(cred, "", value) else value
      }
      return out
    }
  }
}
