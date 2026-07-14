// ProjectName SDK client.

using Voxgig.Struct;

using ProjectNameSdk.Feature;

namespace ProjectNameSdk;

public class ProjectNameSDK
{
    public string Mode = "live";
    private Dictionary<string, object?> _options;
    private readonly Utility _utility;
    public List<BaseFeature> Features = new();
    private readonly Context _rootctx;

    public ProjectNameSDK(Dictionary<string, object?>? options = null)
    {
        _utility = new Utility();

        var config = SdkConfig.MakeConfig();

        _rootctx = _utility.MakeContext(new Dictionary<string, object?>
        {
            ["client"] = this,
            ["utility"] = _utility,
            ["config"] = config,
            ["options"] = options,
            ["shared"] = new Dictionary<string, object?>(),
        }, null);

        _options = _utility.MakeOptions(_rootctx);

        if (Equals(StructUtils.GetPath(_options,
            StructUtils.Jt("feature", "test", "active")), true))
        {
            Mode = "test";
        }

        _rootctx.Options = _options;

        // Add features in the resolved order (MakeOptions puts an explicit
        // list order first, else defaults to test-first). Ordering matters:
        // the `test` feature installs the base mock transport and the transport
        // features (retry/cache/netsim/proxy/ratelimit) wrap whatever is
        // current, so `test` must be added before them to sit at the base of
        // the chain.
        var featureOpts = Helpers.ToMapAny(StructUtils.GetProp(_options, "feature"))
            ?? new Dictionary<string, object?>();
        var featureOrder = StructUtils.GetPath(_options,
            StructUtils.Jt("__derived__", "featureorder")) as List<object?>
            ?? new List<object?>();
        foreach (var fnameObj in featureOrder)
        {
            var fname = fnameObj as string ?? "";
            var fopts = Helpers.ToMapAny(StructUtils.GetProp(featureOpts, fname));
            if (fopts != null &&
                fopts.TryGetValue("active", out var active) &&
                active is bool ab && ab)
            {
                _utility.FeatureAdd(_rootctx, SdkConfig.MakeFeature(fname));
            }
        }

        // Add extension features.
        if (StructUtils.GetProp(_options, "extend") is List<object?> extList)
        {
            foreach (var f in extList)
            {
                if (f is BaseFeature feat)
                {
                    _utility.FeatureAdd(_rootctx, feat);
                }
            }
        }

        // Initialize features.
        foreach (var f in Features.ToList())
        {
            _utility.FeatureInit(_rootctx, f);
        }

        _utility.FeatureHook(_rootctx, "PostConstruct");
    }

    public Dictionary<string, object?> OptionsMap()
    {
        return StructUtils.Clone(_options) as Dictionary<string, object?>
            ?? new Dictionary<string, object?>();
    }

    public Utility GetUtility()
    {
        return Utility.Copy(_utility);
    }

    public Context GetRootCtx()
    {
        return _rootctx;
    }

    public Dictionary<string, object?> Prepare(Dictionary<string, object?>? fetchargs)
    {
        var utility = _utility;

        fetchargs ??= new Dictionary<string, object?>();

        var ctrl = Helpers.ToMapAny(StructUtils.GetProp(fetchargs, "ctrl"))
            ?? new Dictionary<string, object?>();

        var ctx = utility.MakeContext(new Dictionary<string, object?>
        {
            ["opname"] = "prepare",
            ["ctrl"] = ctrl,
        }, _rootctx);

        var options = _options;

        var path = StructUtils.GetProp(fetchargs, "path") as string ?? "";
        var method = StructUtils.GetProp(fetchargs, "method") as string ?? "";
        if (method == "")
        {
            method = "GET";
        }

        var pathParams = Helpers.ToMapAny(StructUtils.GetProp(fetchargs, "params"))
            ?? new Dictionary<string, object?>();
        var query = Helpers.ToMapAny(StructUtils.GetProp(fetchargs, "query"))
            ?? new Dictionary<string, object?>();

        var headers = utility.PrepareHeaders(ctx);

        var basev = StructUtils.GetProp(options, "base") as string ?? "";
        var prefix = StructUtils.GetProp(options, "prefix") as string ?? "";
        var suffix = StructUtils.GetProp(options, "suffix") as string ?? "";

        ctx.Spec = new Spec(new Dictionary<string, object?>
        {
            ["base"] = basev,
            ["prefix"] = prefix,
            ["suffix"] = suffix,
            ["path"] = path,
            ["method"] = method,
            ["params"] = pathParams,
            ["query"] = query,
            ["headers"] = headers,
            ["body"] = StructUtils.GetProp(fetchargs, "body"),
            ["step"] = "start",
        });

        // Merge user-provided headers.
        if (StructUtils.GetProp(fetchargs, "headers") is Dictionary<string, object?> uhm)
        {
            foreach (var kv in uhm)
            {
                ctx.Spec.Headers[kv.Key] = kv.Value;
            }
        }

        utility.PrepareAuth(ctx);

        return utility.MakeFetchDef(ctx);
    }

    public Dictionary<string, object?> Direct(Dictionary<string, object?>? fetchargs)
    {
        var utility = _utility;

        Dictionary<string, object?> fetchdef;
        try
        {
            fetchdef = Prepare(fetchargs);
        }
        catch (Exception err)
        {
            return new Dictionary<string, object?>
            {
                ["ok"] = false,
                ["err"] = err,
            };
        }

        fetchargs ??= new Dictionary<string, object?>();

        var ctrl = Helpers.ToMapAny(StructUtils.GetProp(fetchargs, "ctrl"))
            ?? new Dictionary<string, object?>();

        var ctx = utility.MakeContext(new Dictionary<string, object?>
        {
            ["opname"] = "direct",
            ["ctrl"] = ctrl,
        }, _rootctx);

        var url = fetchdef.TryGetValue("url", out var u) ? u as string ?? "" : "";

        object? fetched;
        try
        {
            fetched = utility.Fetcher(ctx, url, fetchdef);
        }
        catch (Exception fetchErr)
        {
            return new Dictionary<string, object?>
            {
                ["ok"] = false,
                ["err"] = fetchErr,
            };
        }

        if (fetched == null)
        {
            return new Dictionary<string, object?>
            {
                ["ok"] = false,
                ["err"] = ctx.MakeError("direct_no_response", "response: undefined"),
            };
        }

        if (fetched is Dictionary<string, object?> fm)
        {
            var status = Helpers.ToInt(StructUtils.GetProp(fm, "status"));
            var headers = StructUtils.GetProp(fm, "headers");

            // No-body responses (204, 304) and explicit zero content-length
            // must skip JSON parsing - calling json() on an empty body errors.
            var contentLength = "";
            if (headers is Dictionary<string, object?> hm &&
                hm.TryGetValue("content-length", out var cl) && cl != null)
            {
                contentLength = StructUtils.Stringify(cl);
            }
            var noBody = status == 204 || status == 304 || contentLength == "0";

            object? jsonData = null;
            if (!noBody && StructUtils.GetProp(fm, "json") is Func<object?> jf)
            {
                // jf() returns null on parse error in our fetcher.
                jsonData = jf();
            }

            return new Dictionary<string, object?>
            {
                ["ok"] = status >= 200 && status < 300,
                ["status"] = status,
                ["headers"] = headers,
                ["data"] = jsonData,
            };
        }

        return new Dictionary<string, object?>
        {
            ["ok"] = false,
            ["err"] = ctx.MakeError("direct_invalid", "invalid response type"),
        };
    }

    // <[SLOT]>

    public static ProjectNameSDK TestSDK(Dictionary<string, object?>? testopts,
        Dictionary<string, object?>? sdkopts)
    {
        sdkopts = StructUtils.Clone(sdkopts ?? new Dictionary<string, object?>())
            as Dictionary<string, object?> ?? new Dictionary<string, object?>();

        testopts = StructUtils.Clone(testopts ?? new Dictionary<string, object?>())
            as Dictionary<string, object?> ?? new Dictionary<string, object?>();
        testopts["active"] = true;

        StructUtils.SetPath(sdkopts, StructUtils.Jt("feature", "test"), testopts);

        var sdk = new ProjectNameSDK(sdkopts)
        {
            Mode = "test",
        };

        return sdk;
    }
}
