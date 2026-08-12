# ProjectName SDK utility: make_result

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{make_result} = sub {
  my ($ctx) = @_;
  return ($ctx->{out}{result}, undef) if $ctx->{out}{result};

  my $utility = $ctx->{utility};
  my $op = $ctx->{op};
  my $entity = $ctx->{entity};
  my $spec = $ctx->{spec};
  my $result = $ctx->{result};

  return (undef, $ctx->make_error('result_no_spec',
    'Expected context spec property to be defined.')) unless $spec;
  return (undef, $ctx->make_error('result_no_result',
    'Expected context result property to be defined.')) unless $result;

  $spec->{step} = 'result';
  $utility->{transform_response}->($ctx);

  # Every operation resolves to PLAIN records — load, create, update and
  # list alike. `list` used to be the outlier: it wrapped each record in
  # an entity instance, so the same record came back with a different
  # type, a different key order and an extra marker depending on which
  # call produced it. Any consumer touching both paths had to normalise
  # defensively, and feeding a wrapped record into a host framework's own
  # metadata silently produced wrong entities with no error at all. A
  # missing or empty list still normalises to an empty list.
  if ('list' eq $op->{name}) {
    my $resdata = $result->{resdata};
    $result->{resdata} = Voxgig::Struct::islist($resdata) ? $resdata : [];
  }

  $ctx->{ctrl}{explain}{result} = $result if $ctx->{ctrl}{explain};
  return ($result, undef);
};

1;
