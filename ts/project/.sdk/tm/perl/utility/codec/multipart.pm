# ProjectName SDK body codec: multipart

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../binary.pm"));

package ProjectNameUtilities;

my $MULTIPART_MEDIA = 'multipart/form-data';
my $OCTET_MEDIA = 'application/octet-stream';
my $CRLF = "\r\n";

# A boundary of random bits from the operating system's source; rand() is
# not one.
sub multipart_boundary {
  my $bytes = '';
  if (open(my $fh, '<:raw', '/dev/urandom')) {
    read($fh, $bytes, 16);
    close $fh;
  }
  if (16 != length $bytes) {
    require Crypt::URandom;
    $bytes = Crypt::URandom::urandom(16);
  }
  return unpack('H*', $bytes);
}

# Inside a quoted header parameter nothing may end the quote or the line.
sub _quoted {
  my ($text) = @_;
  my %esc = ("\\" => '%5C', '"' => '%22', "\r" => '%0D', "\n" => '%0A');
  (my $out = "$text") =~ s/([\\"\r\n])/$esc{$1}/g;
  return $out;
}

# A local path never leaves: only its last segment, and nothing for an empty one.
sub _base_name {
  my ($name) = @_;
  return undef unless defined $name && !ref $name;
  my ($base) = "$name" =~ m{([^/\\]*)\z};
  return defined $base && '' ne $base ? $base : undef;
}

sub _file_part {
  my ($ctx, $name, $field, $value) = @_;
  my ($content, $filename, $type) = ($value, undef, undef);
  if (is_source($value)) {
    ($content, $filename, $type) = ($value->data, _base_name($value->name), $value->type);
  }
  if (is_stream_value($content)) {
    return (undef, $ctx->make_error('binary_feature_inactive', 'The multipart field "' . $name
      . '" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.'));
  }
  my $media = ProjectNameHelpers::gp($field, 'media');
  $type //= defined $media && !ref $media ? $media : $OCTET_MEDIA;
  return ({ filename => $filename, type => $type,
    content => ProjectNameBinary::to_bytes(item_text($content)) }, undef);
}

sub _text_part {
  my ($field, $value) = @_;
  my $media = ProjectNameHelpers::gp($field, 'media');
  return { type => (defined $media && !ref $media ? $media : undef),
    content => ProjectNameBinary::to_bytes(item_text($value)) };
}

# Answers ({ type, body }, undef) or (undef, error); the body is bytes.
sub encode_multipart {
  my ($ctx, $data, $lifted) = @_;
  my $body = ProjectNameHelpers::gp($ctx->{point}, 'body');
  my $boundary = $ctx->{utility}{multipart_boundary}->($ctx);
  my $out = '';

  for my $item (body_items($body, $data, $lifted)) {
    my ($part, $err) = $item->{binary}
      ? _file_part($ctx, $item->{name}, $item->{field}, $item->{value})
      : (_text_part($item->{field}, $item->{value}), undef);
    return (undef, $err) if $err;

    if (defined $part->{type} && $part->{type} =~ /[\r\n]/) {
      return (undef, $ctx->make_error('binary_source_refused',
        'The media type of the multipart field "' . $item->{name}
        . '" contains a line break.'));
    }

    $out .= ProjectNameBinary::to_bytes('--' . $boundary . $CRLF
      . 'Content-Disposition: form-data; name="' . _quoted($item->{name}) . '"'
      . (defined $part->{filename} ? '; filename="' . _quoted($part->{filename}) . '"' : '')
      . $CRLF . (defined $part->{type} ? 'Content-Type: ' . $part->{type} . $CRLF : '')
      . $CRLF);
    $out .= $part->{content} . $CRLF;
  }

  $out .= '--' . $boundary . '--' . $CRLF;

  my $media = ProjectNameHelpers::gp($body, 'media');
  my ($declared) = split /;/, (defined $media && !ref $media ? "$media" : '');
  $declared = defined $declared ? $declared : '';
  $declared =~ s/^\s+|\s+$//g;
  my $type = ('' eq $declared ? $MULTIPART_MEDIA : $declared) . '; boundary=' . $boundary;
  return ({ type => $type, body => $out }, undef);
}

1;
