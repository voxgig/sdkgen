// ProjectName SDK codec: form - an application/x-www-form-urlencoded body.

using System.Text;

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    private const string FormMedia = "application/x-www-form-urlencoded";

    private const string FormHex = "0123456789ABCDEF";

    // Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
    internal static string FormEscape(byte[] bytes)
    {
        var out_ = new StringBuilder();
        foreach (var b in bytes)
        {
            if ((0x30 <= b && b <= 0x39) || (0x41 <= b && b <= 0x5a) || (0x61 <= b && b <= 0x7a) ||
                0x2a == b || 0x2d == b || 0x2e == b || 0x5f == b)
            {
                out_.Append((char)b);
            }
            else if (0x20 == b)
            {
                out_.Append('+');
            }
            else
            {
                out_.Append('%').Append(FormHex[b >> 4]).Append(FormHex[b & 15]);
            }
        }
        return out_.ToString();
    }

    private static byte[] FormValue(Context ctx, string name, object value)
    {
        var content = value is BinarySource source ? source.Data : value;
        if (content is Stream)
        {
            throw ctx.MakeError("binary_source_refused", "The form field \"" + name +
                "\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.");
        }
        return IsBytes(content) ? ToBytes(content) : ToBytes(ItemText(content));
    }

    internal static BodyEncoded EncodeForm(Context ctx, object? data, Dictionary<string, object?> lifted)
    {
        var body = StructUtils.GetProp(ctx.Point, "body");
        var pairs = new List<string>();

        foreach (var item in BodyItems(body, data, lifted))
        {
            pairs.Add(FormEscape(ToBytes(item.Name)) + "=" + FormEscape(FormValue(ctx, item.Name, item.Value)));
        }

        var media = StructUtils.GetProp(body, "media") is string declared && declared != ""
            ? declared : FormMedia;
        return new BodyEncoded(media, string.Join("&", pairs));
    }
}
