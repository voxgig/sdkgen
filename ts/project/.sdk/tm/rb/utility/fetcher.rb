# ProjectName SDK utility: fetcher
require_relative 'struct/voxgig_struct'
require 'net/http'
require 'uri'
require 'json'
require 'zlib'

module ProjectNameUtilities
  # Started Net::HTTP connections keyed by scheme, host, port and proxy,
  # checked out for one request and returned. A Net::HTTP serves one
  # request at a time, so the pool holds idle ones rather than sharing one.
  HTTP_POOL = Hash.new { |h, k| h[k] = [] }
  HTTP_POOL_LOCK = Mutex.new
  HTTP_POOL_IDLE_MAX = 4

  def self.http_checkout(key, uri, proxy)
    http = HTTP_POOL_LOCK.synchronize { HTTP_POOL[key].pop }
    return http if http && http.started?

    if proxy
      purl = URI.parse(proxy)
      http = Net::HTTP.new(uri.host, uri.port, purl.host, purl.port, purl.user, purl.password)
    else
      http = Net::HTTP.new(uri.host, uri.port)
    end
    http.use_ssl = (uri.scheme == "https")
    http.start
  end

  def self.http_checkin(key, http)
    kept = HTTP_POOL_LOCK.synchronize do
      HTTP_POOL[key].size < HTTP_POOL_IDLE_MAX && HTTP_POOL[key].push(http)
    end
    http.finish unless kept
  rescue IOError
    nil
  end

  def self.http_discard(http)
    http.finish if http.started?
  rescue IOError
    nil
  end

  # A compressed body, decoded here rather than by Net::HTTP: its inflater
  # stops at the end of the first gzip member and silently drops the rest of a
  # body sent as several, and it cannot read a raw deflate stream either.
  def self.decode_body(body, encoding)
    return body if body.nil? || body.empty?
    case encoding
    when "gzip", "x-gzip"
      out = "".b
      rest = body.b
      while rest.bytesize > 2 && rest.start_with?("\x1f\x8b".b)
        inflate = Zlib::Inflate.new(32 + Zlib::MAX_WBITS)
        begin
          out << inflate.inflate(rest)
          used = inflate.total_in
        ensure
          inflate.close
        end
        break if used <= 0
        rest = rest.byteslice(used..)
      end
      out
    when "deflate"
      begin
        Zlib::Inflate.inflate(body)
      rescue Zlib::DataError
        inflate = Zlib::Inflate.new(-Zlib::MAX_WBITS)
        begin
          inflate.inflate(body)
        ensure
          inflate.close
        end
      end
    else
      body
    end
  end

  GETONLY_ENV = "VOXGIG_GETONLY_GUARD"

  # A GET-only live run refuses any other method before it is sent. The error
  # names the path alone: the query can carry a credential.
  def self.getonly_refusal(ctx, fullurl, method)
    method = method.to_s.upcase
    method = "GET" if method.empty?
    return nil if ENV[GETONLY_ENV] != "TRUE" || method == "GET"
    rest = fullurl.to_s
    rest = rest.split("://", 2)[1].sub(%r{\A[^/?#]*}, "") if rest.include?("://")
    path = rest[/\A[^?#]*/]
    path = "/" if path.empty?
    ctx.make_error("fetch_getonly_block", "[GET-ONLY GUARD] blocked #{method} #{path}")
  end

  REDIRECT_STATUS = [301, 302, 303, 307, 308].freeze
  REDIRECT_MAX = 5
  CREDENTIAL_HEADERS = %w[authorization cookie proxy-authorization].freeze

  def self.redirect_origin(url)
    uri = URI.parse(url)
    [uri.scheme, uri.host, uri.port]
  end

  # Net::HTTP never follows a redirect. A GET or HEAD follows one, unless the
  # fetch definition says "manual", each hop passing the GET-only guard first;
  # past REDIRECT_MAX hops the last 3xx is the answer. Another origin is not
  # sent the request's credentials.
  def self.follow_redirects(ctx, fullurl, fetchdef)
    method = fetchdef["method"].to_s.upcase
    follow = ["", "GET", "HEAD"].include?(method) && fetchdef["redirect"] != "manual"
    url = fullurl
    hops = 0
    loop do
      refused = getonly_refusal(ctx, url, fetchdef["method"])
      return nil, refused if refused
      res, err = DefaultHttpFetch.call(url, fetchdef)
      location = res.is_a?(Hash) && res["headers"].is_a?(Hash) ? res["headers"]["location"] : nil
      return res, err unless follow && location.is_a?(String) && hops < REDIRECT_MAX &&
        REDIRECT_STATUS.include?(res["status"])
      nxt = begin
        URI.join(url, location.strip).tap { |u| u.fragment = nil }.to_s
      rescue URI::Error
        nil
      end
      return res, err if nxt.nil?
      if redirect_origin(nxt) != redirect_origin(url)
        headers = (fetchdef["headers"] || {}).reject { |k, _| CREDENTIAL_HEADERS.include?(k.to_s.downcase) }
        fetchdef = fetchdef.merge("headers" => headers)
      end
      url = nxt
      hops += 1
    end
  end

  DefaultHttpFetch = ->(fullurl, fetchdef) {
    method_str = fetchdef["method"] || "GET"
    body_str = fetchdef["body"]
    headers = fetchdef["headers"] || {}

    begin
      uri = URI.parse(fullurl)
      proxy = fetchdef["proxy"]
      proxy = nil unless proxy.is_a?(String) && !proxy.empty?
      key = [uri.scheme, uri.host, uri.port, proxy]

      klass = case method_str.upcase
              when "POST" then Net::HTTP::Post
              when "PUT" then Net::HTTP::Put
              when "DELETE" then Net::HTTP::Delete
              when "PATCH" then Net::HTTP::Patch
              else Net::HTTP::Get
              end

      request = klass.new(uri)
      has_ua = false
      headers.each do |k, v|
        next unless v.is_a?(String)
        has_ua = true if k.to_s.downcase == 'user-agent'
        request[k] = v.to_s
      end
      # Default User-Agent — Net::HTTP sets "Ruby" which some CDNs block.
      # Use the project's agent (main.kit.http.useragent, browser-shaped by
      # default) unless the caller already set one, and record it with the
      # headers the request sent.
      unless has_ua
        request['User-Agent'] = 'PROJECTUSERAGENT'
        fetchdef["headers"]['user-agent'] = request['User-Agent'] if fetchdef["headers"].is_a?(Hash)
      end
      if body_str.is_a?(String)
        request.body = body_str
      elsif body_str.respond_to?(:read)
        request.body_stream = body_str
        if body_str.respond_to?(:size)
          request['Content-Length'] = body_str.size.to_s
        else
          request['Transfer-Encoding'] = 'chunked'
        end
      end

      http = ProjectNameUtilities.http_checkout(key, uri, proxy)
      begin
        # Net::HTTP retries idempotent requests; an EOF can follow a committed POST.
        resp = http.request(request) do |r|
          r.decode_content = false
          r.read_body
        end
      rescue StandardError
        ProjectNameUtilities.http_discard(http)
        raise
      end
      ProjectNameUtilities.http_checkin(key, http)

      resp_headers = {}
      resp.each_header { |k, v| resp_headers[k.downcase] = v }

      body = resp.body
      encoding = resp_headers["content-encoding"].to_s.strip.downcase
      if resp_headers["content-range"].nil? && %w[gzip x-gzip deflate identity none].include?(encoding)
        body = ProjectNameUtilities.decode_body(body, encoding)
        resp_headers.delete("content-encoding")
        resp_headers["content-length"] = body.bytesize.to_s if resp_headers.key?("content-length") && body
      end

      json_body = nil
      unreadable = false
      begin
        json_body = JSON.parse(body) if body && !body.strip.empty?
      rescue JSON::ParserError
        unreadable = true
      end

      return {
        "status" => resp.code.to_i,
        "statusText" => resp.message,
        "headers" => resp_headers,
        "json" => -> { json_body },
        "body" => body,
        "unreadable" => unreadable,
      }, nil
    rescue StandardError => e
      # A request that got no answer (DNS, TCP, TLS, a timeout) fails the operation.
      return nil, "#{e.class}: #{e.message}"
    end
  }

  Fetcher = ->(ctx, fullurl, fetchdef) {
    if ctx.client.mode != "live"
      return nil, ctx.make_error("fetch_mode_block",
        "Request blocked by mode: \"#{ctx.client.mode}\" (URL was: \"#{fullurl}\")")
    end

    options = ctx.client.options_map
    if VoxgigStruct.getpath(options, "feature.test.active") == true
      return nil, ctx.make_error("fetch_test_block",
        "Request blocked as test feature is active (URL was: \"#{fullurl}\")")
    end

    sys_fetch = VoxgigStruct.getpath(options, "system.fetch")

    return ProjectNameUtilities.follow_redirects(ctx, fullurl, fetchdef) if sys_fetch.nil?
    return sys_fetch.call(fullurl, fetchdef) if sys_fetch.is_a?(Proc)

    return nil, ctx.make_error("fetch_invalid", "system.fetch is not a valid function")
  }
end
