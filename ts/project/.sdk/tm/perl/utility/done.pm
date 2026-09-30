# ProjectName SDK utility: done

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{done} = sub {
  my ($ctx) = @_;
  my $ctrl = $ctx->{ctrl};
  if ($ctrl->{explain}) {
    # The caller's own hash is the explain record (the control is built
    # from it), so the cleaned copy is written back INTO it: assigning a
    # fresh hash would leave the caller holding the raw one.
    my $explain = $ctrl->{explain};
    my $cleaned = $ctx->{utility}{clean}->($ctx, $explain);
    if (Voxgig::Struct::ismap($cleaned) && Voxgig::Struct::ismap($explain)
      && Scalar::Util::refaddr($cleaned) != Scalar::Util::refaddr($explain)) {
      %$explain = %$cleaned;
    }
    # A copy: with clean off, explain.result is the live result make_error reads.
    my $er = $ctrl->{explain}{result};
    if (Voxgig::Struct::ismap($er)) {
      my %pruned = %$er;
      delete $pruned{err};
      $ctrl->{explain}{result} = \%pruned;
    }
  }
  if ($ctx->{result} && $ctx->{result}{ok}) {
    return $ctx->{result}{resdata};
  }
  # On error, make_error dies with the exception (or, when throw_err is
  # disabled, returns the bare result data). Propagate its value.
  return $ctx->{utility}{make_error}->($ctx, undef);
};

1;
