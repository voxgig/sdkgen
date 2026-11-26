# ProjectName SDK error

use strict;
use warnings;

use Scalar::Util ();

package ProjectNameError;

use overload
  '""'     => sub { defined $_[0]->{msg} ? $_[0]->{msg} : '' },
  'bool'   => sub { 1 },
  fallback => 1;

# The context stays reachable for a debugger (`$err->ctx`) and is part of
# no dump: a blessed hash hides nothing from Data::Dumper or the struct's
# own serialiser, so it lives in an inside-out slot beside the object,
# weakened so an error never keeps a finished operation alive.
my %CTX;

# What a hook died with, kept for the caller (`$err->cause`) and, like the
# context, out of every dump: its message is the raw one.
my %CAUSE;

sub new {
  my ($class, $code, $msg, $ctx) = @_;
  my $self = bless {
    is_sdk_error => 1,
    sdk          => 'ProjectName',
    code         => (defined $code ? $code : ''),
    msg          => (defined $msg ? $msg : ''),
    result       => undef,
    spec         => undef,
    # make_error promotes the HTTP status here (-1 when there was no
    # response), so a consumer never reaches into `result` for it.
    status       => -1,
  }, $class;
  $self->ctx($ctx) if defined $ctx;
  return $self;
}

sub ctx {
  my $self = shift;
  my $addr = Scalar::Util::refaddr($self);
  if (@_) {
    $CTX{$addr} = $_[0];
    Scalar::Util::weaken($CTX{$addr}) if ref $_[0];
  }
  return $CTX{$addr};
}

sub cause {
  my $self = shift;
  my $addr = Scalar::Util::refaddr($self);
  $CAUSE{$addr} = $_[0] if @_;
  return $CAUSE{$addr};
}

sub DESTROY {
  my $addr = Scalar::Util::refaddr($_[0]);
  delete $CTX{$addr};
  delete $CAUSE{$addr};
  return;
}

sub code   { $_[0]->{code} }
sub msg    { $_[0]->{msg} }
sub error  { $_[0]->{msg} }
sub status { $_[0]->{status} }

sub not_found { return 404 == ($_[0]->{status} // -1) ? 1 : 0 }

# What make_error attached is already cleaned; the context is not part of
# the record.
sub to_h {
  my ($self) = @_;
  return {
    'sdk'     => $self->{sdk},
    'code'    => $self->{code},
    'message' => $self->{msg},
    'status'  => $self->{status},
    'result'  => $self->{result},
    'spec'    => $self->{spec},
  };
}

sub TO_JSON {
  my ($self) = @_;
  return $self->to_h;
}

1;
