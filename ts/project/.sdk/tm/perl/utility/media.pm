# ProjectName SDK utility: media

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

# The media types a point declares: `response` (the model's `rs`) for the
# Accept header, and `body` (the model's `rb`) for the request body.
package ProjectNameUtilities;

# The data key holding a raw request body. Like `$action`, it can never be a
# declared argument name.
our $RAW_BODY = '$body';

sub is_json_media {
  my ($media) = @_;
  my ($m) = split /;/, (defined $media && !ref $media ? "$media" : '');
  $m = lc(defined $m ? $m : '');
  $m =~ s/^\s+|\s+$//g;
  return 'application/json' eq $m || 'text/json' eq $m || $m =~ /\+json\z/;
}

# The declared JSON type alone, else every declared type in the model's
# order; undef when no success response declares a body.
sub accept_of {
  my ($point) = @_;
  my $res = ProjectNameHelpers::gp($point, 'response');
  my $media = ProjectNameHelpers::gp($res, 'media');
  return undef unless defined $media && !ref $media && '' ne $media;
  my $kind = ProjectNameHelpers::gp($res, 'kind');
  return $media if defined $kind && 'json' eq $kind;
  my @types = ($media);
  my $alts = ProjectNameHelpers::gp($res, 'alternatives');
  for my $alt (ref $alts eq 'ARRAY' ? @$alts : ()) {
    my $m = ProjectNameHelpers::gp($alt, 'media');
    push @types, $m if defined $m && !ref $m && '' ne $m;
  }
  return join(', ', @types);
}

sub is_raw_request {
  my ($point) = @_;
  my $kind = ProjectNameHelpers::gp(ProjectNameHelpers::gp($point, 'body'), 'kind');
  return defined $kind && 'raw' eq $kind;
}

sub _has_header {
  my ($headers, $name) = @_;
  return scalar grep { lc $_ eq $name } keys %$headers;
}

# A caller's accept wins. A declared request type replaces each JSON
# content-type, the SDK default, and leaves any other the caller set.
sub media_headers {
  my ($point, $headers) = @_;
  my $accept = accept_of($point);
  $headers->{accept} = $accept if defined $accept && !_has_header($headers, 'accept');

  my $body = ProjectNameHelpers::gp($point, 'body');
  my $kind = ProjectNameHelpers::gp($body, 'kind');
  my $media = ProjectNameHelpers::gp($body, 'media');
  if (defined $kind && ('raw' eq $kind || 'json' eq $kind)
    && defined $media && !ref $media && '' ne $media) {
    delete $headers->{$_}
      for grep { 'content-type' eq lc $_ && is_json_media($headers->{$_}) } keys %$headers;
    $headers->{'content-type'} = $media unless _has_header($headers, 'content-type');
  }

  return $headers;
}

# A string of bytes, a character string (sent as UTF-8), or a filehandle.
sub raw_body {
  my ($reqdata) = @_;
  return ref $reqdata eq 'HASH' ? $reqdata->{$RAW_BODY} : undef;
}

1;
