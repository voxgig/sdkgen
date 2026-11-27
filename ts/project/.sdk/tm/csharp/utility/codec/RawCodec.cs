// ProjectName SDK codec: raw - a response body that is not JSON, read to a bound.

using System.Text;
using System.Text.RegularExpressions;

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    private const long RawMaxBuffer = 16777216;

    private static readonly Regex RawDigits = new("^[0-9]+$");

    internal static long MaxBuffer(Context ctx)
    {
        foreach (var val in new[]
        {
            StructUtils.GetProp(ctx.Options, "maxBuffer"),
            SdkSchema.Optspec.GetValueOrDefault("maxBuffer"),
        })
        {
            var n = val switch
            {
                int i => i,
                long l => l,
                double d when double.IsFinite(d) => (long)d,
                _ => -1L,
            };
            if (0 <= n)
            {
                return n;
            }
        }
        return RawMaxBuffer;
    }

    private static void RawCancel(object? body)
    {
        try
        {
            (body as IDisposable)?.Dispose();
        }
        catch (Exception)
        {
        }
    }

    private static ProjectNameError RawTooLarge(Context ctx, string code, long max, long? declared)
    {
        return ctx.MakeError(code, "response: body " + (declared == null ? "is longer than" :
            "of " + declared + " bytes exceeds") + " maxBuffer (" + max + " bytes)");
    }

    // The whole body, refused past the bound: by its declared length before a
    // byte is read, else by the count as it arrives.
    internal static byte[] ReadBounded(Context ctx, Response? response, long max, string code)
    {
        var body = response?.Body;
        var length = Response.HeaderValue(response?.Headers, "content-length").Trim();
        long? declared = RawDigits.IsMatch(length) && long.TryParse(length, out var n) ? n : null;

        if (declared != null && max < declared)
        {
            RawCancel(body);
            throw RawTooLarge(ctx, code, max, declared);
        }

        if (body is Stream stream)
        {
            try
            {
                using var out_ = new MemoryStream();
                var chunk = new byte[8192];
                long count = 0;
                for (var read = stream.Read(chunk, 0, chunk.Length); 0 < read;
                     read = stream.Read(chunk, 0, chunk.Length))
                {
                    count += read;
                    if (max < count)
                    {
                        throw RawTooLarge(ctx, code, max, null);
                    }
                    out_.Write(chunk, 0, read);
                }
                return out_.ToArray();
            }
            finally
            {
                RawCancel(stream);
            }
        }

        var bytes = body switch
        {
            null => Array.Empty<byte>(),
            string text => Encoding.UTF8.GetBytes(text),
            _ when IsBytes(body) => ToBytes(body),
            _ => Encoding.UTF8.GetBytes(StructUtils.IsNode(body) ? StructUtils.Jsonify(body, 0)
                : Convert.ToString(body, System.Globalization.CultureInfo.InvariantCulture) ?? ""),
        };
        if (max < bytes.LongLength)
        {
            throw RawTooLarge(ctx, code, max, null);
        }
        return bytes;
    }

    // A raw success body: text into the record under `$body`; bytes only into
    // a binary handle's read, never into the record.
    internal static void ReadRawUtil(Context ctx)
    {
        var response = ctx.Response;
        var result = ctx.Result!;
        var transfer = ctx.Ctrl.Transfer;
        var max = MaxBuffer(ctx);

        if (StructUtils.GetProp(StructUtils.GetProp(ctx.Point, "response"), "binary") is true)
        {
            result.Body = null;
            if (transfer != null && "read".Equals(transfer.GetValueOrDefault("direction")))
            {
                transfer["bytes"] = ReadBounded(ctx, response, max, "binary_too_large");
            }
            else
            {
                RawCancel(response?.Body);
            }
            return;
        }

        var text = Encoding.UTF8.GetString(ReadBounded(ctx, response, max, "response_too_large"));
        result.Body = new Dictionary<string, object?>
        {
            [RawBody] = text.StartsWith('﻿') ? text.Substring(1) : text,
        };
    }
}
