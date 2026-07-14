package KOTLINPACKAGE.feature

import java.util.regex.Pattern

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.SdkClient

// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals and records them on
// `ctx.result.paging`.
@Suppress("UNCHECKED_CAST")
class PagingFeature : BaseFeature("paging", "0.0.1", true) {

  private var client: SdkClient? = null
  private var options: MutableMap<String, Any?>? = null

  // Activity tracking (mirrors the ts client._paging record).
  var last: MutableMap<String, Any?>? = null

  override fun init(ctx: Context, options: MutableMap<String, Any?>) {
    this.client = ctx.client
    this.options = options
    this.active = FeatureOptions.foptBool(options, "active", false)
  }

  override fun preRequest(ctx: Context) {
    if (!this.active || !isList(ctx)) {
      return
    }
    val spec = ctx.spec ?: return

    val pageParam = FeatureOptions.foptStr(this.options, "pageParam", "page")
    val limitParam = FeatureOptions.foptStr(this.options, "limitParam", "limit")
    val cursorParam = FeatureOptions.foptStr(this.options, "cursorParam", "cursor")

    // A per-call cursor/page from ctrl takes priority (auto-iteration).
    var paging = ctx.ctrl.paging
    if (paging == null) {
      paging = linkedMapOf()
    }

    val cursor = paging["cursor"]
    if (cursor != null) {
      spec.query[cursorParam] = cursor
    } else if (spec.query[pageParam] == null) {
      val page = paging["page"]
      if (page != null) {
        spec.query[pageParam] = page
      } else {
        spec.query[pageParam] = FeatureOptions.foptInt(this.options, "startPage", 1)
      }
    }

    if (this.options?.get("limit") != null && spec.query[limitParam] == null) {
      spec.query[limitParam] = FeatureOptions.foptInt(this.options, "limit", 0)
    }
  }

  override fun preResult(ctx: Context) {
    if (!this.active || !isList(ctx)) {
      return
    }
    val result = ctx.result ?: return

    val headers = result.headers
    val body = result.body

    val paging = linkedMapOf<String, Any?>()
    paging["hasMore"] = false
    headerNum(headers, "x-page", paging, "page")
    headerNum(headers, "x-total-count", paging, "totalCount")
    headerNum(headers, "x-next-page", paging, "nextPage")

    // Link: <...>; rel="next"
    val link = FeatureOptions.fheaderGet(headers, "link")
    if (link is String) {
      val mm = LINK_NEXT_RE.matcher(link)
      if (mm.find()) {
        paging["next"] = mm.group(1)
      }
    }

    // Body-level cursors.
    if (body is MutableMap<*, *>) {
      val bm = body as MutableMap<String, Any?>
      if (bm["next"] != null && paging["next"] == null) {
        paging["next"] = bm["next"]
      }
      if (bm["cursor"] != null) {
        paging["cursor"] = bm["cursor"]
      }
      if (bm["nextCursor"] != null) {
        paging["cursor"] = bm["nextCursor"]
      }
      if (bm["hasMore"] is Boolean) {
        paging["hasMore"] = bm["hasMore"]
      }
    }

    if (paging["hasMore"] != true &&
      (paging["next"] != null || paging["cursor"] != null || paging["nextPage"] != null)
    ) {
      paging["hasMore"] = true
    }

    result.paging = paging
    this.last = paging
  }

  private fun isList(ctx: Context): Boolean {
    val opname = ctx.op.name
    var ops: List<String>? = FeatureOptions.foptStrList(this.options, "ops")
    if (ops == null) {
      ops = listOf("list")
    }
    for (o in ops) {
      if (o == opname) {
        return true
      }
    }
    return false
  }

  private fun headerNum(headers: MutableMap<String, Any?>, name: String, paging: MutableMap<String, Any?>, key: String) {
    val v = FeatureOptions.fheaderGet(headers, name) ?: return
    if (v is String) {
      val n = FeatureOptions.fparseInt(v, -1)
      if (n >= 0) {
        paging[key] = n
      }
      return
    }
    if (v is Number) {
      paging[key] = v.toInt()
    }
  }

  companion object {
    private val LINK_NEXT_RE: Pattern =
      Pattern.compile("<([^>]+)>\\s*;\\s*rel=\"?next\"?", Pattern.CASE_INSENSITIVE)
  }
}
