# ProjectName SDK operation

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/helpers.pm"));

package ProjectNameOperation;

sub new {
  my ($class, $opmap) = @_;
  $opmap = {} unless defined $opmap;

  my $e = ProjectNameHelpers::gp($opmap, 'entity');
  my $entity = (defined $e && !ref $e && $e ne '') ? $e : '_';

  my $n = ProjectNameHelpers::gp($opmap, 'name');
  my $name = (defined $n && !ref $n && $n ne '') ? $n : '_';

  my $i = ProjectNameHelpers::gp($opmap, 'input');
  my $input = (defined $i && !ref $i && $i ne '') ? $i : '_';

  my $points = [];
  my $raw_points = ProjectNameHelpers::gp($opmap, 'points');
  if (Voxgig::Struct::islist($raw_points)) {
    push @$points, grep { Voxgig::Struct::ismap($_) } @$raw_points;
  }

  my $raw_alias = ProjectNameHelpers::gp($opmap, 'alias');
  my $alias = Voxgig::Struct::ismap($raw_alias) ? $raw_alias : undef;

  return bless {
    entity => $entity,
    name   => $name,
    input  => $input,
    points => $points,
    alias  => $alias,
  }, $class;
}

1;
