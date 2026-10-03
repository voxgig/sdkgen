# ProjectName SDK utility: prepare_query

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/param.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{prepare_query} = sub {
  my ($ctx) = @_;
  my $point = $ctx->{point};
  my $reqmatch = $ctx->{reqmatch} || {};
  my $params = [];
  if ($point) {
    my $p = ProjectNameHelpers::gp($point, 'params');
    $params = [@$p] if Voxgig::Struct::islist($p);
    # A path parameter travels in the path. The generated config lists them
    # as args.params, which prepare_params reads; params is the older list.
    my $pl = ProjectNameHelpers::gpath($point, 'args.params');
    if (Voxgig::Struct::islist($pl)) {
      for my $pd (@$pl) {
        my $name = ProjectNameHelpers::gp($pd, 'name');
        push @$params, $name if defined $name && !ref $name;
      }
    }
    # A header or cookie parameter travels in the headers, which prepare_headers
    # fills, unless a query parameter shares its name: then both are sent.
    my $ql = ProjectNameHelpers::gpath($point, 'args.query');
    my %declared = Voxgig::Struct::islist($ql)
      ? map { my $n = ProjectNameHelpers::gp($_, 'name'); defined $n && !ref $n ? ($n => 1) : () } @$ql
      : ();
    for my $hl (ProjectNameHelpers::gpath($point, 'args.header'),
      ProjectNameHelpers::gpath($point, 'args.cookie')) {
      next unless Voxgig::Struct::islist($hl);
      for my $hd (@$hl) {
        my $name = ProjectNameHelpers::gp($hd, 'name');
        push @$params, $name if defined $name && !ref $name && !$declared{$name};
      }
    }
  }
  # A query parameter travels under the name the definition gives it, its
  # orig, which the model may have renamed for the caller.
  my %wire;
  if ($point) {
    my $ql = ProjectNameHelpers::gpath($point, 'args.query');
    if (Voxgig::Struct::islist($ql)) {
      for my $qd (@$ql) {
        my $name = ProjectNameHelpers::gp($qd, 'name');
        my $orig = ProjectNameHelpers::gp($qd, 'orig');
        $wire{$name} = $orig
          if defined $name && !ref $name && defined $orig && !ref $orig && '' ne $orig;
      }
    }
  }
  my $out = {};
  my $items = Voxgig::Struct::items($reqmatch);
  if ($items) {
    for my $item (@$items) {
      my ($key, $val) = @$item;
      next unless ProjectNameHelpers::rb_truthy($val) && defined $key && !ref $key;
      next if '$action' eq $key;
      next if grep { defined $_ && !ref $_ && $_ eq $key } @$params;
      $out->{exists $wire{$key} ? $wire{$key} : $key} = $val;
    }
  }
  # A create or update passes its query arguments in its data.
  for my $arg (ProjectNameUtilities::call_args($ctx, 'query')) {
    my ($name, $orig, $val) = @$arg;
    next unless defined $val;
    next if grep { defined $_ && !ref $_ && $_ eq $name } @$params;
    $out->{$orig} = $val;
  }
  return $out;
};

1;
