// ProjectName SDK - transport response wrapper.

using System.Text.RegularExpressions;

using Voxgig.Struct;

namespace ProjectNameSdk;

public class Response
{
    public int Status = -1;
    public string StatusText = "";
    public object? Headers;
    public Func<object?>? JsonFunc;
    public object? Body;
    public Exception? Err;

    // Set by a transport that could not read a non-blank body as JSON.
    public bool Unreadable;

    private const int PreviewLength = 160;

    public Response(Dictionary<string, object?>? resmap)
    {
        resmap ??= new Dictionary<string, object?>();

        var s = StructUtils.GetProp(resmap, "status");
        if (s != null)
        {
            Status = Helpers.ToInt(s);
        }

        if (StructUtils.GetProp(resmap, "statusText") is string st)
        {
            StatusText = st;
        }

        Headers = StructUtils.GetProp(resmap, "headers");

        if (StructUtils.GetProp(resmap, "json") is Func<object?> jf)
        {
            JsonFunc = jf;
        }

        Body = StructUtils.GetProp(resmap, "body");

        if (StructUtils.GetProp(resmap, "err") is Exception er)
        {
            Err = er;
        }

        Unreadable = StructUtils.GetProp(resmap, "unreadable") is true;
    }

    // A body that is not JSON. An HTTP failure keeps its own error, with the
    // response described; otherwise the code tells a wrong content type from
    // malformed JSON.
    public static Exception UnreadableBody(Context ctx, int status, object? headers,
        object? text, object? sent, Exception? failed)
    {
        var type = HeaderValue(headers, "content-type");
        var agent = Clean(ctx, HeaderValue(sent, "user-agent"));
        // Only text is quoted: bytes are a file's, by the model or by their type.
        var detail = "HTTP " + status + ", content-type " + (type == "" ? "none" : type) +
            ", user-agent " + (agent == "" ? "transport default" : agent) +
            (text != null && !IsBinary(ctx.Point, type) ? ", body: " + Preview(ctx, text) : "");

        if (failed is ProjectNameError sdkErr)
        {
            sdkErr.SetMessage(sdkErr.Message + " (" + detail + ")");
            return sdkErr;
        }
        if (failed != null)
        {
            return new Exception(failed.Message + " (" + detail + ")", failed);
        }

        return type == "" || type.Contains("json", StringComparison.OrdinalIgnoreCase)
            ? ctx.MakeError("response_json_invalid", "response: body is not valid JSON (" + detail + ")")
            : ctx.MakeError("response_content_type",
                "response: expected JSON, got " + type + " (" + detail + ")");
    }

    internal static string HeaderValue(object? headers, string name)
    {
        if (headers is IDictionary<string, object?> map)
        {
            foreach (var kv in map)
            {
                if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase))
                {
                    return kv.Value?.ToString() ?? "";
                }
            }
        }
        return "";
    }

    private static string Clean(Context ctx, string s)
    {
        return ctx.Utility?.Clean(ctx, s)?.ToString() ?? s;
    }

    private static readonly Regex TextMedia =
        new("json|xml|html|javascript|ecmascript|yaml|urlencoded|graphql");

    // A response whose body is bytes: by the model, or by the type it
    // declares. Text is no declared type, text/*, or a structured text format.
    internal static bool IsBinary(Dictionary<string, object?>? point, string type)
    {
        if (point != null && point.TryGetValue("response", out var response) &&
            response is IDictionary<string, object?> rs &&
            rs.TryGetValue("binary", out var binary) && binary is true)
        {
            return true;
        }
        var media = type.Split(';', 2)[0].Trim().ToLowerInvariant();
        return media != "" && !media.StartsWith("text/", StringComparison.Ordinal) &&
            !TextMedia.IsMatch(media);
    }

    // Cleaned whole: a secret the bound would split could leave its prefix.
    private static string Preview(Context ctx, object text)
    {
        var flat = Clean(ctx, Regex.Replace(text.ToString() ?? "", @"\s+", " ").Trim());
        var count = 0;
        var end = 0;
        foreach (var rune in flat.EnumerateRunes())
        {
            if (count == PreviewLength)
            {
                return flat.Substring(0, end) + "...";
            }
            count++;
            end += rune.Utf16SequenceLength;
        }
        return flat;
    }
}
