// Payload validation against the model's own field types. The C# port of
// tm/ts/src/feature/validate/ValidateFeature.ts - same contract, C# idiom.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary StructUtils.Validate speaks. The generator maps them once
// (helpers/canonSpec) and emits `SdkSchema.Entityspec`, so a field whose type
// changes in the API spec changes what this feature enforces with no edit
// anywhere.
//
// WHAT IS CHECKED
//   outbound (PreSpec)  the payload the caller asked to send, against
//                       spec.op[opname] - the operation's request shape.
//   inbound  (PreDone)  each record the operation returned, against
//                       spec.data - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.

using Voxgig.Struct;

using static ProjectNameSdk.Feature.FeatureOptions;

namespace ProjectNameSdk.Feature;

public class ValidateFeature : BaseFeature
{
    // Built rather than written, so the backticks cannot be lost in an edit.
    private static readonly string OPEN = ((char)96) + "$OPEN" + ((char)96);

    private ProjectNameSDK? _client;
    private Dictionary<string, object?>? _options;
    private Dictionary<string, object?> _spec = new();

    private bool _request = true;
    private bool _response;
    private string _mode = "throw";

    public ValidateFeature()
    {
        Version = "0.0.1";
        Name = "validate";
        Active = true;
    }

    public override void Init(Context ctx, Dictionary<string, object?> options)
    {
        _client = ctx.Client;
        _options = options;
        Active = FoptBool(options, "active", false);

        // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
        // `config.options` documents them and types them; it does not inject
        // them, because each feature entry in the spec is optional and struct
        // fills in nothing through an optional union. So every feature
        // resolves its own.
        _request = FoptBool(options, "request", true);
        _response = FoptBool(options, "response", false);

        // FAIL CLOSED. Only the exact string "report" selects report mode, so
        // a typo (`mode: "thow"`) still rejects rather than silently turning
        // enforcement off - the failure nobody would notice. The option spec
        // rejects the typo outright; this is what happens if it ever does not.
        _mode = "report" == FoptStr(options, "mode", "throw") ? "report" : "throw";

        // `strict` is applied ONCE, here, by rebuilding the spec tree without
        // the `$OPEN` markers - rather than per call, which would clone a spec
        // for every request an SDK ever makes.
        _spec = FoptBool(options, "strict", false)
            ? Close(SdkSchema.Entityspec) as Dictionary<string, object?> ?? new()
            : SdkSchema.Entityspec;
    }

    // Outbound. MakeSpec short-circuits on a ctx.Out["spec"] that is already
    // set, so assigning the error here rejects the operation before the
    // request is built - the same seam rbac uses one stage earlier.
    public override void PreSpec(Context ctx)
    {
        if (!Active || !_request)
        {
            return;
        }

        var opname = ctx.Op?.Name ?? "";
        var opspec = OpSpec(EntitySpec(ctx), opname);
        if (opspec == null)
        {
            return;
        }

        var errs = Check(ctx, Payload(ctx, opname), opspec, "request");
        if (errs.Count == 0 || "report" == _mode)
        {
            return;
        }

        ctx.Out["spec"] = ctx.MakeError("validate_failed",
            "Invalid " + opname + " request for entity \"" + Entname(ctx) + "\": " +
            string.Join("; ", errs));
    }

    // Inbound. PreDone rather than PreResult: the records are extracted from
    // the response body by MakeResult, which runs between the two, so at
    // PreResult there is nothing to check but the envelope.
    //
    // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
    // PreDone hooks fire in feature ADD order, which defaults to `test` first
    // and then names sorted - and `validate` sorts last, after audit, cost,
    // debug, metrics and telemetry. Those observers therefore record the
    // operation as a success before this hook has looked at it. Activating
    // features as an ORDERED LIST fixes it.
    public override void PreDone(Context ctx)
    {
        if (!Active || !_response)
        {
            return;
        }

        var espec = EntitySpec(ctx);
        if (espec == null || !espec.TryGetValue("data", out var dataspec) || dataspec == null)
        {
            return;
        }

        var resdata = ctx.Result?.Resdata;
        if (resdata == null)
        {
            return;
        }

        // A list op returns many records and a load returns one; both are
        // checked against the same record spec, because they are the same
        // entity.
        var records = resdata is List<object?> rl ? rl : new List<object?> { resdata };

        var errs = new List<string>();
        foreach (var record in records)
        {
            if (record == null)
            {
                continue;
            }

            // A NON-OBJECT IS A FAILURE, not something to skip. A load that
            // answered 42 where the entity's spec wants a record must not pass
            // this feature silently - struct rejects it with the field it
            // could not find.
            errs.AddRange(Check(ctx, Unwrap(record), dataspec, "response"));
        }

        if (errs.Count == 0 || "report" == _mode)
        {
            return;
        }

        var err = ctx.MakeError("validate_failed",
            "Invalid response for entity \"" + Entname(ctx) + "\": " +
            string.Join("; ", errs));

        // BOTH, and `Ok` is the load-bearing half: Done returns Resdata
        // whenever Result.Ok is true and never looks at Err, so setting the
        // error alone would hand the caller the very records that failed the
        // spec.
        ctx.Result!.Ok = false;
        ctx.Result.Err = err;

        // AND THE DATA GOES. The load/update paths copy Result.Resdata into
        // the entity's own state on any non-null value, BEFORE Done raises -
        // so rejecting the operation while leaving the records in place would
        // leave the caller holding an entity populated from a payload this
        // feature had just declared invalid.
        ctx.Result.Resdata = null;
    }

    // The payload an operation is about to send.
    //
    // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
    // caller's argument in Reqdata over the entity's Data; a match op
    // (load/list/remove) carries it in Reqmatch over Match. That is what the
    // entity operations pass to MakeContext and what MakePoint reads - so
    // reading Reqdata for every op would check a `Load({id})` against the
    // entity's STALE stored match and reject it for the id the caller had just
    // supplied.
    private static Dictionary<string, object?> Payload(Context ctx, string opname)
    {
        var body = "create" == opname || "update" == opname || "patch" == opname;

        var basemap = body ? ctx.Data : ctx.Match;
        var req = body ? ctx.Reqdata : ctx.Reqmatch;

        var outmap = new Dictionary<string, object?>();
        foreach (var kv in basemap)
        {
            outmap[kv.Key] = kv.Value;
        }
        foreach (var kv in req)
        {
            outmap[kv.Key] = kv.Value;
        }

        // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the
        // record. MakePoint reads it off this same argument and the request
        // transformer drops it before the body is built, so a spec built from
        // the API's own fields will never name it - and under `strict` every
        // custom-action call would be rejected for the one key that made it
        // reachable.
        outmap.Remove("$action");

        return outmap;
    }

    private Dictionary<string, object?>? EntitySpec(Context ctx)
    {
        return _spec.TryGetValue(Entname(ctx), out var espec)
            ? espec as Dictionary<string, object?> : null;
    }

    private static object? OpSpec(Dictionary<string, object?>? espec, string opname)
    {
        if (espec == null || !espec.TryGetValue("op", out var ops))
        {
            return null;
        }
        return ops is Dictionary<string, object?> opmap && opmap.TryGetValue(opname, out var s)
            ? s : null;
    }

    private static string Entname(Context ctx)
    {
        var name = ctx.Entity?.GetName();
        if (!string.IsNullOrEmpty(name))
        {
            return name!;
        }
        return ctx.Op?.Entity ?? "";
    }

    // One validate call. Errors are COLLECTED, never thrown: struct throws on
    // the first failure unless given an `Errs` list, and a caller fixing a
    // payload wants every problem with it, not the first one.
    private List<string> Check(Context ctx, object? data, object? spec, string direction)
    {
        var collected = new List<object?>();

        try
        {
            StructUtils.Validate(data, spec, new InjectState { Errs = collected });
        }
        catch (Exception e)
        {
            // A spec this port cannot run at all (rather than a payload that
            // fails it) must not take the operation down with it: report it
            // like any other failure and let `mode` decide.
            if (collected.Count == 0)
            {
                collected.Add(e.Message);
            }
        }

        var errs = new List<string>();
        foreach (var e in collected)
        {
            errs.Add(e?.ToString() ?? "");
        }

        if (errs.Count > 0 &&
            _options != null &&
            _options.TryGetValue("onInvalid", out var cb) &&
            cb is Action<Dictionary<string, object?>> onInvalid)
        {
            try
            {
                onInvalid(new Dictionary<string, object?>
                {
                    ["entity"] = Entname(ctx),
                    ["op"] = ctx.Op?.Name ?? "",
                    ["direction"] = direction,
                    ["errs"] = errs,
                    ["data"] = data,
                });
            }
            catch (Exception)
            {
                // A reporting callback must not fail the operation.
            }
        }

        return errs;
    }

    // A RESULT RECORD AS DATA.
    //
    // MakeResult turns every record of a LIST into an entity instance, so what
    // reaches PreDone for a list is wrappers, not records - and a wrapper
    // checked against a field spec fails on every required field while its
    // actual data goes unchecked. A load returns the record itself, so this
    // handles both.
    private static object? Unwrap(object? record)
    {
        if (record is IEntity ent)
        {
            var data = ent.Data();
            if (data != null)
            {
                return data;
            }
        }
        return record;
    }

    // The spec tree with every `$OPEN` marker removed, so an undeclared key is
    // an error rather than a pass. Rebuilt rather than mutated:
    // SdkSchema.Entityspec is a static shared by every client in the process.
    private static object? Close(object? node)
    {
        if (node is List<object?> list)
        {
            var outlist = new List<object?>();
            foreach (var item in list)
            {
                outlist.Add(Close(item));
            }
            return outlist;
        }

        if (node is Dictionary<string, object?> map)
        {
            var outmap = new Dictionary<string, object?>();
            foreach (var kv in map)
            {
                if (OPEN != kv.Key)
                {
                    outmap[kv.Key] = Close(kv.Value);
                }
            }
            return outmap;
        }

        return node;
    }
}
