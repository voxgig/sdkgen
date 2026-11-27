# ProjectName SDK body codec: raw

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../binary.pm"));
require(Cwd::abs_path("$__dir/../media.pm"));
require(Cwd::abs_path("$__dir/../../schema.pm"));

package ProjectNameUtilities;

my $CHUNK = 65536;

sub max_buffer {
  my ($ctx) = @_;
  for my $val (ProjectNameHelpers::gp($ctx->{options}, 'maxBuffer'),
    ProjectNameSchema::optspec()->{maxBuffer}) {
    return int($val) if defined $val && !ref $val
      && Scalar::Util::looks_like_number($val) && 0 <= $val;
  }
  return 16777216;
}

sub _too_large {
  my ($ctx, $code, $max, $declared) = @_;
  return $ctx->make_error($code, 'response: body ' . (defined $declared
    ? "of $declared bytes exceeds" : 'is longer than') . " maxBuffer ($max bytes)");
}

sub _close_body {
  my ($body) = @_;
  close($body) if ref $body && Scalar::Util::openhandle($body);
  return;
}

# The whole body, refused past the bound: by its declared length before a
# byte is read, else by the count as it arrives. A body is a string, a
# filehandle, or a coderef answering the next chunk and undef at the end.
# Answers (bytes, undef) or (undef, error).
sub read_bounded {
  my ($ctx, $response, $max, $code) = @_;
  my $body = $response->{body};
  my $length = header_value($response->{headers}, 'content-length');
  $length =~ s/^\s+|\s+$//g;

  if ($length =~ /\A\d+\z/ && $max < $length) {
    _close_body($body);
    return (undef, _too_large($ctx, $code, $max, $length));
  }

  my $next;
  if (ref $body eq 'CODE') {
    $next = $body;
  }
  elsif (ref $body && Scalar::Util::openhandle($body)) {
    binmode($body);
    $next = sub {
      my $n = read($body, my $chunk, $CHUNK);
      return $n ? $chunk : undef;
    };
  }
  else {
    my $whole = defined $body && !ref $body ? $body : '';
    $next = sub { my $c = $whole; $whole = undef; return $c };
  }

  my $out = '';
  while (defined(my $chunk = $next->())) {
    $out .= ProjectNameBinary::to_bytes($chunk);
    if ($max < length $out) {
      _close_body($body);
      return (undef, _too_large($ctx, $code, $max));
    }
  }
  return ($out, undef);
}

# A raw success body: text into the record under `$body`; bytes only into a
# binary handle's read, never into the record. Answers an error, else undef.
sub read_raw {
  my ($ctx) = @_;
  my $response = $ctx->{response};
  my $result = $ctx->{result};
  my $transfer = $ctx->{ctrl}{transfer};
  my $max = max_buffer($ctx);

  if (ProjectNameHelpers::is_true(
    ProjectNameHelpers::gpath($ctx->{point}, 'response.binary'))) {
    $result->{body} = undef;
    if (ref $transfer eq 'HASH' && 'read' eq ($transfer->{direction} // '')) {
      my ($bytes, $err) = read_bounded($ctx, $response, $max, 'binary_too_large');
      return $err if $err;
      $transfer->{bytes} = $bytes;
    }
    else {
      _close_body($response->{body});
    }
    return undef;
  }

  my ($bytes, $err) = read_bounded($ctx, $response, $max, 'response_too_large');
  return $err if $err;
  utf8::decode($bytes);
  $result->{body} = { $ProjectNameUtilities::RAW_BODY => $bytes };
  return undef;
}

1;
