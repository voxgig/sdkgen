// Requests in flight at once on one client. Each resolves its operation
// through the cache the client's root context shares with every request.

using System.Collections.Concurrent;

using Xunit;

using ProjectNameSdk;

namespace ProjectNameSdk.Test;

public class ConcurrencyTest
{
    private const int Rounds = 200;
    private const int Width = 8;
    private const int Ops = 32;

    private static Dictionary<string, object?> Answer(string url, Dictionary<string, object?> fetchdef)
    {
        return new Dictionary<string, object?>
        {
            ["status"] = 200,
            ["statusText"] = "OK",
            ["headers"] = new Dictionary<string, object?>(),
            ["json"] = (Func<object?>)(() => new Dictionary<string, object?> { ["ok"] = true }),
        };
    }

    // A live client whose transport answers at once.
    private static ProjectNameSDK LiveClient()
    {
        return new ProjectNameSDK(new Dictionary<string, object?>
        {
            ["base"] = "http://concurrency.test/api",
            ["allow"] = new Dictionary<string, object?> { ["op"] = "direct" },
            ["system"] = new Dictionary<string, object?>
            {
                ["fetch"] = (Func<string, Dictionary<string, object?>,
                    Dictionary<string, object?>>)Answer,
            },
        });
    }

    // Runs body on Width threads released together, and returns what they threw.
    private static List<Exception> AtOnce(Action<int> body)
    {
        var start = new Barrier(Width);
        var thrown = new ConcurrentQueue<Exception>();
        var threads = new List<Thread>();
        for (var i = 0; i < Width; i++)
        {
            var n = i;
            var thread = new Thread(() =>
            {
                try
                {
                    start.SignalAndWait();
                    body(n);
                }
                catch (Exception e)
                {
                    thrown.Enqueue(e);
                }
            });
            thread.Start();
            threads.Add(thread);
        }
        threads.ForEach(t => t.Join());
        return thrown.ToList();
    }

    [Fact]
    public void ConcurrentFirstRequestsSucceed()
    {
        for (var round = 0; round < Rounds; round++)
        {
            // A fresh client each round, so every request in it is a first request.
            var client = LiveClient();
            var results = new Dictionary<string, object?>?[Width];
            var thrown = AtOnce(n =>
                results[n] = client.Direct(new Dictionary<string, object?> { ["path"] = "p" + n }));

            Assert.True(0 == thrown.Count, "round " + round + " threw:\n" + string.Join("\n", thrown));
            for (var n = 0; n < Width; n++)
            {
                var res = results[n];
                Assert.True(Equals(true, res?["ok"]), "round " + round + ", request " + n +
                    " failed: " + (res?.GetValueOrDefault("err") ?? "no result"));
            }
        }
    }

    [Fact]
    public void ConcurrentResolutionsShareOneCachedOperation()
    {
        for (var round = 0; round < Rounds; round++)
        {
            var client = LiveClient();
            var utility = client.GetUtility();
            var root = client.GetRootCtx();
            var ops = new Operation?[Width, Ops];
            var thrown = AtOnce(n =>
            {
                for (var k = 0; k < Ops; k++)
                {
                    ops[n, k] = utility.MakeContext(
                        new Dictionary<string, object?> { ["opname"] = "op" + k }, root).Op;
                }
            });

            Assert.True(0 == thrown.Count, "round " + round + " threw:\n" + string.Join("\n", thrown));
            for (var k = 0; k < Ops; k++)
            {
                var cached = utility.MakeContext(
                    new Dictionary<string, object?> { ["opname"] = "op" + k }, root).Op;
                for (var n = 0; n < Width; n++)
                {
                    Assert.True(ReferenceEquals(cached, ops[n, k]),
                        "round " + round + ": op" + k + " resolved to more than one Operation");
                }
            }
        }
    }
}
