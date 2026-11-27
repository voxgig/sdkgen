// ProjectName SDK codec: multipart - a multipart/form-data body.

using System.Security.Cryptography;
using System.Text;

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    private const string MultipartMedia = "multipart/form-data";

    private const string OctetMedia = "application/octet-stream";

    private const string Crlf = "\r\n";

    internal static string MultipartBoundaryUtil(Context ctx)
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
    }

    // Inside a quoted header parameter nothing may end the quote or the line.
    internal static string Quoted(string text)
    {
        return text.Replace("\\", "%5C").Replace("\"", "%22").Replace("\r", "%0D").Replace("\n", "%0A");
    }

    // A local path never leaves: only its last segment, and nothing for an empty one.
    internal static string? BaseName(string? name)
    {
        if (name == null)
        {
            return null;
        }
        var base_ = name.Split('/', '\\')[^1];
        return "" == base_ ? null : base_;
    }

    private sealed record Part(string Name, string? Filename, string? Type, byte[] Content);

    private static Part FilePart(Context ctx, string name, Dictionary<string, object?> field, object value)
    {
        var content = value;
        string? filename = null;
        string? type = null;

        if (value is BinarySource source)
        {
            content = source.Data;
            filename = BaseName(source.Name);
            type = source.Type;
        }

        if (content is Stream)
        {
            throw ctx.MakeError("binary_feature_inactive", "The multipart field \"" + name +
                "\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.");
        }

        return new Part(name, filename, type ?? field.GetValueOrDefault("media") as string ?? OctetMedia,
            IsBytes(content) ? ToBytes(content) : ToBytes(ItemText(content)));
    }

    private static Part TextPart(string name, Dictionary<string, object?> field, object value)
    {
        return new Part(name, null, field.GetValueOrDefault("media") as string,
            IsBytes(value) ? ToBytes(value) : ToBytes(ItemText(value)));
    }

    internal static BodyEncoded EncodeMultipart(Context ctx, object? data, Dictionary<string, object?> lifted)
    {
        var body = StructUtils.GetProp(ctx.Point, "body");
        var boundary = (ctx.Utility?.MultipartBoundary ?? MultipartBoundaryUtil)(ctx);
        using var out_ = new MemoryStream();

        void Write(string text)
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            out_.Write(bytes, 0, bytes.Length);
        }

        foreach (var item in BodyItems(body, data, lifted))
        {
            var part = item.Binary ? FilePart(ctx, item.Name, item.Field, item.Value)
                : TextPart(item.Name, item.Field, item.Value);

            if (part.Type != null && (part.Type.Contains('\r') || part.Type.Contains('\n')))
            {
                throw ctx.MakeError("binary_source_refused", "The media type of the multipart field \"" +
                    item.Name + "\" contains a line break.");
            }

            Write("--" + boundary + Crlf +
                "Content-Disposition: form-data; name=\"" + Quoted(part.Name) + "\"" +
                (part.Filename == null ? "" : "; filename=\"" + Quoted(part.Filename) + "\"") + Crlf +
                (part.Type == null ? "" : "Content-Type: " + part.Type + Crlf) + Crlf);
            out_.Write(part.Content, 0, part.Content.Length);
            Write(Crlf);
        }

        Write("--" + boundary + "--" + Crlf);

        var declared = (StructUtils.GetProp(body, "media") as string ?? "").Split(';')[0].Trim();
        var type = ("" == declared ? MultipartMedia : declared) + "; boundary=" + boundary;
        return new BodyEncoded(type, out_.ToArray());
    }
}
