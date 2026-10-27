# ProjectName SDK utility: fetcher

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use HTTP::Tiny ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/../core/error.pm"));

package ProjectNameUtilities;

our %REGISTRY;

# One HTTP::Tiny per (proxy, redirect) setting: a client keeps its
# connection alive between requests, so one per request reused nothing.
my %HTTP_CLIENTS;

sub _http_client {
  my (%new_args) = @_;
  my $key = join "\n", map { "$_=$new_args{$_}" } sort keys %new_args;
  return $HTTP_CLIENTS{$key} //= HTTP::Tiny->new(%new_args);
}

our $GETONLY_ENV = 'VOXGIG_GETONLY_GUARD';

# A GET-only live run refuses any other method before it is sent. The error
# names the path alone: the query can carry a credential.
sub getonly_refusal {
  my ($fullurl, $method) = @_;
  return undef if ($ENV{$GETONLY_ENV} // '') ne 'TRUE' || 'GET' eq $method;
  my $rest = "$fullurl";
  $rest =~ s{\A[^:/?#]*://[^/?#]*}{};
  my ($path) = $rest =~ m{\A([^?#]*)};
  $path = '/' if '' eq $path;
  return ProjectNameError->new('fetch_getonly_block',
    "[GET-ONLY GUARD] blocked $method $path");
}

our @REDIRECT_STATUS = (301, 302, 303, 307, 308);
our $REDIRECT_MAX = 5;

# The Location resolved against the URL that answered with it (RFC 3986 5.2).
sub resolve_location {
  my ($base, $loc) = @_;
  $loc =~ s/\s+//g;
  $loc =~ s/#.*//s;
  return $loc if $loc =~ m{\A[A-Za-z][A-Za-z0-9+.-]*:};
  my ($scheme, $auth, $path, $query) = $base =~ m{\A([^:/?#]+):(?://([^/?#]*))?([^?#]*)(\?[^#]*)?};
  return undef unless defined $scheme;
  return "$scheme:$loc" if $loc =~ m{\A//};
  $path = '/' if '' eq $path;
  my ($lpath, $lquery) = $loc =~ m{\A([^?]*)(\?.*)?\z}s;
  if ('' eq $lpath) {
    $lpath = $path;
    $lquery = $query unless defined $lquery;
  }
  elsif ($lpath !~ m{\A/}) {
    (my $dir = $path) =~ s{[^/]*\z}{};
    $lpath = $dir . $lpath;
  }
  my @out;
  for my $seg (split m{/}, $lpath, -1) {
    if ('..' eq $seg) { pop @out if 1 < @out; }
    elsif ('.' ne $seg) { push @out, $seg; }
  }
  push @out, '' if $lpath =~ m{(?:\A|/)\.\.?\z};
  return "$scheme://" . ($auth // '') . join('/', @out) . ($lquery // '');
}

sub _origin {
  my ($url) = @_;
  my ($scheme, $host, $port) = lc($url) =~ m{\A([^:/?#]+)://(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)(?::(\d+))?};
  return join ':', $scheme // '', $host // '', $port // ('https' eq ($scheme // '') ? 443 : 80);
}

# HTTP::Tiny cannot resolve a relative-path Location, so it follows none here.
# A GET or HEAD follows a redirect, unless the fetch definition says "manual",
# each hop passing the GET-only guard first; past $REDIRECT_MAX hops the last
# 3xx is the answer. Another origin is not sent the request's credentials.
our $DefaultHttpFetch = sub {
  my ($fullurl, $fetchdef) = @_;
  $fetchdef = {} unless defined $fetchdef;

  my $method = uc(defined $fetchdef->{method} ? "$fetchdef->{method}" : 'GET');
  my $follow = ($method eq 'GET' || $method eq 'HEAD')
    && !(defined $fetchdef->{redirect} && !ref $fetchdef->{redirect} && 'manual' eq $fetchdef->{redirect});
  my $url = $fullurl;
  for (my $hops = 0; ; $hops++) {
    my $refused = getonly_refusal($url, $method);
    return (undef, $refused) if $refused;
    my ($res, $err) = _send_once($url, $fetchdef, $method);
    my $location = $res ? $res->{headers}{location} : undef;
    my $next = $follow && defined $location && !ref $location && $hops < $REDIRECT_MAX
      && (grep { $_ == $res->{status} } @REDIRECT_STATUS) ? resolve_location($url, $location) : undef;
    return ($res, $err) unless defined $next;
    if (_origin($next) ne _origin($url)) {
      my $headers = Voxgig::Struct::ismap($fetchdef->{headers}) ? $fetchdef->{headers} : {};
      $fetchdef = { %$fetchdef, headers => { map { $_ => $headers->{$_} }
        grep { lc($_) !~ /\A(?:authorization|cookie|proxy-authorization)\z/ } keys %$headers } };
    }
    $url = $next;
  }
};

sub _send_once {
  my ($fullurl, $fetchdef, $method) = @_;
  my $body = $fetchdef->{body};
  my $headers = Voxgig::Struct::ismap($fetchdef->{headers}) ? $fetchdef->{headers} : {};

  my %hdrs;
  my $has_ua = 0;
  for my $k (keys %$headers) {
    my $v = $headers->{$k};
    next unless defined $v && !ref $v;
    $has_ua = 1 if lc("$k") eq 'user-agent';
    $hdrs{$k} = "$v";
  }
  # Default User-Agent - some CDNs block library defaults. Use a
  # Mozilla-shaped UA unless the caller already set one, and record it with
  # the headers the request sent.
  unless ($has_ua) {
    $hdrs{'User-Agent'} = 'Mozilla/5.0 (compatible; ProjectNameSDK/1.0)';
    $headers->{'user-agent'} = $hdrs{'User-Agent'};
  }

  # HTTP::Tiny sends bytes: a character string goes out as UTF-8, and a
  # filehandle is read.
  if (ref $body eq 'GLOB' || (Scalar::Util::blessed($body) && $body->can('read'))) {
    local $/;
    my $fh = $body;
    $body = <$fh>;
  }
  my $opts = { headers => \%hdrs };
  if (defined $body && !ref $body) {
    my $content = "$body";
    utf8::encode($content) if utf8::is_utf8($content);
    $opts->{content} = $content;
  }

  my %new_args = (max_redirect => 0);
  # Both keys: HTTP::Tiny lets the environment override its generic proxy.
  $new_args{http_proxy} = $new_args{https_proxy} = "$fetchdef->{proxy}"
    if defined $fetchdef->{proxy} && !ref $fetchdef->{proxy}
      && length $fetchdef->{proxy};

  # A request that got no answer fails the operation.
  my $res = eval { _http_client(%new_args)->request($method, $fullurl, $opts) };
  if (!$res) {
    my $e = (defined $@ && length $@) ? "$@" : 'request failed';
    $e =~ s/\s+\z//;
    return (undef, $e);
  }

  # HTTP::Tiny reports a network failure (DNS, TCP, TLS, a timeout) as a
  # synthesized 599 carrying the error text.
  if (599 == ($res->{status} || 0) && !$res->{success}) {
    my $reason = (defined $res->{content} && length $res->{content})
      ? "$res->{content}" : 'network error';
    $reason =~ s/\s+\z//;
    return (undef, $reason);
  }

  my $resp_headers = {};
  my $rh = $res->{headers} || {};
  for my $k (keys %$rh) {
    my $v = $rh->{$k};
    $v = join(', ', @$v) if ref $v eq 'ARRAY';
    $resp_headers->{lc "$k"} = $v;
  }

  my $json_body;
  my $unreadable = 0;
  if (defined $res->{content} && $res->{content} =~ /\S/) {
    my $parsed = eval { $json_body = Voxgig::Struct::parse_json($res->{content}); 1 };
    $unreadable = 1 unless $parsed;
  }
  my $captured = $json_body;

  return ({
    'status' => int($res->{status} || 0),
    'statusText' => (defined $res->{reason} ? "$res->{reason}" : ''),
    'headers' => $resp_headers,
    'json' => sub { $captured },
    'body' => $res->{content},
    'unreadable' => $unreadable,
  }, undef);
}

$REGISTRY{fetcher} = sub {
  my ($ctx, $fullurl, $fetchdef) = @_;

  my $mode = $ctx->{client}{mode};
  $mode = '' unless defined $mode;
  if ('live' ne $mode) {
    return (undef, $ctx->make_error('fetch_mode_block',
      "Request blocked by mode: \"$mode\" (URL was: \"$fullurl\")"));
  }

  my $options = $ctx->{client}->options_map;
  if (ProjectNameHelpers::is_true(ProjectNameHelpers::gpath($options, 'feature.test.active'))) {
    return (undef, $ctx->make_error('fetch_test_block',
      "Request blocked as test feature is active (URL was: \"$fullurl\")"));
  }

  my $sys_fetch = ProjectNameHelpers::gpath($options, 'system.fetch');

  return $DefaultHttpFetch->($fullurl, $fetchdef) if !defined $sys_fetch;
  return $sys_fetch->($fullurl, $fetchdef) if ref $sys_fetch eq 'CODE';

  return (undef, $ctx->make_error('fetch_invalid', 'system.fetch is not a valid function'));
};

1;
