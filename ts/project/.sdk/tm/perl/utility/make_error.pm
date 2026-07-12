# ProjectName SDK utility: make_error

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../core/context.pm"));
require(Cwd::abs_path("$__dir/../core/operation.pm"));
require(Cwd::abs_path("$__dir/../core/result.pm"));
require(Cwd::abs_path("$__dir/../core/error.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{make_error} = sub {
  my ($ctx, $err) = @_;
  if (!defined $ctx) {
    $ctx = ProjectNameContext->new({}, undef);
  }
  my $op = $ctx->{op} || ProjectNameOperation->new({});
  my $opname = $op->{name};
  $opname = 'unknown operation' if !defined $opname || '' eq $opname || '_' eq $opname;

  my $result = $ctx->{result} || ProjectNameResult->new({});
  $result->{ok} = 0;

  $err = $result->{err} if !defined $err;
  $err = $ctx->make_error('unknown', 'unknown error') if !defined $err;

  my $errmsg = (Scalar::Util::blessed($err) && $err->isa('ProjectNameError'))
    ? $err->{msg} : "$err";
  $errmsg =~ s/\s+\z//;
  my $msg = "ProjectNameSDK: $opname: $errmsg";
  $msg = $ctx->{utility}{clean}->($ctx, $msg);

  $result->{err} = undef;
  my $spec = $ctx->{spec};

  if ($ctx->{ctrl}{explain}) {
    $ctx->{ctrl}{explain}{err} = { 'message' => $msg };
  }

  my $sdk_err = ProjectNameError->new('', $msg, $ctx);
  $sdk_err->{result} = $ctx->{utility}{clean}->($ctx, $result);
  $sdk_err->{spec} = $ctx->{utility}{clean}->($ctx, $spec);
  $sdk_err->{code} = $err->{code}
    if Scalar::Util::blessed($err) && $err->isa('ProjectNameError');

  $ctx->{ctrl}{err} = $sdk_err;

  # Opt-out escape hatch: when throwing is explicitly disabled, return the
  # bare result data instead of dying.
  if (defined $ctx->{ctrl}{throw_err} && !$ctx->{ctrl}{throw_err}) {
    return $result->{resdata};
  }
  # Default idiomatic path: die with the already-constructed exception.
  die $sdk_err;
};

1;
