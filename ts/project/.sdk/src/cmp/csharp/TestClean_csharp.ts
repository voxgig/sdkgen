import {
  cmp,
  each,
  entityCollection,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


// The canary sweep, the csharp twin of TestClean_ts.ts. The entity accessors
// and their operations are typed methods, so the candidates the sweep drives
// to find a usable operation are emitted from the model rather than found by
// walking the client at run time.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  // Same order the ts sweep tries: list, then load, then the rest.
  const rank: Record<string, number> = { list: 0, load: 1 }
  const candidates = each(entityCollection(model))
    .filter((e: any) => false !== e.active)
    .map((e: any) => ({
      name: e.name,
      Name: e.Name,
      ops: Object.keys(e.op || {})
        .sort((a, b) => (rank[a] ?? 2) - (rank[b] ?? 2)),
    }))
    .filter((c: any) => 0 < c.ops.length)

  File({ name: 'CleanTest.' + target.ext }, () => Content(render(model.const.Name, auth, candidates)))
})


function render(
  Name: string,
  auth: { suppressed: boolean, where: string, name: string, basic: boolean },
  candidates: { name: string, Name: string, ops: string[] }[],
): string {
  const candidateLines = candidates.map((c) =>
    `        new Candidate("${c.name}", sdk => sdk.${c.Name}(null), new[] { ${c.ops.map((o) => `"${o}"`).join(', ')} }),`)
    .join('\n')

  return `// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.

using System.Collections;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

using Voxgig.Struct;
using Xunit;
using Xunit.Abstractions;

using ${Name}Sdk;
using ${Name}Sdk.Feature;

namespace ${Name}Sdk.Test;

public class CleanTest
{
    // Generated: the credential's wire placement is fixed when the SDK is built.
    private const bool AuthSuppressed = ${auth.suppressed ? 'true' : 'false'};
    private const string AuthWhere = ${JSON.stringify(auth.where)};
    private const string AuthName = ${JSON.stringify(auth.name)};

    private const string CanaryApikey = "CANARY-APIKEY-k9x2m7q4p1";
    private const string CanarySecret = "CANARY-SECRET-w3e8r5t2y6";
    private const string CanaryHeader = "CANARY-HEADER-z1x4c7v0b3";
    private const string CanaryValue = "CANARY-VALUE-n5m8b2v9c4";

    private const string Mask = "[redacted]";

    private readonly ITestOutputHelper _out;

    public CleanTest(ITestOutputHelper output)
    {
        _out = output;
    }

    // Every form a canary can travel in.
    private static readonly List<string> Forms = BuildForms();

    private static List<string> BuildForms()
    {
        var forms = new List<string>();
        foreach (var v in new[] { CanaryApikey, CanarySecret, CanaryHeader, CanaryValue })
        {
            forms.Add(v);
            forms.Add(Convert.ToBase64String(Encoding.UTF8.GetBytes(v)));
            forms.Add(Uri.EscapeDataString(v));
        }
        forms.Add(Convert.ToBase64String(Encoding.UTF8.GetBytes(CanaryApikey + ":" + CanarySecret)));
        return forms;
    }

    private sealed record Sink(string Name, string Text);

    private sealed record Candidate(string Name, Func<${Name}SDK, ${Name}EntityBase> Accessor, string[] Ops);

    private sealed record Target(Candidate Candidate, string Op);

    // Header maps keep the caller's spelling; the assertion should not care.
    private static object? Header(object? map, string name)
    {
        if (map is IDictionary dict)
        {
            foreach (DictionaryEntry kv in dict)
            {
                if (string.Equals(Convert.ToString(kv.Key), name, StringComparison.OrdinalIgnoreCase))
                {
                    return kv.Value;
                }
            }
        }
        return null;
    }

    private static List<string> Leaks(string text)
    {
        return Forms.Where(f => text.Contains(f)).ToList();
    }

    private static readonly JsonSerializerOptions FieldsJson = new()
    {
        IncludeFields = true,
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        MaxDepth = 16,
    };

    // The typed pipeline products read through their fields, so the raw spec
    // is visible when clean is off - the sensitivity check depends on it.
    private static string Render(object? val)
    {
        switch (val)
        {
            case null:
                return "null";
            case string s:
                return s;
            case Spec sp:
                return Render(new Dictionary<string, object?>
                {
                    ["method"] = sp.Method, ["url"] = sp.Url, ["path"] = sp.Path,
                    ["headers"] = sp.Headers, ["query"] = sp.Query,
                    ["params"] = sp.Params, ["body"] = sp.Body,
                });
            case Result r:
                return Render(new Dictionary<string, object?>
                {
                    ["ok"] = r.Ok, ["status"] = r.Status, ["headers"] = r.Headers,
                    ["body"] = r.Body, ["resdata"] = r.Resdata,
                    ["err"] = null == r.Err ? null : r.Err.ToString(),
                });
            case IEntity ent:
                return Render(ent.Data());
            case Context ctx:
                return Render(ctx.ToRecord());
            case IDictionary dict:
            {
                var sb = new StringBuilder("{");
                foreach (DictionaryEntry kv in dict)
                {
                    sb.Append(JsonSerializer.Serialize(Convert.ToString(kv.Key)))
                      .Append(':').Append(Render(kv.Value)).Append(',');
                }
                return sb.Append('}').ToString();
            }
            case IList list:
                return "[" + string.Join(",", list.Cast<object?>().Select(Render)) + "]";
            case Exception e:
                return e.ToString();
            default:
                try
                {
                    return JsonSerializer.Serialize(val, FieldsJson);
                }
                catch (Exception)
                {
                    return StructUtils.Jsonify(val, 0);
                }
        }
    }

    // Every default print a value has, plus the SDK's own record of it.
    private static List<Sink> FormsOf(string name, object? val)
    {
        var out_ = new List<Sink>();
        void Push(string kind, Func<string> fn)
        {
            try { out_.Add(new Sink(name + ":" + kind, fn())); } catch (Exception) { }
        }
        Push("json", () => StructUtils.Jsonify(val, 0));
        Push("string", () => Convert.ToString(val) ?? "");
        Push("render", () => Render(val));
        if (val is ${Name}Error se)
        {
            Push("message", () => se.Message);
            Push("record", () => StructUtils.Jsonify(se.ToRecord(), 0));
        }
        if (val is Exception e)
        {
            Push("message", () => e.Message);
            Push("tostring", () => e.ToString());
            Push("stack", () => e.StackTrace ?? "");
        }
        if (val is Context ctx)
        {
            Push("record", () => StructUtils.Jsonify(ctx.ToRecord(), 0));
        }
        if (val is ${Name}SDK)
        {
            // What a structured logger walking own fields would see.
            Push("fields", () => JsonSerializer.Serialize(val, FieldsJson));
        }
        return out_;
    }

    // Captures the serialised context from inside the pipeline: what a hook
    // author would hand to a logger.
    private sealed class CaptureFeature : BaseFeature
    {
        private readonly List<Sink> _sinks;

        public CaptureFeature(List<Sink> sinks)
        {
            Name = "capture";
            Version = "0.0.1";
            Active = true;
            _sinks = sinks;
        }

        public override void PreRequest(Context ctx) => _sinks.AddRange(FormsOf("ctx@PreRequest", ctx));
        public override void PreResponse(Context ctx) => _sinks.AddRange(FormsOf("ctx@PreResponse", ctx));
        public override void PreUnexpected(Context ctx) => _sinks.AddRange(FormsOf("ctx@PreUnexpected", ctx));
    }

    private sealed record Scenario(string Name, Func<string, Dictionary<string, object?>, object?> Respond);

    private static Dictionary<string, object?> Response(int status, object? data,
        Dictionary<string, object?>? headers = null)
    {
        var h = new Dictionary<string, object?> { ["content-type"] = "application/json" };
        foreach (var kv in headers ?? new Dictionary<string, object?>())
        {
            h[kv.Key.ToLowerInvariant()] = kv.Value;
        }
        return new Dictionary<string, object?>
        {
            ["status"] = status,
            ["statusText"] = status < 400 ? "OK" : "ERR",
            ["json"] = (Func<object?>)(() => data),
            ["body"] = StructUtils.Jsonify(data, 0),
            ["headers"] = h,
        };
    }

    private static readonly List<Scenario> Scenarios = new()
    {
        new Scenario("ok", (_url, _def) => Response(200,
            new Dictionary<string, object?> { ["id"] = "i1", ["name"] = "n1" },
            new Dictionary<string, object?> { ["x-session-token"] = "RESP-TOKEN-a1b2c3d4e5" })),
        new Scenario("notfound", (_url, _def) => Response(404,
            new Dictionary<string, object?> { ["error"] = "no such record" })),
        new Scenario("server", (_url, _def) => Response(500,
            new Dictionary<string, object?> { ["error"] = "boom" })),
        new Scenario("transport", (url, _def) =>
            throw new Exception("socket hang up (URL was: \\"" + url + "\\")")),
        new Scenario("notjson", (_url, _def) => new Dictionary<string, object?>
        {
            ["status"] = 200,
            ["statusText"] = "OK",
            ["json"] = (Func<object?>)(() => throw new Exception("Unexpected token < in JSON")),
            ["body"] = "<html>",
            ["headers"] = new Dictionary<string, object?>(),
        }),
    };

    private static ${Name}SDK MakeSdk(Scenario scenario, List<Sink> sinks,
        Dictionary<string, object?>? cleanopts = null)
    {
        Action<Dictionary<string, object?>> Capture(string name) =>
            rec => sinks.AddRange(FormsOf(name, rec));

        var feature = new Dictionary<string, object?>();
        if (Fh.HasFeature("log"))
        {
            feature["log"] = new Dictionary<string, object?>
            {
                ["active"] = true,
                ["logger"] = (Action<string, string, Dictionary<string, object?>>)(
                    (level, _msg, attrs) => sinks.AddRange(FormsOf("log." + level, attrs))),
            };
        }
        if (Fh.HasFeature("debug"))
        {
            feature["debug"] = new Dictionary<string, object?>
            {
                ["active"] = true, ["onEntry"] = Capture("debug"),
            };
        }
        if (Fh.HasFeature("audit"))
        {
            feature["audit"] = new Dictionary<string, object?>
            {
                ["active"] = true, ["sink"] = Capture("audit"),
            };
        }
        if (Fh.HasFeature("telemetry"))
        {
            feature["telemetry"] = new Dictionary<string, object?>
            {
                ["active"] = true, ["exporter"] = Capture("telemetry"),
            };
        }
        if (Fh.HasFeature("cost"))
        {
            feature["cost"] = new Dictionary<string, object?>
            {
                ["active"] = true,
                ["sink"] = (Action<CostRecord>)(rec => sinks.AddRange(FormsOf("cost", rec))),
            };
        }
        if (Fh.HasFeature("metrics"))
        {
            feature["metrics"] = new Dictionary<string, object?> { ["active"] = true };
        }
        if (Fh.HasFeature("clienttrack"))
        {
            feature["clienttrack"] = new Dictionary<string, object?> { ["active"] = true };
        }

        var clean = new Dictionary<string, object?> { ["values"] = CanaryValue };
        foreach (var kv in cleanopts ?? new Dictionary<string, object?>())
        {
            clean[kv.Key] = kv.Value;
        }

        var fetcher = (Context _ctx, string url, Dictionary<string, object?> fetchdef) =>
            scenario.Respond(url, fetchdef);

        return new ${Name}SDK(new Dictionary<string, object?>
        {
            ["apikey"] = CanaryApikey,
            ["secret"] = CanarySecret,
            ["headers"] = new Dictionary<string, object?> { ["X-Custom-Token"] = CanaryHeader },
            ["clean"] = clean,
            ["feature"] = feature,
            ["extend"] = new List<object?> { new CaptureFeature(sinks) },
            ["utility"] = new Dictionary<string, object?> { ["fetcher"] = fetcher },
        });
    }

    // Emitted from the model: every active entity with the operations it
    // declares, list and load first.
    private static readonly List<Candidate> Candidates = new()
    {
${candidateLines}
    };

    private static object? Invoke(${Name}EntityBase ent, string op, Dictionary<string, object?>? ctrl)
    {
        var args = new Dictionary<string, object?>();
        return op switch
        {
            "list" => ent.List(args, ctrl),
            "load" => ent.Load(args, ctrl),
            "create" => ent.Create(args, ctrl),
            "update" => ent.Update(args, ctrl),
            "remove" => ent.Remove(args, ctrl),
            _ => throw new InvalidOperationException("unknown operation: " + op),
        };
    }

    // The first operation that completes against a plain 200 with no arguments
    // (a required path parameter would fail before the request is built).
    private static Target? UsableOp()
    {
        var fetcher = (Context _ctx, string _url, Dictionary<string, object?> _def) =>
            (object?)Response(200, new Dictionary<string, object?> { ["id"] = "i1" });
        var plain = new ${Name}SDK(new Dictionary<string, object?>
        {
            ["apikey"] = CanaryApikey,
            ["utility"] = new Dictionary<string, object?> { ["fetcher"] = fetcher },
        });
        foreach (var candidate in Candidates)
        {
            foreach (var op in candidate.Ops)
            {
                try
                {
                    Invoke(candidate.Accessor(plain), op, null);
                    return new Target(candidate, op);
                }
                catch (Exception)
                {
                    continue;
                }
            }
        }
        return null;
    }

    private static Exception? Drive(${Name}SDK sdk, Target target,
        Dictionary<string, object?> ctrl, List<Sink> sinks)
    {
        object? out_ = null;
        Exception? err = null;
        try
        {
            out_ = Invoke(target.Candidate.Accessor(sdk), target.Op, ctrl);
        }
        catch (Exception e)
        {
            err = e;
        }
        if (null != err) sinks.AddRange(FormsOf("error", err));
        if (null != out_) sinks.AddRange(FormsOf("result", out_));
        if (ctrl.TryGetValue("explain", out var explain) && null != explain)
        {
            sinks.AddRange(FormsOf("explain", explain));
        }
        return err;
    }

    private void Report(string line)
    {
        // Both: xunit shows the helper's output, the lane reads the console.
        Console.WriteLine(line);
        _out.WriteLine(line);
    }

    [Fact]
    public void NoCredentialLeavesTheSdkInAnyForm()
    {
        var target = UsableOp();
        Assert.True(null != target, "no operation completes without arguments; nothing to sweep");

        var sinks = new List<Sink>();
        var errors = new Dictionary<string, Exception>();
        var explains = new Dictionary<string, Dictionary<string, object?>>();

        var variants = new (string Name, Func<Dictionary<string, object?>> Ctrl)[]
        {
            ("throw", () => new Dictionary<string, object?>()),
            ("explain", () => new Dictionary<string, object?>
            {
                ["explain"] = new Dictionary<string, object?>(),
            }),
            ("nothrow", () => new Dictionary<string, object?>
            {
                ["throw"] = false,
                ["explain"] = new Dictionary<string, object?>(),
            }),
        };

        foreach (var scenario in Scenarios)
        {
            foreach (var variant in variants)
            {
                var sdk = MakeSdk(scenario, sinks);
                var ctrl = variant.Ctrl();
                var err = Drive(sdk, target!, ctrl, sinks);
                var key = scenario.Name + "/" + variant.Name;
                if (null != err) errors[key] = err;
                if (ctrl.TryGetValue("explain", out var ex) && ex is Dictionary<string, object?> exm)
                {
                    explains[key] = exm;
                }
                sinks.AddRange(FormsOf("sdk", sdk));
            }
        }

        var leaked = sinks
            .Select(s => (s.Name, Found: Leaks(s.Text)))
            .Where(s => 0 < s.Found.Count)
            .ToList();

        Report("clean: swept " + sinks.Count + " surface(s), " + leaked.Count + " leak(s)");

        Assert.True(0 == leaked.Count, "credential leaked through: " +
            string.Join("; ", leaked.Select(l => l.Name + " [" + string.Join(", ", l.Found) + "]")));

        // The positive half: the slot the credential travelled in is masked,
        // and an unregistered token in a response header is masked by name.
        Assert.True(errors.TryGetValue("notfound/throw", out var notfoundErr), "the 404 scenario must throw");
        var notfound = Assert.IsType<${Name}Error>(notfoundErr);
        Assert.Equal(404, notfound.Status);
        var spec = notfound.SpecVal as Dictionary<string, object?> ?? new Dictionary<string, object?>();
        if (!AuthSuppressed)
        {
            if ("query" == AuthWhere)
            {
                Assert.Equal(Mask, Header(spec.GetValueOrDefault("query"), AuthName));
            }
            else if ("cookie" == AuthWhere)
            {
                var cookie = Convert.ToString(Header(spec.GetValueOrDefault("headers"), "cookie")) ?? "";
                Assert.True(cookie.Contains(Mask), "cookie: " + cookie);
            }
            else
            {
                var cred = Convert.ToString(Header(spec.GetValueOrDefault("headers"), AuthName)) ?? "";
                Assert.True(cred.EndsWith(Mask), AuthName + ": " + cred);
            }
        }
        Assert.Equal(Mask, Header(spec.GetValueOrDefault("headers"), "x-custom-token"));

        Assert.True(explains.TryGetValue("ok/explain", out var explained), "the ok scenario should explain");
        var result = explained!.GetValueOrDefault("result") as Dictionary<string, object?>;
        Assert.True(null != result, "the explain record should carry the result");
        Assert.Equal(Mask, Header(result!.GetValueOrDefault("headers"), "x-session-token"));
    }

    [Fact]
    public void TheSweepCanSeeALeakCleanSwitchedOffShowsTheCredential()
    {
        var target = UsableOp();
        Assert.True(null != target, "no operation completes without arguments");

        var sinks = new List<Sink>();
        var sdk = MakeSdk(Scenarios[1], sinks, new Dictionary<string, object?> { ["active"] = false });
        var err = Drive(sdk, target!, new Dictionary<string, object?>(), sinks);
        Assert.True(null != err, "the 404 scenario must throw");

        var leaked = sinks.Where(s => 0 < Leaks(s.Text).Count).ToList();
        Assert.True(0 < leaked.Count, "with clean off, nothing showed the canary: the sweep is blind");

        if (!AuthSuppressed)
        {
            var text = Render((err as ${Name}Error)?.SpecVal);
            Assert.True(text.Contains(CanaryApikey) ||
                text.Contains(Convert.ToBase64String(Encoding.UTF8.GetBytes(CanaryApikey + ":" + CanarySecret))),
                "the raw spec should carry the credential when clean is off");
        }
    }
}
`
}


export {
  TestClean
}
