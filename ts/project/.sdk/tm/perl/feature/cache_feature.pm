# ProjectName SDK cache feature
#
# Response caching for safe (read) requests, per client: see the features
# reference for the key, the write invalidation and the Cache-Control rules.

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();
use Digest::SHA ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/base_feature.pm"));
require(Cwd::abs_path("$__dir/../utility/media.pm"));

package ProjectNameCacheFeature;

our @ISA = ('ProjectNameBaseFeature');

sub new {
  my ($class) = @_;
  my $self = ProjectNameBaseFeature::new($class);
  $self->{version} = '0.0.1';
  $self->{name} = 'cache';
  # Inactive until init (feature_init only fires init when active).
  $self->{active} = 0;
  $self->{client} = undef;
  $self->{options} = {};
  $self->{store} = {};
  # Perl hashes are unordered: keep an explicit insertion-order list so
  # eviction can drop the oldest entry first.
  $self->{order} = [];
  return $self;
}

sub init {
  my ($self, $ctx, $options) = @_;
  $self->{client} = $ctx->{client};
  $self->{options} = Voxgig::Struct::ismap($options) ? $options : {};
  $self->{active} = ProjectNameHelpers::is_true($self->{options}{active});

  return unless $self->{active};

  $self->{store} = {};
  $self->{order} = [];
  $self->{secret} = _cache_secret();

  my $feature = $self;
  my $utility = $ctx->{utility};
  my $inner = $utility->{fetcher};

  $utility->{fetcher} = sub {
    my ($fctx, $fullurl, $fetchdef) = @_;
    return $feature->through($fctx, $fullurl, $fetchdef, $inner);
  };
  return;
}

sub through {
  my ($self, $ctx, $url, $fetchdef, $inner) = @_;
  my $method = Voxgig::Struct::ismap($fetchdef) && defined $fetchdef->{method}
    ? uc("$fetchdef->{method}") : 'GET';
  my $methods = $self->{options}{methods} || ['GET'];

  unless (grep { uc("$_") eq $method } @$methods) {
    return $inner->($ctx, $url, $fetchdef) if $method eq 'GET' || $method eq 'HEAD';
    my @out;
    my $done = eval { @out = $inner->($ctx, $url, $fetchdef); 1 };
    my $failure = $@;
    $self->_invalidate($url);
    die $failure unless $done;
    return @out;
  }

  my $headers = Voxgig::Struct::ismap($fetchdef) ? $fetchdef->{headers} : undef;
  my $key = "$method $url " . $self->_digest($headers);
  my $now = $self->_now;
  my $hit = $self->{store}{$key};

  if (defined $hit && $hit->{expiry} > $now) {
    $self->_track('hit');
    return ($self->_replay($hit->{snapshot}), undef);
  }

  my ($res, $err) = $inner->($ctx, $url, $fetchdef);

  # A body that declares another type than JSON passes by, unread.
  if (!defined $err && $self->_cacheable($res) && !_json($res)) {
    $self->_track('bypass');
    return ($res, $err);
  }

  if (!defined $err && $self->_cacheable($res)) {
    my $snapshot = $self->_snapshot($res);
    my $ttl = _cache_lifetime($snapshot->{headers},
      defined $self->{options}{ttl} ? $self->{options}{ttl} : 5000);
    if ($ttl <= 0) {
      $self->_track('bypass');
      return ($self->_replay($snapshot), undef);
    }
    $self->_drop($key);
    $self->_evict;
    push @{ $self->{order} }, $key;
    $self->{store}{$key} = {
      'expiry' => $now + $ttl, 'scope' => _cache_scope($url), 'snapshot' => $snapshot };
    $self->_track('miss');
    return ($self->_replay($snapshot), undef);
  }

  $self->_track('bypass');
  return ($res, $err);
}

sub _digest {
  my ($self, $headers) = @_;
  my @pairs;
  if (Voxgig::Struct::ismap($headers)) {
    for my $name (keys %$headers) {
      next unless defined $headers->{$name};
      push @pairs, [lc($name), "$headers->{$name}"];
    }
  }
  my $text = join('', map { "$_->[0]:$_->[1]\n" }
    sort { $a->[0] cmp $b->[0] || $a->[1] cmp $b->[1] } @pairs);
  return Digest::SHA::hmac_sha256_hex($text, $self->{secret});
}

sub _invalidate {
  my ($self, $url) = @_;
  my $path = _cache_scope($url);
  my $collection = _cache_parent($path);
  for my $key (keys %{ $self->{store} }) {
    my $scope = $self->{store}{$key}{scope};
    $self->_drop($key) if _cache_under($scope, $path) || _cache_under($scope, $collection);
  }
  return;
}

sub _drop {
  my ($self, $key) = @_;
  return unless exists $self->{store}{$key};
  delete $self->{store}{$key};
  $self->{order} = [grep { $_ ne $key } @{ $self->{order} }];
  return;
}

# The system's random source where it has one; otherwise Perl's own rand,
# which is not a cryptographic generator.
sub _cache_secret {
  my $bytes = '';
  if (open(my $fh, '<:raw', '/dev/urandom')) {
    read($fh, $bytes, 32);
    close($fh);
  }
  $bytes .= pack('N', int(rand(4294967296))) while length($bytes) < 32;
  return $bytes;
}

# The configured ttl capped by the response's Cache-Control; zero when the
# response may not be stored.
sub _cache_lifetime {
  my ($headers, $ttl) = @_;
  my $control = '';
  for my $name (keys %{ $headers || {} }) {
    $control = lc("$headers->{$name}") if lc($name) eq 'cache-control';
  }
  my $life = $ttl;
  for my $part (split /,/, $control) {
    (my $directive = $part) =~ s/^\s+|\s+$//g;
    return 0 if grep { $_ eq $directive } ('no-store', 'private', 'no-cache');
    if ($directive =~ /^max-age\s*=\s*"?(\d+)"?$/) {
      $life = $1 * 1000 if $1 * 1000 < $life;
    }
  }
  return $life;
}

sub _cache_scope {
  my ($url) = @_;
  my ($scope) = split /[?#]/, "$url", 2;
  $scope = '' unless defined $scope;
  $scope =~ s{/+$}{};
  return $scope;
}

sub _cache_parent {
  my ($scope) = @_;
  my $scheme = index($scope, '://');
  my $root = $scheme < 0 ? 0 : index($scope, '/', $scheme + 3);
  return $scope if $root < 0;
  my $cut = rindex($scope, '/');
  return substr($scope, 0, $cut < $root ? $root : $cut);
}

sub _cache_under {
  my ($scope, $prefix) = @_;
  return $scope eq $prefix || index($scope, "$prefix/") == 0;
}

sub _cacheable {
  my ($self, $res) = @_;
  return 0 unless Voxgig::Struct::ismap($res);
  # A body the transport could not read as JSON passes through, for the operation to report.
  return 0 if $res->{unreadable};
  my $status = $res->{status};
  return 0 unless defined $status && !ref($status)
    && Scalar::Util::looks_like_number($status);
  return ($status >= 200 && $status < 300) ? 1 : 0;
}

sub _json {
  my ($res) = @_;
  my $type = ProjectNameUtilities::header_value($res->{headers}, 'content-type');
  return '' eq $type || ProjectNameUtilities::is_json_media($type);
}

sub _snapshot {
  my ($self, $res) = @_;
  my $data;
  my $jf = $res->{json};
  if (ref $jf eq 'CODE') {
    $data = eval { $jf->() };
  }
  my $headers = Voxgig::Struct::ismap($res->{headers}) ? { %{ $res->{headers} } } : {};
  return {
    'status' => $res->{status},
    'statusText' => $res->{statusText},
    'data' => $data,
    'headers' => $headers,
  };
}

sub _replay {
  my ($self, $snapshot) = @_;
  my $data = $snapshot->{data};
  return {
    'status' => $snapshot->{status},
    'statusText' => $snapshot->{statusText},
    'body' => 'not-used',
    'json' => sub { $data },
    'headers' => Voxgig::Struct::ismap($snapshot->{headers}) ? { %{ $snapshot->{headers} } } : {},
  };
}

sub _evict {
  my ($self) = @_;
  my $max = defined $self->{options}{max} ? $self->{options}{max} : 256;
  while (scalar(keys %{ $self->{store} }) >= $max) {
    my $oldest = shift @{ $self->{order} };
    last unless defined $oldest;
    delete $self->{store}{$oldest};
  }
  return;
}

sub _now {
  my ($self) = @_;
  my $now = $self->{options}{now};
  return $now->() if ref $now eq 'CODE';
  return ProjectNameHelpers::now_ms();
}

sub _track {
  my ($self, $kind) = @_;
  my $track = $self->{client}{_cache};
  if (!$track) {
    $track = { 'hit' => 0, 'miss' => 0, 'bypass' => 0 };
    $self->{client}{_cache} = $track;
  }
  $track->{$kind} += 1;
  return;
}

1;
