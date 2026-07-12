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
        opts["__derived__"] = derived;

        return opts;
    }
}
