# ProjectName SDK utility: make_context

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../core/context.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{make_context} = sub {
  my ($ctxmap, $basectx) = @_;
  return ProjectNameContext->new($ctxmap, $basectx);
};

1;
