# ProjectName SDK cache feature
#
# Response caching for safe (read) requests, per client: see the features
# reference for the key, the write invalidation and the Cache-Control rules.

require 'openssl'
require 'securerandom'

require_relative 'base_feature'
require_relative '../utility/media'

class ProjectNameCacheFeature < ProjectNameBaseFeature
  SAFE_METHODS = ["GET", "HEAD"].freeze
  UNSTORED = ["no-store", "private", "no-cache"].freeze
  MAX_AGE = /\Amax-age\s*=\s*"?(\d+)"?\z/

  def initialize
    super
    @version = "0.0.1"
    @name = "cache"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @store = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    return unless @active

    @store = {}
    @secret = SecureRandom.random_bytes(32)

    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      feature.through(fctx, fullurl, fetchdef, inner)
    }
  end

  def through(ctx, url, fetchdef, inner)
    method = ((fetchdef.is_a?(Hash) && fetchdef["method"]) || "GET").to_s.upcase
    methods = @options["methods"] || ["GET"]

    unless methods.include?(method)
      return inner.call(ctx, url, fetchdef) if SAFE_METHODS.include?(method)
      begin
        return inner.call(ctx, url, fetchdef)
      ensure
        _invalidate(url)
      end
    end

    headers = fetchdef.is_a?(Hash) ? fetchdef["headers"] : nil
    key = "#{method} #{url} #{_digest(headers)}"
    now = _now
    hit = @store[key]

    if !hit.nil? && hit["expiry"] > now
      _track("hit")
      return _replay(hit["snapshot"]), nil
    end

    res, err = inner.call(ctx, url, fetchdef)

    # A body that declares another type than JSON passes by, unread.
    if err.nil? && _cacheable(res) && !_json(res)
      _track("bypass")
      return res, err
    end

    if err.nil? && _cacheable(res)
      snapshot = _snapshot(res)
      ttl = self.class.lifetime(snapshot["headers"], @options["ttl"].nil? ? 5000 : @options["ttl"])
      if ttl <= 0
        _track("bypass")
        return _replay(snapshot), nil
      end
      @store.delete(key)
      _evict
      @store[key] = { "expiry" => now + ttl, "scope" => self.class.scope(url), "snapshot" => snapshot }
      _track("miss")
      return _replay(snapshot), nil
    end

    _track("bypass")
    return res, err
  end

  def _digest(headers)
    pairs = []
    if headers.is_a?(Hash)
      headers.each { |k, v| pairs << [k.to_s.downcase, v.to_s] unless v.nil? }
    end
    text = pairs.sort.map { |k, v| "#{k}:#{v}\n" }.join
    OpenSSL::HMAC.hexdigest("SHA256", @secret, text)
  end

  def _invalidate(url)
    path = self.class.scope(url)
    collection = self.class.parent(path)
    @store.delete_if do |_k, e|
      self.class.under(e["scope"], path) || self.class.under(e["scope"], collection)
    end
  end

  # The configured ttl capped by the response's Cache-Control; zero when the
  # response may not be stored.
  def self.lifetime(headers, ttl)
    control = ""
    (headers || {}).each { |k, v| control = v.to_s if k.to_s.downcase == "cache-control" }
    life = ttl
    control.downcase.split(",").each do |part|
      directive = part.strip
      return 0 if UNSTORED.include?(directive)
      age = MAX_AGE.match(directive)
      life = [life, age[1].to_i * 1000].min unless age.nil?
    end
    life
  end

  def self.scope(url)
    url.to_s.split(/[?#]/, 2).first.to_s.sub(%r{/+\z}, "")
  end

  def self.parent(scope)
    scheme = scope.index("://")
    root = scheme.nil? ? 0 : scope.index("/", scheme + 3)
    return scope if root.nil?
    cut = scope.rindex("/") || 0
    scope[0, [cut, root].max]
  end

  def self.under(scope, prefix)
    scope == prefix || scope.start_with?(prefix + "/")
  end

  # A body the transport could not read as JSON passes through, for the operation to report.
  def _cacheable(res)
    return false unless res.is_a?(Hash)
    return false if true == res["unreadable"]
    status = res["status"]
    status.is_a?(Numeric) && status >= 200 && status < 300
  end

  def _json(res)
    type = ProjectNameUtilities.header_value(res["headers"], "content-type")
    type.empty? || ProjectNameUtilities.json_media?(type)
  end

  def _snapshot(res)
    data = nil
    jf = res["json"]
    if jf.is_a?(Proc)
      begin
        data = jf.call
      rescue StandardError
        data = nil
      end
    end
    headers = res["headers"].is_a?(Hash) ? res["headers"].dup : {}
    {
      "status" => res["status"],
      "statusText" => res["statusText"],
      "data" => data,
      "headers" => headers,
    }
  end

  def _replay(snapshot)
    data = snapshot["data"]
    {
      "status" => snapshot["status"],
      "statusText" => snapshot["statusText"],
      "body" => "not-used",
      "json" => -> { data },
      "headers" => snapshot["headers"].is_a?(Hash) ? snapshot["headers"].dup : {},
    }
  end

  def _evict
    # Ruby hashes preserve insertion order, so the first key is the oldest.
    max = @options["max"].nil? ? 256 : @options["max"]
    while @store.size >= max
      oldest = @store.keys.first
      break if oldest.nil?
      @store.delete(oldest)
    end
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
  end

  def _track(kind)
    track = @client.instance_variable_get(:@_cache)
    if track.nil?
      track = { "hit" => 0, "miss" => 0, "bypass" => 0 }
      @client.instance_variable_set(:@_cache, track)
    end
    track[kind] += 1
  end
end
