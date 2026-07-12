// ProjectNameEntityBase - shared entity behaviour: construction, data/match
// state (with feature hooks), the operation pipeline (RunOp) and default
// unsupported-op implementations of every CRUD method. Generated entity
// classes derive from this and override the operations their API defines.

using Voxgig.Struct;

namespace ProjectNameSdk;

public abstract class ProjectNameEntityBase : IEntity
{
    protected string name;
    protected ProjectNameSDK client;
    protected Utility utility;
    protected Dictionary<string, object?> entopts;
    protected Dictionary<string, object?> data = new();
    protected Dictionary<string, object?> match = new();
    protected Context entctx;

    protected ProjectNameEntityBase(ProjectNameSDK client,
        Dictionary<string, object?>? entopts, string name)
    {
        entopts ??= new Dictionary<string, object?>();
        if (!entopts.ContainsKey("active"))
        {
            entopts["active"] = true;
        }
        else if (!Equals(entopts["active"], false))
        {
            entopts["active"] = true;
        }

        this.name = name;
        this.client = client;
        this.utility = client.GetUtility();
        this.entopts = entopts;

        this.entctx = utility.MakeContext(new Dictionary<string, object?>
        {
            ["entity"] = this,
            ["entopts"] = entopts,
        }, client.GetRootCtx());

        utility.FeatureHook(this.entctx, "PostConstructEntity");
    }

    public string GetName() => name;

    public abstract IEntity Make();

    protected Dictionary<string, object?> CloneOpts()
    {
        return new Dictionary<string, object?>(entopts);
    }

    public object? Data(object? newdata = null)
    {
        if (newdata != null)
        {
            data = Helpers.ToMapAny(StructUtils.Clone(newdata))
                ?? new Dictionary<string, object?>();
            utility.FeatureHook(entctx, "SetData");
        }

        utility.FeatureHook(entctx, "GetData");
        return StructUtils.Clone(data);
    }

    public object? Match(object? newmatch = null)
    {
        if (newmatch != null)
        {
            match = Helpers.ToMapAny(StructUtils.Clone(newmatch))
                ?? new Dictionary<string, object?>();
            utility.FeatureHook(entctx, "SetMatch");
        }

        utility.FeatureHook(entctx, "GetMatch");
        return StructUtils.Clone(match);
    }

    public virtual object? Load(Dictionary<string, object?>? reqmatch,
        Dictionary<string, object?>? ctrl = null)
        => throw Helpers.UnsupportedOp("load", name);

    public virtual object? List(Dictionary<string, object?>? reqmatch,
        Dictionary<string, object?>? ctrl = null)
        => throw Helpers.UnsupportedOp("list", name);

    public virtual object? Create(Dictionary<string, object?>? reqdata,
        Dictionary<string, object?>? ctrl = null)
        => throw Helpers.UnsupportedOp("create", name);

    public virtual object? Update(Dictionary<string, object?>? reqdata,
        Dictionary<string, object?>? ctrl = null)
        => throw Helpers.UnsupportedOp("update", name);

    public virtual object? Remove(Dictionary<string, object?>? reqmatch,
        Dictionary<string, object?>? ctrl = null)
        => throw Helpers.UnsupportedOp("remove", name);

    protected object? RunOp(Context ctx, Action postDone)
    {
        // #PrePoint-Hook

        try
        {
            var point = utility.MakePoint(ctx);
            ctx.Out["point"] = point;
        }
        catch (Exception err)
        {
            return utility.MakeError(ctx, err);
        }

        // #PreSpec-Hook

        try
        {
            var spec = utility.MakeSpec(ctx);
            ctx.Out["spec"] = spec;
        }
        catch (Exception err)
        {
            return utility.MakeError(ctx, err);
        }

        // #PreRequest-Hook

        try
        {
            var resp = utility.MakeRequest(ctx);
            ctx.Out["request"] = resp;
        }
        catch (Exception err)
        {
            return utility.MakeError(ctx, err);
        }

        // #PreResponse-Hook

        try
        {
            var resp2 = utility.MakeResponse(ctx);
            ctx.Out["response"] = resp2;
        }
        catch (Exception err)
        {
            return utility.MakeError(ctx, err);
        }

        // #PreResult-Hook

        try
        {
            var result = utility.MakeResult(ctx);
            ctx.Out["result"] = result;
        }
        catch (Exception err)
        {
            return utility.MakeError(ctx, err);
        }

        // #PreDone-Hook

        postDone();

        return utility.Done(ctx);
    }
}
