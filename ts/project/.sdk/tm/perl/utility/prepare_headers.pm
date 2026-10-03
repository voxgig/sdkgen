# ProjectName SDK utility: prepare_headers

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/param.pm"));
require(Cwd::abs_path("$__dir/media.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{prepare_headers} = sub {
  my ($ctx) = @_;
  my $options = $ctx->{client}->options_map;
  my $headers = ProjectNameHelpers::gp($options, 'headers');
  my $out = ProjectNameHelpers::rb_truthy($headers) ? Voxgig::Struct::clone($headers) : {};
  $out = {} unless Voxgig::Struct::ismap($out);
  $out = ProjectNameUtilities::media_headers($ctx->{point}, $out);
  # A header argument replaces a default of the same name, whatever its case.
  for my $arg (ProjectNameUtilities::call_args($ctx, 'header')) {
    my (undef, $orig, $val) = @$arg;
    next unless defined $val;
    my $wire = lc $orig;
    delete $out->{$_} for grep { lc $_ eq $wire } keys %$out;
    $out->{$wire} = Voxgig::Struct::stringify($val);
  }
  # A cookie argument travels in the cookie header as name=value, after any
  # cookies the caller's headers already send.
  my @cookies = map { $_->[1] . '=' . Voxgig::Struct::stringify($_->[2]) }
    grep { defined $_->[2] } ProjectNameUtilities::call_args($ctx, 'cookie');
  if (@cookies) {
    my @given = grep { lc $_ eq 'cookie' } keys %$out;
    my @sent = grep { defined $_ && !ref $_ && $_ ne '' } map { $out->{$_} } @given;
    delete $out->{$_} for @given;
    $out->{cookie} = join('; ', @sent, @cookies);
  }
  return $out;
};

1;
