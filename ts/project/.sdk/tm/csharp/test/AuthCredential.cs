using System.Text.RegularExpressions;
using Xunit;

namespace ProjectNameSdk.Test;

internal record AuthCredential(string Bag, string Name, string Pair)
{
    internal Dictionary<string, object?> Container(Spec spec) => Bag == "query" ? spec.Query : spec.Headers;

    internal static AuthCredential? Probe(bool basic)
    {
        var client = ProjectNameSDK.TestSDK(null, new Dictionary<string, object?>
        {
            ["apikey"] = "K",
            ["secret"] = basic ? "S" : "",
            ["auth"] = new Dictionary<string, object?> { ["prefix"] = "Bearer", ["basic"] = basic },
        });
        var utility = client.GetUtility();
        var ctx = utility.MakeContext(new Dictionary<string, object?>
        {
            ["client"] = client,
            ["utility"] = utility,
        }, client.GetRootCtx());
        ctx.Spec = new Spec(new Dictionary<string, object?>());
        utility.PrepareAuth(ctx);
        foreach (var bag in new[] { "headers", "query" })
        {
            var values = bag == "query" ? ctx.Spec.Query : ctx.Spec.Headers;
            foreach (var entry in values)
            {
                var pair = bag == "headers" && entry.Key == "cookie" && entry.Value is string text
                    && Regex.IsMatch(text, "^[^=;]+=K$") ? text[..^1] : "";
                return new AuthCredential(bag, entry.Key, pair);
            }
        }
        return null;
    }

    internal static AuthCredential? Discover()
    {
        var cred = Probe(false);
        Assert.Equal(cred == null, Probe(true) == null);
        return cred;
    }

    internal static object? Expected(AuthCredential? cred, string prefix, string key) => cred == null ? null
        : cred.Pair != "" ? cred.Pair + key
        : cred.Bag == "headers" && prefix != "" ? prefix + " " + key : key;

    internal static object? Actual(Spec spec, AuthCredential? cred)
    {
        if (cred != null) return cred.Container(spec).GetValueOrDefault(cred.Name);
        Assert.Empty(spec.Headers);
        Assert.Empty(spec.Query);
        return null;
    }

    internal static bool Contains(Spec spec, AuthCredential? cred)
    {
        if (cred != null) return cred.Container(spec).ContainsKey(cred.Name);
        Actual(spec, cred);
        return false;
    }

    internal static Spec Seed(AuthCredential? cred)
    {
        var spec = new Spec(new Dictionary<string, object?>());
        if (cred != null) cred.Container(spec)[cred.Name] = Expected(cred, "", "stale");
        return spec;
    }

    internal static object? Retarget(object? node, AuthCredential? cred)
    {
        if (node is List<object?> list) return list.Select(v => Retarget(v, cred)).ToList();
        if (node is not Dictionary<string, object?> fields) return node;
        var output = new Dictionary<string, object?>();
        foreach (var entry in fields)
        {
            if (entry.Key == "headers" && entry.Value is Dictionary<string, object?> headers)
                output["headers"] = headers.Where(e => e.Key != "authorization").ToDictionary(e => e.Key, e => e.Value);
            else output[entry.Key] = Retarget(entry.Value, cred);
        }
        if (cred != null && fields.GetValueOrDefault("headers") is Dictionary<string, object?> source
            && source.TryGetValue("authorization", out var value))
        {
            if (output.GetValueOrDefault(cred.Bag) is not Dictionary<string, object?> bag)
                output[cred.Bag] = bag = new Dictionary<string, object?>();
            bag[cred.Name] = cred.Pair != "" && value is string text ? Expected(cred, "", text) : value;
        }
        return output;
    }
}
