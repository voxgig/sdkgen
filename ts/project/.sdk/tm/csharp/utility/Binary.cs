// ProjectName SDK utility: binary - the sources a request's binary fields
// carry, lifted out of its data, and the items a form or multipart body sends.

using System.Collections;
using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    private const int BinaryMaxDepth = 32;

    private static readonly JsonSerializerOptions ItemJsonOpts = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    internal sealed record BodyItem(string Name, Dictionary<string, object?> Field, object Value,
        bool Binary);

    internal static bool IsBytes(object? value)
    {
        return value is byte[] or ReadOnlyMemory<byte> or Memory<byte> or ArraySegment<byte>;
    }

    internal static byte[] ToBytes(object? value)
    {
        return value switch
        {
            byte[] bytes => bytes,
            ReadOnlyMemory<byte> shared => shared.ToArray(),
            Memory<byte> owned => owned.ToArray(),
            ArraySegment<byte> segment => segment.ToArray(),
            string text => Encoding.UTF8.GetBytes(text),
            _ => Encoding.UTF8.GetBytes(ItemText(value)),
        };
    }

    // A plain value as the text of a form pair or a multipart part.
    internal static string ItemText(object? value)
    {
        return value switch
        {
            null => "null",
            string text => text,
            bool flag => flag ? "true" : "false",
            double d => d.ToString("R", CultureInfo.InvariantCulture),
            float f => f.ToString("R", CultureInfo.InvariantCulture),
            decimal m => m.ToString(CultureInfo.InvariantCulture),
            IConvertible n when value.GetType().IsPrimitive =>
                n.ToString(CultureInfo.InvariantCulture),
            _ => JsonSerializer.Serialize(value, ItemJsonOpts),
        };
    }

    // The path of the first source in a value, or null.
    private static string? SourceAt(object? value, string path, int depth, List<object> seen)
    {
        if (value == null || value is string || BinaryMaxDepth <= depth ||
            seen.Exists(o => ReferenceEquals(o, value)))
        {
            return null;
        }
        if (value is BinarySource)
        {
            return path;
        }
        if (IsBytes(value) || value is Stream)
        {
            return null;
        }
        seen.Add(value);
        if (value is IDictionary dict)
        {
            foreach (DictionaryEntry kv in dict)
            {
                var key = Convert.ToString(kv.Key, CultureInfo.InvariantCulture) ?? "";
                var found = SourceAt(kv.Value, "" == path ? key : path + "." + key, depth + 1, seen);
                if (found != null)
                {
                    return found;
                }
            }
        }
        else if (value is IList list)
        {
            for (var i = 0; i < list.Count; i++)
            {
                var key = i.ToString(CultureInfo.InvariantCulture);
                var found = SourceAt(list[i], "" == path ? key : path + "." + key, depth + 1, seen);
                if (found != null)
                {
                    return found;
                }
            }
        }
        return null;
    }

    // The data keys whose values are file content: a multipart or form body's
    // binary fields, and the whole of a raw body.
    internal static List<string> BinaryNames(object? point)
    {
        var body = StructUtils.GetProp(point, "body");
        var kind = StructUtils.GetProp(body, "kind");
        if ("raw".Equals(kind))
        {
            return new List<string> { RawBody };
        }
        if (("multipart".Equals(kind) || "form".Equals(kind)) &&
            StructUtils.GetProp(body, "fields") is List<object?> fields)
        {
            return fields
                .Where(f => StructUtils.GetProp(f, "binary") is true)
                .Select(f => StructUtils.GetProp(f, "name") as string)
                .OfType<string>()
                .ToList();
        }
        return new List<string>();
    }

    // Moves the values of binary fields out of the request data, before a hook,
    // a transform, validation or clean reads it. A source anywhere else is refused.
    internal static void LiftSources(Context ctx)
    {
        if (ctx.Sources != null)
        {
            return;
        }

        var names = BinaryNames(ctx.Point);
        var lifted = new Dictionary<string, object?>();
        var reqdata = ctx.Reqdata;

        if (names.Exists(reqdata.ContainsKey))
        {
            reqdata = new Dictionary<string, object?>(reqdata);
            foreach (var name in names)
            {
                if (reqdata.Remove(name, out var value))
                {
                    lifted[name] = value;
                }
            }
        }

        var stray = SourceAt(reqdata, "", 0, new List<object>()) ??
            SourceAt(ctx.Reqmatch, "", 0, new List<object>());
        if (stray != null)
        {
            throw ctx.MakeError("binary_source_refused", "A binary source was passed in \"" + stray +
                "\", which is not a field the operation declares binary.");
        }

        ctx.Reqdata = reqdata;
        ctx.Sources = lifted;
    }

    // A response the model declares to be bytes is read only through the
    // entity's binary handle, never into its data.
    internal static void BytesRefused(Context ctx)
    {
        var response = StructUtils.GetProp(ctx.Point, "response");
        if (!"raw".Equals(StructUtils.GetProp(response, "kind")) ||
            StructUtils.GetProp(response, "binary") is not true || ctx.Ctrl.Transfer != null)
        {
            return;
        }
        var action = StructUtils.GetProp(StructUtils.GetProp(ctx.Point, "select"), "$action");
        var call = action == null ? "Binary()" : "Binary(\"" + action + "\")";
        throw ctx.MakeError("binary_sink_required", "Operation \"" + ctx.Op?.Name + "\" on entity \"" +
            ctx.Op?.Entity + "\" answers bytes, which never enter the entity's data: read them with " +
            "entity." + call + ".Bytes().");
    }

    // The values a form or multipart body carries, in wire order: the fields the
    // model declares, in its order, then any other key of the data, in code unit
    // order. A list repeats its field per item, or is one value joined by the
    // field's `join`; an absent or null value sends nothing.
    internal static List<BodyItem> BodyItems(object? body, object? data,
        Dictionary<string, object?> lifted)
    {
        var fields = (StructUtils.GetProp(body, "fields") as List<object?> ?? new List<object?>())
            .OfType<Dictionary<string, object?>>()
            .Where(f => f.GetValueOrDefault("name") is string)
            .ToList();
        var declared = fields.Select(f => (string)f["name"]!).ToList();
        var plain = data as Dictionary<string, object?> ?? new Dictionary<string, object?>();

        var names = declared.Where(n => plain.ContainsKey(n) || lifted.ContainsKey(n))
            .Concat(plain.Keys.Where(k => !declared.Contains(k)).OrderBy(k => k, StringComparer.Ordinal))
            .ToList();

        var items = new List<BodyItem>();
        foreach (var name in names)
        {
            var field = fields.Find(f => name == (string)f["name"]!) ??
                new Dictionary<string, object?> { ["name"] = name };
            var value = lifted.TryGetValue(name, out var held) ? held : plain.GetValueOrDefault(name);
            var file = field.GetValueOrDefault("binary") is true;
            if (value == null)
            {
                continue;
            }
            if (value is IList list && !IsBytes(value))
            {
                var present = list.Cast<object?>().OfType<object>().ToList();
                if (!file && field.GetValueOrDefault("join") is string join)
                {
                    items.Add(new BodyItem(name, field, string.Join(join, present.Select(ItemText)), file));
                }
                else
                {
                    items.AddRange(present.Select(item => new BodyItem(name, field, item, file)));
                }
            }
            else
            {
                items.Add(new BodyItem(name, field, value, file));
            }
        }
        return items;
    }
}
