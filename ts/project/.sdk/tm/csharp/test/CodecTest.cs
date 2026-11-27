// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity.

using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

using Xunit;
using Xunit.Abstractions;

using ProjectNameSdk;

namespace ProjectNameSdk.Test;

public class CodecTest
{
    private readonly ITestOutputHelper _out;

    public CodecTest(ITestOutputHelper output)
    {
        _out = output;
    }

    private static readonly Encoding Latin1 = Encoding.Latin1;

    private sealed record Arrived(string Method, string Url, Dictionary<string, string> Headers, byte[] Body);

    private sealed record Expect(string Name, string Value, string? Filename = null, string? Type = null,
        bool File = false);

    private sealed record CodecCase(string Name, Action<Listener> Run);

    // A loopback origin that keeps each request and answers as the case says.
    private sealed class Listener : IDisposable
    {
        private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
        private readonly List<Arrived> _arrivals = new();

        public readonly string Base;
        public int Status = 200;
        public string Type = "application/json";
        public byte[] Body = Array.Empty<byte>();

        public Listener()
        {
            _listener.Start();
            Base = "http://127.0.0.1:" + ((IPEndPoint)_listener.LocalEndpoint).Port;
            Task.Run(Serve);
        }

        public void Dispose() => _listener.Stop();

        public void Answer(string type, byte[] body)
        {
            Type = type;
            Body = body;
        }

        public void Reset()
        {
            lock (_arrivals)
            {
                _arrivals.Clear();
            }
            Status = 200;
            Type = "application/json";
            Body = Array.Empty<byte>();
        }

        public Arrived Last()
        {
            lock (_arrivals)
            {
                Assert.True(0 < _arrivals.Count, "nothing arrived");
                return _arrivals[^1];
            }
        }

        private void Serve()
        {
            while (true)
            {
                TcpClient conn;
                try
                {
                    conn = _listener.AcceptTcpClient();
                }
                catch (Exception)
                {
                    return;
                }
                using (conn)
                {
                    try
                    {
                        Handle(conn.GetStream());
                    }
                    catch (IOException)
                    {
                    }
                }
            }
        }

        private void Handle(NetworkStream stream)
        {
            var head = new List<byte>();
            while (head.Count < 4 || !(head[^4] == '\r' && head[^3] == '\n' && head[^2] == '\r' && head[^1] == '\n'))
            {
                var b = stream.ReadByte();
                if (b < 0)
                {
                    return;
                }
                head.Add((byte)b);
            }
            var lines = Latin1.GetString(head.ToArray()).Split("\r\n");
            var first = lines[0].Split(' ');
            var headers = new Dictionary<string, string>();
            foreach (var line in lines.Skip(1).Where(l => l != ""))
            {
                var colon = line.IndexOf(':');
                headers[line.Substring(0, colon).Trim().ToLowerInvariant()] = line.Substring(colon + 1).Trim();
            }
            var body = new byte[int.TryParse(headers.GetValueOrDefault("content-length"), out var n) ? n : 0];
            for (var got = 0; got < body.Length;)
            {
                var read = stream.Read(body, got, body.Length - got);
                if (read <= 0)
                {
                    break;
                }
                got += read;
            }
            lock (_arrivals)
            {
                _arrivals.Add(new Arrived(first[0], 1 < first.Length ? first[1] : "", headers, body));
            }
            var reply = Latin1.GetBytes("HTTP/1.1 " + Status + " X\r\nContent-Type: " + Type +
                "\r\nContent-Length: " + Body.Length + "\r\nConnection: close\r\n\r\n");
            stream.Write(reply, 0, reply.Length);
            stream.Write(Body, 0, Body.Length);
        }
    }

    private static Dictionary<string, object?> Config() => SdkConfig.SharedConfig();

    // The entity accessors of the client, by entity name.
    private static Dictionary<string, MethodInfo> Accessors(ProjectNameSDK client)
    {
        var out_ = new Dictionary<string, MethodInfo>();
        foreach (var m in typeof(ProjectNameSDK).GetMethods(BindingFlags.Public | BindingFlags.Instance))
        {
            if (!typeof(ProjectNameEntityBase).IsAssignableFrom(m.ReturnType) || 1 != m.GetParameters().Length)
            {
                continue;
            }
            if (m.Invoke(client, new object?[] { null }) is ProjectNameEntityBase ent)
            {
                out_[ent.GetName()] = m;
            }
        }
        return out_;
    }

    private static Dictionary<string, object?> Params(Dictionary<string, object?> point)
    {
        var out_ = new Dictionary<string, object?>();
        foreach (var part in point.GetValueOrDefault("parts") as List<object?> ?? new List<object?>())
        {
            var m = Regex.Match(part as string ?? "", "^\\{(.+)\\}$");
            if (m.Success)
            {
                out_[m.Groups[1].Value] = "p1";
            }
        }
        return out_;
    }

    private static string? ActionOf(Dictionary<string, object?> point) =>
        (point.GetValueOrDefault("select") as Dictionary<string, object?>)?.GetValueOrDefault("$action") as string;

    private static Dictionary<string, object?> Select(Dictionary<string, object?> point)
    {
        var action = ActionOf(point);
        return action == null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?> { ["$action"] = action };
    }

    private static Dictionary<string, object?> Merge(params Dictionary<string, object?>[] maps)
    {
        var out_ = new Dictionary<string, object?>();
        foreach (var map in maps)
        {
            foreach (var kv in map)
            {
                out_[kv.Key] = kv.Value;
            }
        }
        return out_;
    }

    private static byte[] Content(string name) => Latin1.GetBytes("file:" + name + "\u0000ÿ\r\n--");

    private static string Text(byte[] bytes) => Latin1.GetString(bytes);

    private static Exception Unwrapped(Exception err) =>
        err is TargetInvocationException { InnerException: { } inner } ? inner : err;

    private static object? Op(ProjectNameEntityBase ent, string opname, Dictionary<string, object?> args)
    {
        return opname switch
        {
            "load" => ent.Load(args),
            "create" => ent.Create(args),
            "update" => ent.Update(args),
            "patch" => ent.Patch(args),
            _ => throw new InvalidOperationException("no operation " + opname),
        };
    }

    // The entity's Binary(slot), whose parameter the model decides.
    private static object Handle(ProjectNameEntityBase ent, string? slot)
    {
        var binary = ent.GetType().GetMethod("Binary") ??
            throw new InvalidOperationException(ent.GetName() + " has no Binary()");
        var args = 0 == binary.GetParameters().Length ? Array.Empty<object?>() : new object?[] { slot };
        return binary.Invoke(ent, args)!;
    }

    private static object? Call(object target, string method, params object?[] args)
    {
        try
        {
            return target.GetType().GetMethod(method)!.Invoke(target, args);
        }
        catch (Exception err)
        {
            throw Unwrapped(err);
        }
    }

    // The data a form or multipart point is sent, and the parts it must arrive as.
    private static (Dictionary<string, object?> Data, List<Expect> Expect) Plan(Dictionary<string, object?> body)
    {
        var data = new Dictionary<string, object?>();
        var expect = new List<Expect>();
        var form = "form".Equals(body.GetValueOrDefault("kind"));
        foreach (var field in (body.GetValueOrDefault("fields") as List<object?> ?? new List<object?>())
            .OfType<Dictionary<string, object?>>())
        {
            var name = (string)field["name"]!;
            if (field.GetValueOrDefault("binary") is true)
            {
                var type = form ? null : field.GetValueOrDefault("media") as string ?? "application/octet-stream";
                data[name] = BinarySource.Bytes(Content(name), "/local/dir/" + name + ".bin", type);
                expect.Add(form ? new Expect(name, Text(Content(name)))
                    : new Expect(name, Text(Content(name)), name + ".bin", type, true));
            }
            else if (field.GetValueOrDefault("list") is true)
            {
                data[name] = new List<object?> { "a", "b c" };
                expect.Add(new Expect(name, "a"));
                expect.Add(new Expect(name, "b c"));
            }
            else if (field.GetValueOrDefault("join") is string join)
            {
                data[name] = new List<object?> { "a", "b" };
                expect.Add(new Expect(name, "a" + join + "b"));
            }
            else
            {
                data[name] = "v\"" + name + "\r\n";
                expect.Add(new Expect(name, Text(Encoding.UTF8.GetBytes("v\"" + name + "\r\n"))));
            }
        }
        return (data, expect);
    }

    private static List<Expect> Multipart(Arrived arrived)
    {
        var type = arrived.Headers.GetValueOrDefault("content-type") ?? "";
        var boundary = Regex.Match(type, "boundary=([^;]+)");
        Assert.True(boundary.Success, "no boundary in " + type);
        var delim = "--" + boundary.Groups[1].Value;
        var text = Text(arrived.Body);
        Assert.True(text.EndsWith(delim + "--\r\n"), "the body does not close");
        var chunks = text.Split(delim);
        var parts = new List<Expect>();
        foreach (var chunk in chunks.Skip(1).Take(chunks.Length - 2))
        {
            var at = chunk.IndexOf("\r\n\r\n", StringComparison.Ordinal);
            var head = chunk.Substring(2, at - 2);
            var content = chunk.Substring(at + 4, chunk.Length - at - 6);
            var disp = Regex.Match(head,
                "^Content-Disposition: form-data; name=\"([^\"]*)\"(?:; filename=\"([^\"]*)\")?\r?$",
                RegexOptions.Multiline);
            Assert.True(disp.Success, "a part without a disposition: " + head);
            var ctype = Regex.Match(head, "^Content-Type: (.*?)\r?$", RegexOptions.Multiline);
            parts.Add(disp.Groups[2].Success
                ? new Expect(disp.Groups[1].Value, content, disp.Groups[2].Value,
                    ctype.Success ? ctype.Groups[1].Value : null, true)
                : new Expect(disp.Groups[1].Value, content));
        }
        return parts;
    }

    private static List<Expect> Form(Arrived arrived)
    {
        var pairs = new List<Expect>();
        var text = Text(arrived.Body);
        if ("" == text)
        {
            return pairs;
        }
        foreach (var pair in text.Split('&'))
        {
            var eq = pair.IndexOf('=');
            pairs.Add(eq < 0 ? new Expect(Unescape(pair), "")
                : new Expect(Unescape(pair.Substring(0, eq)), Unescape(pair.Substring(eq + 1))));
        }
        return pairs;
    }

    // The bytes of a form-escaped text, as latin1.
    private static string Unescape(string text)
    {
        var bytes = new List<byte>();
        for (var i = 0; i < text.Length; i++)
        {
            if ('+' == text[i])
            {
                bytes.Add(0x20);
            }
            else if ('%' == text[i])
            {
                bytes.Add(Convert.ToByte(text.Substring(i + 1, 2), 16));
                i += 2;
            }
            else
            {
                bytes.Add((byte)text[i]);
            }
        }
        return Text(bytes.ToArray());
    }

    private static List<CodecCase> Cases()
    {
        var cases = new List<CodecCase>();
        var probe = new ProjectNameSDK(new Dictionary<string, object?> { ["base"] = "http://127.0.0.1:1" });
        var accessors = Accessors(probe);
        var entities = Config().GetValueOrDefault("entity") as Dictionary<string, object?> ??
            new Dictionary<string, object?>();

        foreach (var ename in entities.Keys.OrderBy(k => k, StringComparer.Ordinal))
        {
            if (!accessors.TryGetValue(ename, out var accessor))
            {
                continue;
            }
            var ops = (entities[ename] as Dictionary<string, object?>)?.GetValueOrDefault("op")
                as Dictionary<string, object?> ?? new Dictionary<string, object?>();

            foreach (var opname in ops.Keys.OrderBy(k => k, StringComparer.Ordinal))
            {
                var points = (ops[opname] as Dictionary<string, object?>)?.GetValueOrDefault("points")
                    as List<object?> ?? new List<object?>();
                foreach (var point in points.OfType<Dictionary<string, object?>>())
                {
                    var action = ActionOf(point);
                    var label = ename + "." + opname + (action == null ? "" : ":" + action);
                    var rb = point.GetValueOrDefault("body") as Dictionary<string, object?>;
                    var rs = point.GetValueOrDefault("response") as Dictionary<string, object?>;
                    var rbkind = rb?.GetValueOrDefault("kind") as string;
                    var writes = new[] { "create", "update", "patch" }.Contains(opname);
                    ProjectNameEntityBase Entity(ProjectNameSDK client) =>
                        (ProjectNameEntityBase)accessor.Invoke(client, new object?[] { null })!;

                    if (("form" == rbkind || "multipart" == rbkind) && writes)
                    {
                        cases.Add(new CodecCase(label + " sends a " + rbkind + " body", net =>
                        {
                            var (data, expect) = Plan(rb!);
                            net.Answer("application/json", Encoding.UTF8.GetBytes("{\"id\":\"p1\"}"));
                            Op(Entity(Client(net)), opname, Merge(Params(point), Select(point), data));
                            var arrived = net.Last();
                            var got = "form" == rbkind ? Form(arrived) : Multipart(arrived);
                            if ("form" == rbkind)
                            {
                                Assert.Equal(rb!["media"], arrived.Headers.GetValueOrDefault("content-type"));
                            }
                            Assert.Equal(expect, got.Where(g => expect.Exists(e => e.Name == g.Name)).ToList());
                        }));
                    }

                    if ("raw" == rbkind && writes)
                    {
                        var binary = rb!.GetValueOrDefault("binary") is true;
                        cases.Add(new CodecCase(label + " sends a raw " + (binary ? "binary" : "text") + " body", net =>
                        {
                            net.Answer("application/json", Encoding.UTF8.GetBytes("{\"id\":\"p1\"}"));
                            var ent = Entity(Client(net));
                            ent.Data(Params(point));
                            ent.Match(Params(point));
                            if (binary)
                            {
                                var got = Call(Handle(ent, action), "Put",
                                    BinarySource.Bytes(Content(label), type: rb["media"] as string), null);
                                Assert.Same(ent, got);
                                Assert.Equal(Content(label), net.Last().Body);
                            }
                            else
                            {
                                Op(ent, opname, Merge(Select(point),
                                    new Dictionary<string, object?> { ["$body"] = "text \"" + label + "\"\n" }));
                                Assert.Equal("text \"" + label + "\"\n", Encoding.UTF8.GetString(net.Last().Body));
                            }
                            Assert.Equal(rb["media"], net.Last().Headers.GetValueOrDefault("content-type"));
                        }));
                    }

                    if ("raw".Equals(rs?.GetValueOrDefault("kind")) && "load" == opname)
                    {
                        var binary = rs!.GetValueOrDefault("binary") is true;
                        cases.Add(new CodecCase(label + " reads a raw " + (binary ? "binary" : "text") + " body", net =>
                        {
                            var ent = Entity(Client(net));
                            ent.Data(Params(point));
                            ent.Match(Params(point));
                            if (binary)
                            {
                                net.Answer((string)rs["media"]!, Content(label));
                                var bytes = Call(Handle(ent, action), "Bytes", null, null);
                                Assert.Equal(Content(label), bytes);
                                var refused = Assert.ThrowsAny<ProjectNameError>(() =>
                                    ent.Load(Merge(Params(point), Select(point))));
                                Assert.Equal("binary_sink_required", refused.Code);
                            }
                            else
                            {
                                net.Answer((string)rs["media"]!, Encoding.UTF8.GetBytes("café " + label));
                                var got = ent.Load(Merge(Params(point), Select(point)));
                                Assert.Same(ent, got);
                                Assert.Equal("café " + label,
                                    (ent.Data() as Dictionary<string, object?>)?.GetValueOrDefault("$body"));
                            }
                        }));
                    }
                }
            }
        }
        return cases;
    }

    private static ProjectNameSDK Client(Listener net) =>
        new(new Dictionary<string, object?> { ["base"] = net.Base });

    [Fact]
    public void EveryBodyPointRoundTripsThroughAListener()
    {
        var cases = Cases();
        var ran = 0;
        var failures = new List<string>();

        using var net = new Listener();
        foreach (var kase in cases)
        {
            ran++;
            net.Reset();
            try
            {
                kase.Run(net);
                _out.WriteLine("ok " + kase.Name);
            }
            catch (Exception err)
            {
                failures.Add(kase.Name + ": " + Unwrapped(err));
            }
        }

        var line = "codec: ran " + ran + " case(s), " + failures.Count + " failed";
        Console.WriteLine(line);
        _out.WriteLine(line);
        foreach (var failure in failures)
        {
            _out.WriteLine("FAILED " + failure);
        }

        Assert.True(0 < cases.Count, "no form, multipart or raw point was found");
        Assert.Empty(failures);
    }
}
