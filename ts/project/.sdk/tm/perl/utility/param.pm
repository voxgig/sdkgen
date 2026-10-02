# ProjectName SDK utility: param

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

$REGISTRY{param} = sub {
  my ($ctx, $paramdef) = @_;

  my $pt = Voxgig::Struct::typify($paramdef);
  my $key;
  if (($pt & Voxgig::Struct::T_string()) > 0) {
    $key = $paramdef;
  }
  else {
    my $k = ProjectNameHelpers::gp($paramdef, 'name');
    $key = (defined $k && !ref $k) ? $k : '';
  }

  my $akey = _param_alias($ctx->{point}, $key);
  if ($ctx->{spec} && '' ne $akey &&
    !defined ProjectNameHelpers::gp($ctx->{reqmatch}, $key) &&
    !defined ProjectNameHelpers::gp($ctx->{match}, $key)) {
    $ctx->{spec}{alias}{$akey} = $key;
  }

  return param_value($ctx, $ctx->{point}, $key);
};

# The name a point gives a parameter in the call, if it renames it.
sub _param_alias {
  my ($point, $key) = @_;
  return '' unless $point;
  my $alias_map = ProjectNameHelpers::to_map(ProjectNameHelpers::gp($point, 'alias'));
  my $ak = $alias_map ? ProjectNameHelpers::gp($alias_map, $key) : undef;
  return (defined $ak && !ref $ak) ? $ak : '';
}

# The value the call or its entity gives a point's parameter, under its name
# or the point's alias for it.
sub param_value {
  my ($ctx, $point, $key) = @_;
  my $akey = _param_alias($point, $key);

  my $val = ProjectNameHelpers::gp($ctx->{reqmatch}, $key);
  $val = ProjectNameHelpers::gp($ctx->{match}, $key) if !defined $val;
  $val = ProjectNameHelpers::gp($ctx->{reqmatch}, $akey) if !defined $val && '' ne $akey;
  $val = ProjectNameHelpers::gp($ctx->{reqdata}, $key) if !defined $val;
  $val = ProjectNameHelpers::gp($ctx->{data}, $key) if !defined $val;

  if (!defined $val && '' ne $akey) {
    $val = ProjectNameHelpers::gp($ctx->{reqdata}, $akey);
    $val = ProjectNameHelpers::gp($ctx->{data}, $akey) if !defined $val;
  }

  return $val;
}

# The arguments a point declares in one location, query or header, each with
# the name it travels under and the value this call passes in its match or
# else its data. Unlike a path parameter, the entity's stored match and data
# never supply one.
sub call_args {
  my ($ctx, $kind) = @_;
  my $defs = $ctx->{point} ? ProjectNameHelpers::gpath($ctx->{point}, "args.$kind") : undef;
  return () unless Voxgig::Struct::islist($defs);
  my @out;
  for my $ad (@$defs) {
    my $name = ProjectNameHelpers::gp($ad, 'name');
    next unless defined $name && !ref $name && '' ne $name;
    my $wire = ProjectNameHelpers::gp($ad, 'orig');
    $wire = $name unless defined $wire && !ref $wire && '' ne $wire;
    my $val = ProjectNameHelpers::gp($ctx->{reqmatch} || {}, $name);
    $val = ProjectNameHelpers::gp($ctx->{reqdata} || {}, $name) unless defined $val;
    push @out, [$name, $wire, $val];
  }
  return @out;
}

1;
