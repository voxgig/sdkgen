// ProjectName SDK codec: handle - an entity's named bytes.

namespace ProjectNameSdk;

// A slot the entity component derived from the model: the action whose
// points move its bytes ("" for the entity's own), and the operations that
// read and write them.
public sealed record ProjectNameBinarySlot(string Action, string? Read, string? Write);

// Each call is one run of the entity's own operation on the slot's point; in
// core only whole, in-memory bodies move.
public class ProjectNameBinaryHandle<E> where E : ProjectNameEntityBase
{
    private readonly E _entity;
    private readonly Context _ctx;
    private readonly string _slot;
    private readonly ProjectNameBinarySlot? _def;

    public ProjectNameBinaryHandle(E entity, Context ctx,
        IReadOnlyDictionary<string, ProjectNameBinarySlot> slots, string? slot = null)
    {
        _entity = entity;
        _ctx = ctx;
        _slot = slot ?? "";
        _def = slots.TryGetValue(_slot, out var def) ? def : null;
    }

    public string Name => _slot;

    // The whole body, within maxBuffer.
    public byte[] Bytes(Dictionary<string, object?>? opts = null, Dictionary<string, object?>? ctrl = null)
    {
        if (opts != null && opts.TryGetValue("range", out var range) && range != null)
        {
            throw Inactive("read a range");
        }
        var def = Direction("read");
        var transfer = new Dictionary<string, object?> { ["slot"] = _slot, ["direction"] = "read" };
        Run(def.Read!, Select(def), WithTransfer(ctrl, transfer));
        return transfer.TryGetValue("bytes", out var bytes) && bytes is byte[] read ? read : Array.Empty<byte>();
    }

    // Sends in-memory content as the slot's body; resolves to the entity.
    public E Put(object? source, Dictionary<string, object?>? ctrl = null)
    {
        var def = Direction("write");
        var transfer = new Dictionary<string, object?> { ["slot"] = _slot, ["direction"] = "write" };
        var reqdata = Select(def);
        reqdata["$body"] = source;
        Run(def.Write!, reqdata, WithTransfer(ctrl, transfer));
        return _entity;
    }

    public byte[] Save(params object?[] args) => throw Inactive("save");

    public object Stream(params object?[] args) => throw Inactive("stream");

    public object Open(params object?[] args) => throw Inactive("open");

    private object? Run(string op, Dictionary<string, object?> args, Dictionary<string, object?> ctrl)
    {
        return op switch
        {
            "load" => _entity.Load(args, ctrl),
            "create" => _entity.Create(args, ctrl),
            "update" => _entity.Update(args, ctrl),
            "patch" => _entity.Patch(args, ctrl),
            _ => throw Helpers.UnsupportedOp(op, _entity.GetName()),
        };
    }

    private static Dictionary<string, object?> WithTransfer(Dictionary<string, object?>? ctrl,
        Dictionary<string, object?> transfer)
    {
        var merged = ctrl == null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?>(ctrl);
        merged["transfer"] = transfer;
        return merged;
    }

    private static Dictionary<string, object?> Select(ProjectNameBinarySlot def)
    {
        return "" == def.Action
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?> { ["$action"] = def.Action };
    }

    private ProjectNameBinarySlot Direction(string way)
    {
        if (_def == null)
        {
            throw _ctx.MakeError("binary_slot_unknown", "Entity \"" + _entity.GetName() +
                "\" has no binary slot \"" + _slot + "\".");
        }
        if (("read" == way ? _def.Read : _def.Write) == null)
        {
            throw _ctx.MakeError("binary_slot_direction", "The binary slot \"" + _slot +
                "\" of entity \"" + _entity.GetName() + "\" cannot be " +
                ("read" == way ? "read" : "written") + ".");
        }
        return _def;
    }

    private ProjectNameError Inactive(string what)
    {
        return _ctx.MakeError("binary_feature_inactive", "The binary slot \"" + _slot +
            "\" of entity \"" + _entity.GetName() + "\" cannot " + what +
            " without the binary feature; in core it answers Bytes() and Put().");
    }
}
