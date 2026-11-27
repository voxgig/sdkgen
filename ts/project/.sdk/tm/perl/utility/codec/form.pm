# ProjectName SDK body codec: form

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../binary.pm"));

package ProjectNameUtilities;

my $FORM_MEDIA = 'application/x-www-form-urlencoded';

# application/x-www-form-urlencoded byte serialisation: alphanumerics and
# `*-._` as they are, a space as `+`, every other byte as %HH.
sub form_escape {
  my ($bytes) = @_;
  my $out = "$bytes";
  utf8::encode($out) if utf8::is_utf8($out);
  $out =~ s/([^A-Za-z0-9*\-._ ])/sprintf('%%%02X', ord($1))/ge;
  $out =~ tr/ /+/;
  return $out;
}

sub _form_value {
  my ($ctx, $name, $value) = @_;
  my $content = is_source($value) ? $value->data : $value;
  if (is_stream_value($content)) {
    return (undef, $ctx->make_error('binary_source_refused', 'The form field "' . $name
      . '" holds a Blob or a stream, which a form body cannot carry: pass its bytes.'));
  }
  return (ProjectNameBinary::to_bytes(item_text($content)), undef);
}

# Answers ({ type, body }, undef) or (undef, error).
sub encode_form {
  my ($ctx, $data, $lifted) = @_;
  my $body = ProjectNameHelpers::gp($ctx->{point}, 'body');
  my @pairs;

  for my $item (body_items($body, $data, $lifted)) {
    my ($value, $err) = _form_value($ctx, $item->{name}, $item->{value});
    return (undef, $err) if $err;
    push @pairs, form_escape($item->{name}) . '=' . form_escape($value);
  }

  my $media = ProjectNameHelpers::gp($body, 'media');
  $media = $FORM_MEDIA unless defined $media && !ref $media && '' ne $media;
  return ({ type => $media, body => join('&', @pairs) }, undef);
}

1;
