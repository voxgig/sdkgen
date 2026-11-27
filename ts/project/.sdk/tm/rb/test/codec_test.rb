# ProjectName SDK codec test
#
# Every form, multipart and raw point this SDK has, driven through a real
# entity operation against a local listener that decodes what arrives. The
# cases come from the client's own config, so no case names an entity.

require "minitest/autorun"
require "socket"
require "uri"
require "json"
require_relative "../ProjectName_sdk"

class ProjectNameCodecTest < Minitest::Test
  @@listener = nil
  @@arrivals = []
  @@answer = {}
  @@ran = 0
  @@failed = 0

  Minitest.after_run do
    puts "codec: ran #{@@ran} case(s), #{@@failed} failed"
  end

  def self.listener
    return @@listener unless @@listener.nil?
    server = TCPServer.new("127.0.0.1", 0)
    Thread.new do
      loop do
        sock = server.accept
        begin
          serve(sock)
        rescue StandardError
          nil
        ensure
          sock.close
        end
      end
    end
    @@listener = "http://127.0.0.1:#{server.addr[1]}"
  end

  def self.serve(sock)
    line = sock.gets("\r\n").to_s.strip
    method, url = line.split(" ")
    headers = {}
    while (hl = sock.gets("\r\n")) && hl != "\r\n"
      k, v = hl.split(":", 2)
      headers[k.strip.downcase] = v.to_s.strip
    end
    body = "".b
    length = headers["content-length"].to_i
    body = sock.read(length).to_s.b if length > 0
    @@arrivals << { "method" => method, "url" => url, "headers" => headers, "body" => body }
    out = (@@answer["body"] || "").b
    sock.write("HTTP/1.1 #{@@answer['status'] || 200} OK\r\n" \
      "content-type: #{@@answer['type'] || 'application/json'}\r\n" \
      "content-length: #{out.bytesize}\r\nconnection: close\r\n\r\n")
    sock.write(out)
  end

  PROBE = ProjectNameSDK.new({ "base" => "http://127.0.0.1:1" })
  CONFIG = ProjectNameConfig.shared_config

  # The client's entity accessors, by entity name.
  def self.accessors
    out = {}
    PROBE.public_methods(false).map(&:to_s).select { |m| m.match?(/\A[A-Z]/) }.each do |m|
      inst = begin
        PROBE.public_send(m)
      rescue StandardError
        nil
      end
      next unless inst.respond_to?(:get_name) && CONFIG["entity"].key?(inst.get_name)
      out[inst.get_name] = m
    end
    out
  end

  # A value for each path parameter a point names.
  def self.params(point)
    out = {}
    (point["parts"] || []).each do |part|
      found = part.to_s.match(/\A\{(.+)\}\z/)
      out[found[1]] = "p1" unless found.nil?
    end
    out
  end

  def self.select(point)
    action = (point["select"] || {})["$action"]
    action.nil? ? {} : { "$action" => action }
  end

  # The unnamed slot is reached with no name; an entity with no other takes none.
  def self.handle(ent, action)
    action.nil? ? ent.binary : ent.binary(action)
  end

  def self.content(name)
    ("file:" + name).b + "\x00\xFF\r\n--".b
  end

  # The data a form or multipart point is sent, and the parts it must arrive as.
  def self.plan(client, body)
    data = {}
    expect = []
    (body["fields"] || []).each do |field|
      name = field["name"]
      if true == field["binary"]
        type = body["kind"] == "form" ? nil : (field["media"] || "application/octet-stream")
        data[name] = client.binary.bytes(content(name), { "name" => "/local/dir/#{name}.bin", "type" => type })
        expect << (body["kind"] == "form" ? { "name" => name, "value" => content(name) } :
          { "name" => name, "file" => content(name), "filename" => "#{name}.bin", "type" => type })
      elsif true == field["list"]
        data[name] = ["a", "b c"]
        expect << { "name" => name, "value" => "a".b } << { "name" => name, "value" => "b c".b }
      elsif field["join"].is_a?(String)
        data[name] = ["a", "b"]
        expect << { "name" => name, "value" => ("a" + field["join"] + "b").b }
      else
        data[name] = "v\"#{name}\r\n"
        expect << { "name" => name, "value" => "v\"#{name}\r\n".b }
      end
    end
    [data, expect]
  end

  def self.multipart(arrived)
    type = arrived["headers"]["content-type"].to_s
    boundary = type[/boundary=([^;]+)/, 1]
    raise "no boundary in #{type}" if boundary.nil?
    text = arrived["body"]
    raise "the body does not close" unless text.end_with?("--#{boundary}--\r\n".b)
    text.split("--#{boundary}".b)[1..-2].map do |chunk|
      at = chunk.index("\r\n\r\n".b)
      head = chunk[2...at]
      body = chunk[(at + 4)..-3]
      disp = head.match(/^Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?\r?$/)
      raise "a part without a disposition: #{head.inspect}" if disp.nil?
      ctype = head[/^Content-Type: (.*?)\r?$/, 1]
      disp[2].nil? ? { "name" => disp[1], "value" => body } :
        { "name" => disp[1], "file" => body, "filename" => disp[2], "type" => ctype }
    end
  end

  def self.cases
    out = []
    acc = accessors

    CONFIG["entity"].keys.sort.each do |ename|
      accessor = acc[ename]
      next if accessor.nil?
      ops = CONFIG["entity"][ename]["op"] || {}

      ops.keys.sort.each do |opname|
        (ops[opname]["points"] || []).each do |point|
          action = (point["select"] || {})["$action"]
          label = "#{ename}.#{opname}#{action.nil? ? '' : ':' + action}"
          rb = point["body"] || {}
          rs = point["response"] || {}
          writes = %w[create update patch].include?(opname)

          if %w[form multipart].include?(rb["kind"]) && writes
            out << ["#{label} sends a #{rb['kind']} body", lambda do |t, client|
              data, expect = plan(client, rb)
              @@answer = { "body" => JSON.generate({ "id" => "p1" }) }
              client.public_send(accessor).public_send(opname, params(point).merge(select(point)).merge(data))
              arrived = t.arrived
              names = expect.map { |e| e["name"] }
              if rb["kind"] == "form"
                t.assert_equal rb["media"], arrived["headers"]["content-type"]
                got = URI.decode_www_form(arrived["body"].dup.force_encoding("UTF-8"))
                  .map { |n, v| { "name" => n, "value" => v.b } }
                t.assert_equal expect, got.select { |g| names.include?(g["name"]) }
              else
                t.assert_equal expect, multipart(arrived).select { |g| names.include?(g["name"]) }
              end
            end]
          end

          if rb["kind"] == "raw" && writes
            out << ["#{label} sends a raw #{true == rb['binary'] ? 'binary' : 'text'} body", lambda do |t, client|
              @@answer = { "body" => JSON.generate({ "id" => "p1" }) }
              ent = client.public_send(accessor)
              ent.data_set(params(point))
              ent.match_set(params(point))
              if true == rb["binary"]
                got = handle(ent, action).put(client.binary.bytes(content(label), { "type" => rb["media"] }))
                t.assert_same ent, got
                t.assert_equal content(label), t.arrived["body"]
              else
                ent.public_send(opname, select(point).merge("$body" => "text \"#{label}\"\n"))
                t.assert_equal "text \"#{label}\"\n".b, t.arrived["body"]
              end
              t.assert_equal rb["media"], t.arrived["headers"]["content-type"]
            end]
          end

          if rs["kind"] == "raw" && opname == "load"
            out << ["#{label} reads a raw #{true == rs['binary'] ? 'binary' : 'text'} body", lambda do |t, client|
              ent = client.public_send(accessor)
              ent.data_set(params(point))
              ent.match_set(params(point))
              if true == rs["binary"]
                @@answer = { "type" => rs["media"], "body" => content(label) }
                t.assert_equal content(label), handle(ent, action).bytes
                refused = begin
                  ent.load(params(point).merge(select(point)))
                  nil
                rescue ProjectNameError => e
                  e
                end
                t.assert_equal "binary_sink_required", refused&.code
              else
                @@answer = { "type" => rs["media"], "body" => "café #{label}" }
                t.assert_same ent, ent.load(params(point).merge(select(point)))
                t.assert_equal "café #{label}", ent.data_get["$body"]
              end
            end]
          end
        end
      end
    end
    out
  end

  CASES = cases

  def arrived
    refute_empty @@arrivals, "nothing arrived"
    @@arrivals.last
  end

  def test_this_sdk_has_a_point_to_drive
    refute_empty CASES, "no form, multipart or raw point was found"
  end

  CASES.each_with_index do |(name, run), i|
    define_method("test_codec_#{i.to_s.rjust(3, '0')}_#{name.gsub(/\W+/, '_')}") do
      @@ran += 1
      @@arrivals.clear
      @@answer = {}
      begin
        run.call(self, ProjectNameSDK.new({ "base" => self.class.listener }))
      rescue StandardError, Minitest::Assertion
        @@failed += 1
        raise
      end
    end
  end
end
