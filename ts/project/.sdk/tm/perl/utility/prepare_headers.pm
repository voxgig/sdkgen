# ProjectName SDK utility: prepare_headers

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{prepare_headers} = sub {
  my ($ctx) = @_;
  my $options = $ctx->{client}->options_map;
  my $headers = ProjectNameHelpers::gp($options, 'headers');
  my $out = ProjectNameHelpers::rb_truthy($headers) ? Voxgig::Struct::clone($headers) : {};
  $out = {} unless Voxgig::Struct::ismap($out);
  # A header parameter travels as a header, under the name the definition
  # gives it, and only from this call's own arguments.
  my $hl = $ctx->{point} ? ProjectNameHelpers::gpath($ctx->{point}, 'args.header') : undef;
  if (Voxgig::Struct::islist($hl)) {
    for my $hd (@$hl) {
      my $name = ProjectNameHelpers::gp($hd, 'name');
      next unless defined $name && !ref $name && '' ne $name;
      my $orig = ProjectNameHelpers::gp($hd, 'orig');
      $orig = $name unless defined $orig && !ref $orig && '' ne $orig;
      my $val = ProjectNameHelpers::gp($ctx->{reqmatch} || {}, $name);
      $val = ProjectNameHelpers::gp($ctx->{reqdata} || {}, $name) unless defined $val;
      $out->{lc $orig} = Voxgig::Struct::stringify($val) if defined $val;
    }
  }
  return $out;
};

1;
