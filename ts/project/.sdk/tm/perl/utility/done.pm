# ProjectName SDK utility: done

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

$REGISTRY{done} = sub {
  my ($ctx) = @_;
  my $ctrl = $ctx->{ctrl};
  if ($ctrl->{explain}) {
    $ctrl->{explain} = $ctx->{utility}{clean}->($ctx, $ctrl->{explain});
    my $er = $ctrl->{explain}{result};
    delete $er->{err} if Voxgig::Struct::ismap($er);
  }
  # An operation resolves to the ENTITY, not the raw data. Entities are
  # stateful: the op fragment has just absorbed resdata/resmatch into this
  # instance, and the caller reaches the record through .data(). Two
  # structural exceptions: `list` resolves to the ARRAY of entity
  # instances makeResult built, and a context with no entity
  # (direct/prepare, streaming) has nothing to return but the data. A
  # removed entity keeps its data but is no longer live. See AGENTS.md.
  if ($ctx->{result} && $ctx->{result}{ok}) {
    my $entity = $ctx->{entity};
    my $opname = $ctx->{op} ? $ctx->{op}{name} : undef;

    if ($entity && (!defined $opname || $opname ne 'list')) {
      $entity->mark_deleted if defined $opname && $opname eq 'remove';
      return $entity;
    }

    return $ctx->{result}{resdata};
  }
  # On error, make_error dies with the exception (or, when throw_err is
  # disabled, returns the bare result data). Propagate its value.
  return $ctx->{utility}{make_error}->($ctx, undef);
};

1;
