// ProjectName SDK utility: makeOptions - merge, validate and derive the
// client options.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Dictionary<string, object?> MakeOptionsUtil(Context ctx)
    {
        var options = ctx.Options ?? new Dictionary<string, object?>();

        // Merge custom utility overrides onto the utility object.
        // Read from original options before clone for safety.
        if (Helpers.ToMapAny(options.TryGetValue("utility", out var cu) ? cu : null)
            is Dictionary<string, object?> customUtils)
        {
            var utility = ctx.Utility;
            if (utility != null)
            {
                foreach (var kv in customUtils)
                {
                    utility.Custom[kv.Key] = kv.Value;
                }
            }
        }

        var opts = StructUtils.Clone(options) as Dictionary<string, object?>
            ?? new Dictionary<string, object?>();

        // Feature add-order. options.feature may be given as an ordered LIST of
        // { name, active, ...opts } entries (the list position IS the order in
        // which features are added), or as a { name: {opts} } map. Normalize a
        // list to a map (so merge/validate/init are unchanged) and remember the
        // explicit order; a map defaults to test-first so the `test` mock
        // transport is installed as the base of the transport wrapper chain.
        var featureorder = new List<object?>();
        if (opts.TryGetValue("feature", out var frawInit) &&
            frawInit is List<object?> flist)
        {
            var fmap = new Dictionary<string, object?>();
            foreach (var entry in flist)
            {
                if (entry is Dictionary<string, object?> em &&
                    StructUtils.GetProp(em, "name") is string fname && fname != "")
                {
                    var fopts = new Dictionary<string, object?>(em);
                    fopts.Remove("name");
                    fmap[fname] = fopts;
                    featureorder.Add(fname);
                }
            }
            opts["feature"] = fmap;
        }

        var config = ctx.Config ?? new Dictionary<string, object?>();
        var cfgopts = config.TryGetValue("options", out var co) &&
            co is Dictionary<string, object?> cm
            ? cm : new Dictionary<string, object?>();

        var optspec = new Dictionary<string, object?>
        {
            ["apikey"] = "",
            ["base"] = "http://localhost:8000",
            ["prefix"] = "",
            ["suffix"] = "",
            ["auth"] = new Dictionary<string, object?>
            {
                ["prefix"] = "",
            },
            ["headers"] = new Dictionary<string, object?>
            {
                ["`$CHILD`"] = "`$STRING`",
            },
            ["allow"] = new Dictionary<string, object?>
            {
                ["method"] = "GET,PUT,POST,PATCH,DELETE,OPTIONS",
                ["op"] = "create,update,load,list,remove,command,direct",
            },
            ["entity"] = new Dictionary<string, object?>
            {
                ["`$CHILD`"] = new Dictionary<string, object?>
                {
                    ["`$OPEN`"] = true,
                    ["active"] = false,
                    ["alias"] = new Dictionary<string, object?>(),
                },
            },
            ["feature"] = new Dictionary<string, object?>
            {
                ["`$CHILD`"] = new Dictionary<string, object?>
                {
                    ["`$OPEN`"] = true,
                    ["active"] = false,
                },
            },
            ["utility"] = new Dictionary<string, object?>(),
            ["system"] = new Dictionary<string, object?>(),
            ["test"] = new Dictionary<string, object?>
            {
                ["active"] = false,
                ["entity"] = new Dictionary<string, object?>
                {
                    ["`$OPEN`"] = true,
                },
            },
            ["clean"] = new Dictionary<string, object?>
            {
                ["keys"] = "key,token,id",
            },
        };

        // Preserve system.fetch across merge/validate (delegates survive
        // Clone, but validation may reshape the system block).
        var sysFetch = StructUtils.GetPath(opts, StructUtils.Jt("system", "fetch"));

        var merged = StructUtils.Merge(new List<object?>
        {
            new Dictionary<string, object?>(),
            cfgopts,
            opts,
        });
        var validated = StructUtils.Validate(merged, optspec);
        opts = validated as Dictionary<string, object?> ?? new Dictionary<string, object?>();

        // Restore system.fetch.
        if (sysFetch != null)
        {
            if (opts.TryGetValue("system", out var sys) &&
                sys is Dictionary<string, object?> sm)
            {
                sm["fetch"] = sysFetch;
            }
            else
            {
                opts["system"] = new Dictionary<string, object?>
                {
                    ["fetch"] = sysFetch,
                };
            }
        }

        // Derived clean config.
        var cleanKeys = "key,token,id";
        if (StructUtils.GetPath(opts, StructUtils.Jt("clean", "keys")) is string cks)
        {
            cleanKeys = cks;
        }

        var filtered = cleanKeys.Split(',')
            .Select(p => p.Trim())
            .Where(p => p != "")
            .Select(StructUtils.EscRe)
            .ToList();
        var keyre = string.Join("|", filtered);

        // Resolve the feature add-order: an explicit list order (above) wins;
        // otherwise order the map test-first, then the remaining names sorted,
        // so the outcome is deterministic and `test` is always the base
        // transport.
        if (featureorder.Count == 0)
        {
            var fmap = Helpers.ToMapAny(StructUtils.GetProp(opts, "feature"))
                ?? new Dictionary<string, object?>();
            var names = fmap.Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();
            if (names.Contains("test"))
            {
                featureorder.Add("test");
                foreach (var n in names)
                {
                    if (n != "test")
                    {
                        featureorder.Add(n);
                    }
                }
            }
            else
            {
                foreach (var n in names)
                {
                    featureorder.Add(n);
                }
            }
        }

        var derived = new Dictionary<string, object?>
        {
            ["clean"] = new Dictionary<string, object?>(),
        };
        if (keyre != "")
        {
            derived["clean"] = new Dictionary<string, object?>
            {
                ["keyre"] = keyre,
            };
        }
        derived["featureorder"] = featureorder;
        opts["__derived__"] = derived;

        return opts;
    }
}
