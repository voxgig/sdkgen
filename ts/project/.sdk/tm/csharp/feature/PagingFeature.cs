// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals - a `Link:
// rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body - and records
// them on `ctx.Result.Paging`. A per-call cursor/page from ctrl takes
// priority (used by auto-iteration). Parameter names (`pageParam`,
// `limitParam`, `cursorParam`), the page size (`limit`) and the start page
// (`startPage`, default 1) are configurable.

using System.Text.RegularExpressions;

using static ProjectNameSdk.Feature.FeatureOptions;

namespace ProjectNameSdk.Feature;

public class PagingFeature : BaseFeature
{
    private ProjectNameSDK? _client;
    private Dictionary<string, object?>? _options;

    // Activity tracking (mirrors the ts client._paging record).
    public Dictionary<string, object?>? Last;

    private static readonly Regex LinkNextRe =
        new(@"<([^>]+)>\s*;\s*rel=""?next""?", RegexOptions.IgnoreCase);

    public PagingFeature()
    {
        Version = "0.0.1";
        Name = "paging";
        Active = true;
    }

    public override void Init(Context ctx, Dictionary<string, object?> options)
    {
        _client = ctx.Client;
        _options = options;
        Active = FoptBool(options, "active", false);
    }

    public override void PreRequest(Context ctx)
    {
        if (!Active || !IsList(ctx))
        {
            return;
        }
        var spec = ctx.Spec;
        if (spec == null)
        {
            return;
        }
        spec.Query ??= new Dictionary<string, object?>();

        var pageParam = FoptStr(_options, "pageParam", "page");
        var limitParam = FoptStr(_options, "limitParam", "limit");
        var cursorParam = FoptStr(_options, "cursorParam", "cursor");

        // A per-call cursor/page from ctrl takes priority (auto-iteration).
        var paging = ctx.Ctrl?.Paging;

        object? cursor = null;
        var hasCursor = paging != null && paging.TryGetValue("cursor", out cursor) && cursor != null;
        if (hasCursor)
        {
            spec.Query[cursorParam] = cursor;
        }
        else if (!spec.Query.TryGetValue(pageParam, out var existing) || existing == null)
        {
            object? page = null;
            var hasPage = paging != null && paging.TryGetValue("page", out page) && page != null;
            spec.Query[pageParam] = hasPage ? page : FoptInt(_options, "startPage", 1);
        }

        if (Opt(_options, "limit") != null &&
            (!spec.Query.TryGetValue(limitParam, out var lv) || lv == null))
        {
            spec.Query[limitParam] = FoptInt(_options, "limit", 0);
        }
    }

    public override void PreResult(Context ctx)
    {
        if (!Active || !IsList(ctx))
        {
            return;
        }
        var result = ctx.Result;
        if (result == null)
        {
            return;
        }

        var headers = result.Headers;
        var body = result.Body;

        var paging = new Dictionary<string, object?>
        {
            ["hasMore"] = false,
        };
        HeaderNum(headers, "x-page", paging, "page");
        HeaderNum(headers, "x-total-count", paging, "totalCount");
        HeaderNum(headers, "x-next-page", paging, "nextPage");

        // Link: <...>; rel="next"
        var (link, hasLink) = FheaderGet(headers, "link");
        if (hasLink && link is string ls)
        {
            var m = LinkNextRe.Match(ls);
            if (m.Success)
            {
                paging["next"] = m.Groups[1].Value;
            }
        }

        // Body-level cursors.
        if (body is Dictionary<string, object?> bm)
        {
            if (bm.TryGetValue("next", out var next) && next != null &&
                (!paging.TryGetValue("next", out var pn) || pn == null))
            {
                paging["next"] = next;
            }
            if (bm.TryGetValue("cursor", out var cursor) && cursor != null)
            {
                paging["cursor"] = cursor;
            }
            if (bm.TryGetValue("nextCursor", out var nextCursor) && nextCursor != null)
            {
                paging["cursor"] = nextCursor;
            }
            if (bm.TryGetValue("hasMore", out var hasMore) && hasMore is bool hmb)
            {
                paging["hasMore"] = hmb;
            }
        }

        if (!Equals(paging["hasMore"], true) &&
            ((paging.TryGetValue("next", out var n2) && n2 != null) ||
             (paging.TryGetValue("cursor", out var c2) && c2 != null) ||
             (paging.TryGetValue("nextPage", out var np2) && np2 != null)))
        {
            paging["hasMore"] = true;
        }

        result.Paging = paging;
        Last = paging;
    }

    private bool IsList(Context ctx)
    {
        var opname = ctx.Op?.Name ?? "";
        var ops = FoptStrList(_options, "ops") ?? new List<string> { "list" };
        return ops.Contains(opname);
    }

    private static void HeaderNum(Dictionary<string, object?>? headers, string name,
        Dictionary<string, object?> paging, string key)
    {
        var (v, has) = FheaderGet(headers, name);
        if (!has)
        {
            return;
        }
        if (v is string s)
        {
            var n = FparseInt(s, -1);
            if (n >= 0)
            {
                paging[key] = n;
            }
            return;
        }
        switch (v)
        {
            case int n:
                paging[key] = n;
                break;
            case long n:
                paging[key] = (int)n;
                break;
            case double n:
                paging[key] = (int)n;
                break;
        }
    }
}
