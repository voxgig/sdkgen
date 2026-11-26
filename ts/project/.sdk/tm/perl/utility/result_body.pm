# ProjectName SDK utility: result_body

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/media.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{result_body} = sub {
  my ($ctx) = @_;
  my $response = $ctx->{response};
  my $result = $ctx->{result};
  if ($result && $response && $response->{json_func}
    && ProjectNameHelpers::rb_truthy($response->{body})) {
    $result->{body} = $response->{json_func}->();
  }
  if ($result && $response && $response->{unreadable}) {
    my $sent = $ctx->{spec} ? $ctx->{spec}{headers} : undef;
    $result->{err} = unreadable_body($ctx, $result->{status}, $result->{headers},
      $response->{body}, $sent, $result->{err});
  }
  return $result;
};

use constant BODY_PREVIEW_LENGTH => 160;

# A body that is not JSON. An HTTP failure keeps its own error, with the
# response described; otherwise the code tells a wrong content type from
# malformed JSON.
sub unreadable_body {
  my ($ctx, $status, $headers, $text, $sent, $failed) = @_;
  my $type = header_value($headers, 'content-type');
  my $agent = $ctx->{utility}{clean}->($ctx, header_value($sent, 'user-agent'));
  $agent = 'transport default' unless defined $agent && length $agent;
  my $detail = 'HTTP ' . (defined $status ? $status : -1) . ', content-type '
    . (length $type ? $type : 'none') . ", user-agent $agent";
  # Only text is quoted: bytes are a file's, by the model or by their type.
  $detail .= ', body: ' . _body_preview($ctx, $text)
    if defined $text && !is_binary_response($ctx->{point}, $type);

  if (defined $failed) {
    if (Scalar::Util::blessed($failed) && 'HASH' eq Scalar::Util::reftype($failed)
      && exists $failed->{msg}) {
      $failed->{msg} .= " ($detail)";
      return $failed;
    }
    return "$failed ($detail)";
  }

  if (!length $type || $type =~ /json/i) {
    return $ctx->make_error('response_json_invalid',
      "response: body is not valid JSON ($detail)");
  }
  return $ctx->make_error('response_content_type',
    "response: expected JSON, got $type ($detail)");
}

# Cleaned whole: a secret the bound would split could leave its prefix.
sub _body_preview {
  my ($ctx, $text) = @_;
  my $flat = "$text";
  utf8::decode($flat);
  $flat =~ s/\s+/ /g;
  $flat =~ s/^ | $//g;
  $flat = $ctx->{utility}{clean}->($ctx, $flat);
  $flat = defined $flat ? "$flat" : '';
  return length($flat) > BODY_PREVIEW_LENGTH
    ? substr($flat, 0, BODY_PREVIEW_LENGTH) . '...' : $flat;
}

1;
