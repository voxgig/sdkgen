// ProjectName SDK - file content a caller hands the SDK.

using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectNameSdk;

// Held as given. A string is content, sent as its UTF-8: nothing here reads a path.
[JsonConverter(typeof(BinarySourceJson))]
public sealed class BinarySource
{
    public readonly string Kind = "bytes";
    public readonly byte[] Data;
    public readonly string? Name;
    public readonly string? Type;

    private BinarySource(byte[] data, string? name, string? type)
    {
        Data = data;
        Name = name;
        Type = string.IsNullOrEmpty(type) ? null : type;
    }

    public int Size => Data.Length;

    // Static, not a client member: an entity named binary owns the client's Binary.
    public static BinarySource Bytes(byte[] data, string? name = null, string? type = null)
    {
        return new BinarySource(data, name, type);
    }

    public static BinarySource Bytes(ReadOnlyMemory<byte> data, string? name = null, string? type = null)
    {
        return new BinarySource(data.ToArray(), name, type);
    }

    public static BinarySource Bytes(string data, string? name = null, string? type = null)
    {
        return new BinarySource(Encoding.UTF8.GetBytes(data), name, type);
    }

    // A source serialised anywhere is described, never copied.
    public Dictionary<string, object?> Describe()
    {
        var desc = new Dictionary<string, object?>
        {
            ["binary$"] = "bytes",
            ["size"] = (long)Size,
        };
        if (Type != null)
        {
            desc["type"] = Type;
        }
        return desc;
    }

    public override string ToString()
    {
        return JsonSerializer.Serialize(Describe());
    }
}

internal sealed class BinarySourceJson : JsonConverter<BinarySource>
{
    public override BinarySource Read(ref Utf8JsonReader reader, Type typeToConvert,
        JsonSerializerOptions options)
    {
        throw new JsonException("A binary source is not read from JSON.");
    }

    public override void Write(Utf8JsonWriter writer, BinarySource value, JsonSerializerOptions options)
    {
        JsonSerializer.Serialize(writer, value.Describe(), options);
    }
}

// An encoded request body and the content type it must be sent with.
public sealed record BodyEncoded(string Type, object Body);

// A form or multipart encoder of the codec registry.
public delegate BodyEncoded BodyEncoder(Context ctx, object? data, Dictionary<string, object?> sources);
