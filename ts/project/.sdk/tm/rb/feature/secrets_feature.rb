# ProjectName SDK secrets feature
#
# Secret access via a vendored voxgig_sekreto provider chain, and the
# access-token exchange some APIs require on top of it. The ruby port of
# tm/ts/src/feature/secrets/SecretsFeature.ts - same contract, ruby idiom,
# and structurally go's (tm/go/feature/secrets_feature.go), for the reason
# spelled out under RESOLUTION LIVES AT THE TRANSPORT below.
#
# The SDK's `apikey` option keeps exactly its old meaning: an explicit
# credential given in code. This feature makes it ONE SOURCE among several
# rather than the only one: when active, the apikey is resolved through a
# sekreto chain in which the explicit option (when set) is the FIRST
# provider - a `memory` store named 'options' - so an explicit value always
# wins, by sekreto's own first-hit rule rather than by special-case logic.
# When the option is unset, the remaining providers (env, dotenv, a vault)
# are asked in order, and moving a credential from code to a vault becomes
# a configuration change.
#
# RESOLUTION LIVES AT THE TRANSPORT, not in the PreSpec hook. `direct()`
# and `graphql()` reach the wire through ProjectNameSDK#raw_request, which
# runs NO feature hooks at all - so a hook-only design would leave the raw
# paths silently unauthenticated, and would have no way to refuse them when
# the chain is broken. The transport is the ONE seam every wire path
# crosses (utility/make_request.rb and Main's raw_request both call
# `utility.fetcher`), so the wrapper installed in `init` resolves there,
# rewrites the credential header prepare_auth built, and refuses the
# request outright when a provider errors.
#
# MISS vs ERROR (sekreto's invariant): a provider MISS falls through - the
# op proceeds, unauthenticated if nothing else supplies a credential. A
# provider ERROR (unreachable vault, bad credentials) must FAIL the op: a
# broken vault never degrades into an unauthenticated request. The wrapper
# answers `[nil, ctx.make_error("secrets_provider", ...)]`, which the
# entity pipeline turns into a raised ProjectNameError and the raw paths
# report as `{ "ok" => false, "err" => ... }`.
#
# EXCHANGE: some APIs will not take a long-lived credential at all. What
# the chain resolves is then a REFRESH token, which buys a short-lived
# ACCESS token from a token endpoint (`exchange.path`, relative to
# options.base); the access token is what every request carries, and when a
# response status in `exchange.statuses` (401) says it is spent the wrapper
# buys another and retries the same request once. Test mode buys nothing
# and answers with a deterministic fake token.
#
# THREADS: ruby has real ones. The resolved credential, the in-flight
# resolution and the in-flight purchase are each guarded, and the state
# mutex is always the innermost lock so the three can never deadlock.

require 'json'
require 'uri'

require_relative 'base_feature'
require_relative '../utility/struct/voxgig_struct'
require_relative '../utility/fetcher'
require_relative 'secrets/voxgig_sekreto'

class ProjectNameSecretsFeature < ProjectNameBaseFeature
  REDIRECT_MAX = 5

  # Where a method-keeping redirect points, when that is on the exchange's
  # own origin. Any other redirect would drop the body or leave the origin.
  def self.moved(url, at, res)
    return nil unless res.is_a?(Hash) && [307, 308].include?(res["status"].to_i)
    headers = res["headers"]
    location = headers.is_a?(Hash) ? headers["location"] : nil
    return nil unless location.is_a?(String) && !location.empty?
    nxt = URI.join(at, location)
    here = URI.parse(url)
    origin = ->(u) { [u.scheme.to_s.downcase, u.host.to_s.downcase, u.port] }
    origin.call(nxt) == origin.call(here) ? nxt.to_s : nil
  rescue URI::Error, ArgumentError
    nil
  end

  def initialize
    super
    @version = "0.1.0"
    @name = "secrets"
    # Inactive until init (feature_init only fires init when active).
    @active = false

    @client = nil
    @options = {}
    @liveopts = {}
    @declared = false
    @basic = false

    @secretname = "apikey"
    @cache = true
    @sekreto = nil
    @initerr = nil

    # Exchange state: nil config when off, so every later decision is a nil
    # check; `@refresh` is the credential the chain resolved.
    @exchange = nil
    @refresh = nil

    # The RESOLVED credential, held in FEATURE STATE and injected into each
    # request at the transport seam. It is also PUBLISHED to the live
    # options map (`@lastset` remembers what this feature wrote, so a
    # retraction only ever withdraws its own write) because prepare_auth is
    # synchronous and reads the options - so `sdk.prepare(...)` and any
    # options-reading consumer agree with what goes on the wire.
    @cred = ""
    @lastset = nil
    @resolved = false

    # The root context, for registering what this feature resolves.
    @ctx = nil

    @statelock = Mutex.new
    @resolvelock = Mutex.new
    @buylock = Mutex.new
  end

  # Sync by feature contract: build the chain, never look anything up here.
  def init(ctx, options)
    @client = ctx.client
    @ctx = ctx
    @options = options.is_a?(Hash) ? options : {}
    @liveopts = ctx.options.is_a?(Hash) ? ctx.options : {}
    @active = @options["active"] == true

    # What prepare_auth was generated from: the config declares auth only
    # where it places a credential, and Basic only where it composes one.
    declared = VoxgigStruct.getpath(ctx.config, "options.auth")
    @declared = declared.is_a?(Hash)
    @basic = @declared && declared["basic"] == true

    return unless @active

    @secretname = _str(@options["name"], "apikey")
    @cache = @options["cache"] != false

    # The publication slot. Seeded here, single-threaded, so that later
    # writes only ever REPLACE a key that already exists - a hash whose
    # keys never change is safe to write while another thread clones it.
    @liveopts["apikey"] = "" unless @liveopts.key?("apikey")

    xopts = @options["exchange"]
    xopts = {} unless xopts.is_a?(Hash)

    # Exchange config, normalised once.
    if xopts["active"] == true
      statuses = xopts["statuses"].is_a?(Array) ?
        xopts["statuses"].select { |s| s.is_a?(Numeric) }.map(&:to_i) : []
      statuses = [401] if statuses.empty?
      @exchange = {
        "path" => _str(xopts["path"], "auth/token"),
        "method" => _str(xopts["method"], "POST"),
        "request" => _str(xopts["request"], "refresh_token"),
        "response" => _str(xopts["response"], "access_token"),
        "statuses" => statuses,
        "retries" => xopts["retries"].is_a?(Numeric) ? xopts["retries"].to_i : 1,
        "redirect" => "same-origin" == xopts["redirect"] ? "same-origin" : "refuse",
      }
    end

    # The explicit credential, when set, is the first store in the chain.
    #
    # WHICH option that is depends on the exchange. Without one, the secret
    # being resolved IS the credential the transport sends, so `apikey` is
    # it. With one, the secret is a REFRESH token and `apikey` means the
    # opposite thing - an access token the caller already holds - so the
    # explicit seat belongs to `exchange.refresh`, and apikey is left alone
    # to serve as the starting access token (see _resolve_once).
    explicit = @exchange.nil? ? @liveopts["apikey"] : xopts["refresh"]

    begin
      specs = []

      if explicit.is_a?(String) && !explicit.empty?
        _register(explicit)
        specs << {
          "kind" => "memory",
          "name" => "options",
          "values" => { VoxgigSekreto.envkey(@secretname) => explicit },
        }
      end

      providers = @options["providers"]
      specs.concat(providers) if providers.is_a?(Array)

      @sekreto = VoxgigSekreto::Sekreto.new(
        "providers" => specs,
        "plugins" => _plugins,
        "cache" => @cache,
      )
    rescue StandardError => e
      # A misconfigured chain must not degrade into unauthenticated
      # requests: remember the failure and let the transport gate below
      # refuse every send. (init cannot raise - the constructor would take
      # the whole client down for a fault the caller can only see at
      # request time anyway.)
      @initerr = e
      @sekreto = nil
    end

    # Wrap the transport UNCONDITIONALLY while active - including after an
    # init failure, which is exactly when the gate matters most. The
    # exchange additionally needs to SEE responses (a spent token is only
    # ever discovered from one), and this is the one place a response can
    # be seen and the request tried again.
    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      feature.transport(fctx, fullurl, fetchdef, inner)
    }
  end

  # The LIVE Sekreto instance, for callers who want arbitrary secrets or
  # redaction:
  #
  #   sdk.features.find { |f| f.get_name == "secrets" }.sekreto.get('db.password')
  #
  # Never a clone: sekreto holds provider state (caches, vault leases) that
  # has to stay live to be worth anything.
  def sekreto
    @sekreto
  end

  # The resolved credential (empty when none) - the state the transport
  # injects. Tests and callers read it here rather than inferring it.
  def credential
    @statelock.synchronize { @cred }
  end

  # transport wraps whatever transport was current at init.
  def transport(ctx, url, fetchdef, inner)
    # Fail-closed, at the ONE seam every wire path crosses. Entity ops,
    # direct, graphql and the exchange retries all come through here, so
    # resolving HERE is what gives the raw paths - which run no feature
    # hooks at all - the same credential the entity pipeline gets. A
    # provider ERROR refuses the request with the provider's own message;
    # never an unauthenticated send.
    err = resolve
    return nil, err if err.is_a?(ProjectNameError)
    unless err.nil?
      return nil, ctx.make_error("secrets_provider", err.to_s)
    end

    # Inject the resolved credential into THIS request's header, the way
    # prepare_auth built it, from the same options.auth.prefix so the two
    # cannot drift. An EMPTY credential removes the header: with the
    # feature active the chain is the authority, and an uncached miss after
    # an earlier hit (a revoked secret) must stop transmitting the value
    # prepare_auth put there from this feature's own earlier publication.
    _inject(fetchdef, credential)

    return inner.call(ctx, url, fetchdef) if @exchange.nil?

    _with_refresh(ctx, url, fetchdef, inner)
  end

  # One resolution, shared by every concurrent caller. A settled HIT is
  # kept only when caching is on (`cache: false` means every request asks
  # the chain again); a FAILURE is never cached, so a transient vault
  # outage does not poison the client after the vault recovers.
  #
  # A MISS is not kept either, however caching is set. That rule is
  # sekreto's, not this feature's: `A miss is never cached: the next read
  # asks again`, in sekreto's own source. Keeping a settled miss here would
  # override that from the layer above, and a secret provisioned after
  # startup - a mounted file, a policy granted a minute late - would never
  # be picked up for the life of the client. `cache` is about caching a
  # HIT; it was never a promise to keep saying no.
  #
  # Answers the error rather than raising it: the caller is the transport
  # gate, whose contract is a [value, err] pair.
  def resolve
    return @initerr unless @initerr.nil?

    @resolvelock.synchronize do
      return nil if @resolved

      begin
        hit = _resolve_once
      rescue StandardError => e
        return e
      end

      @resolved = true if @cache && hit
      nil
    end
  end

  private

  # prepare_auth's decision: auth the config declares, not suppressed by
  # `auth: nil`.
  def _authon
    @declared && !@liveopts["auth"].nil?
  end

  # Every value this feature resolves or buys is a secret the SDK handles,
  # and none arrives under an option key the intake registration saw.
  def _register(value)
    ctx = @ctx
    return if ctx.nil? || ctx.utility.nil? || !ctx.utility.respond_to?(:clean_add)
    add = ctx.utility.clean_add
    add.call(ctx, value) if add.respond_to?(:call)
  end

  # Resolve once, answering whether a credential came out of it. That
  # boolean is the whole of what resolve needs to tell a cacheable HIT from
  # a miss it must not keep.
  def _resolve_once
    return false if @sekreto.nil? || !_authon

    # Miss-vs-error: `try` answers nil for "no store has it" and RAISES for
    # "a store could not answer" - only the miss falls through.
    found = @sekreto.try(@secretname)
    found = nil unless found.is_a?(String)
    _register(found)

    if @exchange.nil?
      # An UNCACHED miss after an earlier hit is a revocation: the chain
      # now says no provider has the secret, so the resolved value must not
      # keep going out on the wire. (An explicit apikey OPTION is never
      # lost here - it seats FIRST in the chain as a memory provider, so
      # the chain HITS while one is set and the miss branch is
      # unreachable.)
      _setcred(found)
      return !found.nil?
    end

    # Exchanging: what the chain resolved is the REFRESH token, kept for
    # every later purchase. A miss is not fatal here - an explicit `apikey`
    # may already hold a usable access token, and the API is what gets to
    # say whether it does.
    @refresh = found

    apikey = credential
    if apikey.nil? || apikey.empty?
      starting = @liveopts["apikey"]
      apikey = starting.is_a?(String) ? starting : ""
      _setcred(apikey) unless apikey.empty?
    end

    # A starting access token was supplied. Spend it: if it is stale the
    # API answers with an expiry status and the wrapper buys another, which
    # is the same path expiry takes anyway.
    return true unless apikey.nil? || apikey.empty?

    _buy

    true
  end

  # Buy a token and try the request again when the API says the current one
  # is spent.
  #
  # The retry rewrites the credential header IN PLACE on the fetchdef,
  # because the header was built by the synchronous prepare_auth before
  # this request left, and it carries the token that just failed.
  def _with_refresh(ctx, url, fetchdef, inner)
    # A refusal of an unauthenticated request is not an expired token, and
    # retrying would transmit the credential that auth off withholds.
    return inner.call(ctx, url, fetchdef) unless _authon

    max = @exchange["retries"]
    attempt = 0

    loop do
      # The credential THIS attempt goes out with, captured before it
      # leaves: it is what tells a stale refusal apart from a fresh one.
      used = credential

      res, err = inner.call(ctx, url, fetchdef)

      return res, err if !err.nil? || attempt >= max || !_spent(res)

      # Another request may have bought a token while this one was in
      # flight. Concurrent expiries share the in-flight purchase, but
      # STAGGERED ones do not - so spend what is current before buying: a
      # second exchange for a token that is already fresh is wasted, and on
      # a provider that invalidates the previous credential on issuance it
      # breaks the first request's own retry.
      current = credential

      if !current.nil? && !current.empty? && current != used
        token = current
      else
        begin
          token = _buy
        rescue StandardError
          # The purchase failed: answer with the API's own refusal rather
          # than this one. The caller asked for data, and the 401 is the
          # more useful of the two - the exchange error is a symptom.
          return res, err
        end
      end

      _inject(fetchdef, token)

      attempt += 1
    end
  end

  def _spent(res)
    return false unless res.is_a?(Hash)
    status = res["status"]
    return false unless status.is_a?(Numeric)
    @exchange["statuses"].include?(status.to_i)
  end

  # Buy an access token with the refresh token. Concurrent callers
  # serialise on @buylock, and a caller that finds the credential already
  # replaced while it waited takes that one rather than buying a second.
  def _buy
    # TEST MODE BUYS NOTHING.
    #
    # The test feature replaces the transport so that no request leaves the
    # process; an exchange here would be the one HTTP call it could not
    # stop, and it would need a live token endpoint for a suite whose whole
    # point is not needing one. A deterministic, obviously-fake token
    # instead - the same answer make_options gives a required server
    # variable, for the same reason.
    if @client.mode != "live"
      token = "test-" + @exchange["response"]
      _setcred(token)
      return token
    end

    before = credential

    @buylock.synchronize do
      current = credential
      if !current.nil? && !current.empty? && current != before
        # Someone else bought while we waited.
        return current
      end

      token = _buy_once
      _setcred(token)
      token
    end
  end

  def _buy_once
    x = @exchange

    if @refresh.nil? || @refresh.empty?
      raise VoxgigSekreto::SekretoError,
        "secrets: no refresh token: the provider chain has no '#{@secretname}'," \
        " and feature.secrets.exchange.refresh is unset"
    end

    options = @client.options_map

    # The token endpoint is RELATIVE to the base, which already carries
    # whatever account or tenant segment the server URL declares.
    base = options["base"].is_a?(String) ? options["base"] : ""
    url = base.sub(%r{/+\z}, "") + "/" + x["path"].sub(%r{\A/+}, "")

    # The SDK's own transport, beneath every feature's wrapper: it holds the
    # test feature's block and the GET-only guard, and the wrapped one would
    # recurse on the first expiry.
    fetch = ->(at, fd) { ProjectNameUtilities::Fetcher.call(@ctx, at, fd) }

    # The body is MARSHALLED, never concatenated: a refresh token (or a
    # configured request-field name) carrying a quote, backslash or newline
    # must arrive as that literal value, not as malformed JSON.
    fetchdef = {
      "method" => x["method"],
      "headers" => { "content-type" => "application/json" },
      "body" => JSON.generate({ x["request"] => @refresh }),
      # Never followed by the client: a redirect would carry the refresh token on.
      "redirect" => "manual",
      # Its own bound, in milliseconds: the timeout feature's wrapper is above.
      "timeout" => 30_000,
    }

    res, err = fetch.call(url, fetchdef)

    # By option alone, and only while the exchange stays on its own origin.
    at = url
    hops = 0
    while err.nil? && "same-origin" == x["redirect"] && hops < REDIRECT_MAX
      nxt = ProjectNameSecretsFeature.moved(url, at, res)
      break if nxt.nil?
      at = nxt
      hops += 1
      res, err = fetch.call(at, fetchdef)
    end

    raise err if err.is_a?(ProjectNameError)
    unless err.nil?
      raise VoxgigSekreto::SekretoError,
        "secrets: token exchange failed: #{err} from #{url}"
    end

    status = res.is_a?(Hash) ? res["status"].to_i : 0

    if 200 > status || 300 <= status
      raise VoxgigSekreto::SekretoError,
        "secrets: token exchange failed: #{status} from #{url}"
    end

    jf = res["json"]
    body = jf.is_a?(Proc) ? jf.call : res["body"]
    if body.is_a?(String)
      begin
        body = JSON.parse(body)
      rescue StandardError
        body = nil
      end
    end

    token = body.is_a?(Hash) ? body[x["response"]] : nil

    unless token.is_a?(String) && !token.empty?
      raise VoxgigSekreto::SekretoError,
        "secrets: token exchange returned no '#{x['response']}' field from #{url}"
    end

    _register(token)

    token
  end

  # Write the resolved credential to feature state AND publish it to the
  # live options map, where the synchronous prepare_auth already looks.
  # An empty value RETRACTS - but only this feature's own write, so a
  # caller's explicit apikey is never withdrawn.
  def _setcred(value)
    value = "" unless value.is_a?(String)

    @statelock.synchronize do
      @cred = value

      next unless @liveopts.is_a?(Hash)

      if value.empty?
        @liveopts["apikey"] = "" if @liveopts["apikey"] == @lastset
        @lastset = nil
      else
        @liveopts["apikey"] = value
        @lastset = value
      end
    end
  end

  # Rebuild the credential header from the credential, exactly as
  # prepare_auth builds it.
  def _inject(fetchdef, token)
    return unless fetchdef.is_a?(Hash)
    headers = fetchdef["headers"]
    return unless headers.is_a?(Hash)

    # The header prepare_auth writes: auth.name, lower-cased.
    name = VoxgigStruct.getpath(@liveopts, "auth.name")
    name = name.is_a?(String) && !name.empty? ? name.downcase : "authorization"

    # Suppressed auth means NO header, the same answer prepare_auth gives.
    if !_authon || token.nil? || token.empty?
      headers.delete(name)
      return
    end

    value = @basic && VoxgigStruct.getpath(@liveopts, "auth.basic") == true ? _pair(token) : token

    prefix = VoxgigStruct.getpath(@liveopts, "auth.prefix")
    prefix = "" unless prefix.is_a?(String)

    # Empty prefix (raw apiKey credential) must not add a leading space.
    headers[name] = prefix.empty? ? value : "#{prefix} #{value}"
  end

  # Under Basic the token is the key half, as apikey is: prepare_auth's pair.
  def _pair(token)
    secret = @liveopts["secret"]
    pair = ["#{token}:#{secret.is_a?(String) ? secret : ""}"].pack("m0")
    _register(pair)
    pair
  end

  # The plugin DEFINITIONS the model selected for this feature, emitted by
  # config generically from the catalogue's active `plugin.def` entries.
  # Upstream sekreto's contract since the registry was retired: a kind not
  # passed in `plugins` is unknown to this Sekreto, so the model's choice of
  # plugin groups IS the SDK's provider vocabulary.
  #
  # Read LAZILY, here rather than at file scope: config.rb requires
  # features.rb, so a top-level reference would close a require cycle.
  def _plugins
    return [] unless Object.const_defined?(:ProjectNameConfig)
    config = Object.const_get(:ProjectNameConfig)
    return [] unless config.const_defined?(:FEATURE_PLUGINS)
    plugs = config.const_get(:FEATURE_PLUGINS)[@name]
    plugs.is_a?(Array) ? plugs : []
  end

  def _str(value, dflt)
    value.is_a?(String) && !value.empty? ? value : dflt
  end
end
