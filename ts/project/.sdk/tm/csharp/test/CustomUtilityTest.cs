// Custom utility overrides supplied via options.utility land on the client
// utility's Custom map. C# twin of tm/go/test/custom_utility_test.go.

using Xunit;

using ProjectNameSdk;

namespace ProjectNameSdk.Test;

public class CustomUtilityTest
{
    private static Func<Dictionary<string, object?>> Util(string tag)
    {
        return () => new Dictionary<string, object?> { ["util"] = tag };
    }

    [Fact]
    public void Basic()
    {
        var names = new[]
        {
            "auth", "body", "contextify", "done", "error", "findparam",
            "fullurl", "headers", "method", "operator", "params", "query",
            "reqform", "request", "resbasic", "resbody", "resform",
            "resheaders", "response", "result", "spec",
        };

        var utilityOpt = new Dictionary<string, object?>();
        foreach (var name in names)
        {
            utilityOpt[name] = Util(name.ToUpperInvariant());
        }

        var client = ProjectNameSDK.TestSDK(null, new Dictionary<string, object?>
        {
            ["apikey"] = "APIKEY01",
            ["utility"] = utilityOpt,
        });

        var u = client.GetUtility();

        foreach (var name in names)
        {
            Assert.True(u.Custom.ContainsKey(name),
                $"expected custom utility \"{name}\" to exist");
            var fn = Assert.IsType<Func<Dictionary<string, object?>>>(u.Custom[name]);
            var result = fn();
            Assert.Equal(name.ToUpperInvariant(), result["util"]);
        }
    }

    // The half the test above cannot see. Those keys are ALIASES - `auth`,
    // `body`, `spec` - and no utility member has those names, so landing in
    // Custom is the right outcome for them and the assertion passes whether or
    // not overriding works at all.
    //
    // A key that DOES name a member must replace it. That is the documented
    // contract, it is what ts does, and it was silently absent here: every
    // entry went to Custom, which nothing reads, so `utility: { fetcher = ... }`
    // did nothing while ts honoured it.
    [Fact]
    public void ARealUtilityMemberIsReplacedNotShelved()
    {
        var reached = 0;
        FetcherFunc scripted = (ctx, fullurl, fetchdef) =>
        {
            reached++;
            return new Dictionary<string, object?>
            {
                ["status"] = 200,
                ["statusText"] = "OK",
                ["headers"] = new Dictionary<string, object?>(),
                ["body"] = "{}",
            };
        };

        // The plain constructor, not TestSDK. The `test` feature is
        // transport: 'base' - it REPLACES the transport by design - so a client
        // in test mode would shadow the scripted fetcher and this would assert
        // nothing.
        var client = new ProjectNameSDK(new Dictionary<string, object?>
        {
            ["utility"] = new Dictionary<string, object?> { ["fetcher"] = scripted },
        });

        var u = client.GetUtility();

        Assert.NotNull(u.Fetcher);
        Assert.False(u.Custom.ContainsKey("fetcher"),
            "fetcher was shelved in Custom instead of replacing the member");

        // Behaviour, not identity: drive it.
        var ctx = u.MakeContext(new Dictionary<string, object?>(), client.GetRootCtx());
        u.Fetcher(ctx, "http://example.test/probe", new Dictionary<string, object?>());
        Assert.Equal(1, reached);
    }

    // An unknown key must still be attached rather than dropped, so the two
    // halves cannot be satisfied by a rule that also swallows extras.
    [Fact]
    public void AnUnknownKeyIsStillAttached()
    {
        var client = new ProjectNameSDK(new Dictionary<string, object?>
        {
            ["utility"] = new Dictionary<string, object?>
            {
                ["notAUtilityMember"] = Util("EXTRA"),
            },
        });

        Assert.True(client.GetUtility().Custom.ContainsKey("notAUtilityMember"),
            "an unknown utility key was dropped instead of kept in Custom");
    }
}
