# ProjectName SDK validate feature
#
# Payload validation against the model's own field types. The perl port of
# tm/ts/src/feature/validate/ValidateFeature.ts.
#
# The specs are NOT written here and not written in the model either: every
# entity field already carries a canonical type sentinel ($STRING, $INTEGER,
# the $ONE union for an OpenAPI multi-type), which is the same vocabulary
# Voxgig::Struct::validate speaks. The generator maps them once
# (helpers/canonSpec) and emits ProjectNameSchema::entityspec(), so a field
# whose type changes in the API spec changes what this feature enforces with
# no edit anywhere.
#
# WHAT IS CHECKED
#   outbound (PreSpec)  the payload the caller asked to send, against
#                       spec->{op}{opname} - the operation's request shape.
#   inbound  (PreDone)  each record the operation returned, against
#                       spec->{data} - the entity's own field types.
#
# WHAT IS NOT. The model carries no array element types, no nested object
# schemas, no enums, formats or bounds, so this checks the shape the model
# knows and nothing more.

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/../schema.pm"));
require(Cwd::abs_path("$__dir/base_feature.pm"));

package ProjectNameValidateFeature;

our @ISA = ('ProjectNameBaseFeature');

# Built rather than written, so the backticks cannot be lost in an edit.
my $OPEN = chr(96) . '$OPEN' . chr(96);

sub new {
  my ($class) = @_;
  my $self = ProjectNameBaseFeature::new($class);
  $self->{version} = '0.0.1';
  $self->{name} = 'validate';
  # Inactive until init (feature_init only fires init when active).
  $self->{active} = 0;
  $self->{client} = undef;
  $self->{options} = {};
  $self->{spec} = {};
  $self->{request} = 1;
  $self->{response} = 0;
  $self->{mode} = 'throw';
  return $self;
}

sub init {
  my ($self, $ctx, $options) = @_;
  $self->{client} = $ctx->{client};
  $self->{options} = Voxgig::Struct::ismap($options) ? $options : {};
  $self->{active} = ProjectNameHelpers::is_true($self->{options}{active}) ? 1 : 0;

  # DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
  # config.options documents them and types them; it does not inject them,
  # because each feature entry in the spec is optional and struct fills in
  # nothing through an optional union.
  #
  # `request` defaults ON, so only an explicit false turns it off - an ABSENT
  # key must not read as false, which a bare is_true would make it.
  $self->{request} = (exists $self->{options}{request}
    && !ProjectNameHelpers::is_true($self->{options}{request})) ? 0 : 1;
  $self->{response} = ProjectNameHelpers::is_true($self->{options}{response}) ? 1 : 0;

  # FAIL CLOSED. Only the exact string 'report' selects report mode, so a typo
  # (mode => 'thow') still rejects rather than silently turning enforcement
  # off. The option spec rejects the typo outright; this is what happens if it
  # ever does not.
  my $mode = $self->{options}{mode};
  $self->{mode} = (defined $mode && !ref $mode && 'report' eq $mode) ? 'report' : 'throw';

  # `strict` is applied ONCE, here, by rebuilding the spec tree without the
  # $OPEN markers - rather than per call, which would clone a spec for every
  # request an SDK ever makes.
  my $entityspec = ProjectNameSchema::entityspec();
  $self->{spec} = ProjectNameHelpers::is_true($self->{options}{strict})
    ? _close($entityspec) : $entityspec;

  return;
}

# Outbound. make_options' make_spec short-circuits on a $ctx->{out}{spec} that
# is already set, so assigning the error here rejects the operation before the
# request is built - the same seam rbac uses one stage earlier.
sub PreSpec {
  my ($self, $ctx) = @_;
  return unless $self->{active} && $self->{request};

  my $opname = _opname($ctx);
  my $espec = $self->_entity_spec($ctx);
  my $ops = Voxgig::Struct::ismap($espec) ? $espec->{op} : undef;
  my $opspec = Voxgig::Struct::ismap($ops) ? $ops->{$opname} : undef;

  return unless defined $opspec;

  my $errs = $self->_check($ctx, $self->_payload($ctx, $opname), $opspec, 'request');
  return if 0 == scalar(@$errs) || 'report' eq $self->{mode};

  my $entname = _entname($ctx);
  my $err = $ctx->make_error('validate_failed',
    "Invalid $opname request for entity \"$entname\": " . join('; ', @$errs));
  $ctx->{out}{spec} = $err;
  return $err;
}

# Inbound. PreDone rather than PreResult: the records are extracted from the
# response body by make_result, which runs between the two, so at PreResult
# there is nothing to check but the envelope.
#
# HOOK ORDER MATTERS HERE, and the default order is not the one you want.
# PreDone hooks fire in feature ADD order, which defaults to `test` first and
# then names sorted - and `validate` sorts last, after audit, cost, debug,
# metrics and telemetry. Those observers therefore record the operation as a
# success before this hook has looked at it. Activating features as an ORDERED
# ARRAY fixes it.
sub PreDone {
  my ($self, $ctx) = @_;
  return unless $self->{active} && $self->{response};

  my $espec = $self->_entity_spec($ctx);
  return unless Voxgig::Struct::ismap($espec);

  my $dataspec = $espec->{data};
  return unless defined $dataspec;

  my $result = $ctx->{result};
  return unless defined $result && defined $result->{resdata};

  # A list op returns many records and a load returns one; both are checked
  # against the same record spec, because they are the same entity.
  my $resdata = $result->{resdata};
  my @records = Voxgig::Struct::islist($resdata) ? @$resdata : ($resdata);

  my @errs;
  for my $record (@records) {
    next unless defined $record;

    # A NON-OBJECT IS A FAILURE, not something to skip. A load that answered
    # 42 where the entity's spec wants a record must not pass this feature
    # silently - struct rejects it with the field it could not find.
    push @errs, @{ $self->_check($ctx, _unwrap($record), $dataspec, 'response') };
  }

  return if 0 == scalar(@errs) || 'report' eq $self->{mode};

  my $entname = _entname($ctx);
  my $err = $ctx->make_error('validate_failed',
    "Invalid response for entity \"$entname\": " . join('; ', @errs));

  # BOTH, and `ok` is the load-bearing half: done returns resdata whenever
  # result->{ok} is true and never looks at err, so setting the error alone
  # would hand the caller the very records that failed the spec.
  $result->{ok} = 0;
  $result->{err} = $err;

  # AND THE DATA GOES. The load/update paths copy result->{resdata} into the
  # entity's own state on any defined value, BEFORE done raises - so rejecting
  # the operation while leaving the records in place would leave the caller
  # holding an entity populated from a payload this feature had just declared
  # invalid.
  $result->{resdata} = undef;

  return $err;
}

# The payload an operation is about to send.
#
# TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
# caller's argument in reqdata over the entity's data; a match op
# (load/list/remove) carries it in reqmatch over match. That is what the
# entity operations pass to make_context and what make_point reads - so
# reading reqdata for every op would check a load({id}) against the entity's
# STALE stored match and reject it for the id the caller had just supplied.
sub _payload {
  my ($self, $ctx, $opname) = @_;

  my $body = ('create' eq $opname || 'update' eq $opname || 'patch' eq $opname);

  my $base = $body ? $ctx->{data} : $ctx->{match};
  my $req = $body ? $ctx->{reqdata} : $ctx->{reqmatch};

  my %out;
  if (Voxgig::Struct::ismap($base)) {
    %out = (%out, %$base);
  }
  if (Voxgig::Struct::ismap($req)) {
    %out = (%out, %$req);
  }

  # `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
  # make_point reads it off this same argument and the request transformer
  # drops it before the body is built, so a spec built from the API's own
  # fields will never name it - and under `strict` every custom-action call
  # would be rejected for the one key that made it reachable.
  delete $out{'$action'};

  return \%out;
}

sub _entity_spec {
  my ($self, $ctx) = @_;
  return undef unless Voxgig::Struct::ismap($self->{spec});
  return $self->{spec}{ _entname($ctx) };
}

sub _opname {
  my ($ctx) = @_;
  my $op = $ctx->{op};
  my $name = $op ? $op->{name} : undef;
  return (defined $name && !ref $name) ? $name : '';
}

sub _entname {
  my ($ctx) = @_;

  my $entity = $ctx->{entity};
  my $name = $entity ? $entity->{name} : undef;
  return $name if defined $name && !ref $name && '' ne $name;

  my $op = $ctx->{op};
  my $entname = $op ? $op->{entity} : undef;
  return (defined $entname && !ref $entname) ? $entname : '';
}

# One validate call. Errors are COLLECTED, never thrown: struct dies on the
# first failure unless given an errs array, and a caller fixing a payload
# wants every problem with it, not the first one.
sub _check {
  my ($self, $ctx, $data, $spec, $direction) = @_;

  my @errs;
  my $injdef = { errs => \@errs };

  eval {
    Voxgig::Struct::validate($data, $spec, $injdef);
    1;
  } or do {
    # A spec this port cannot run at all (rather than a payload that fails it)
    # must not take the operation down with it: report it like any other
    # failure and let `mode` decide.
    my $e = $@ || 'validate failed';
    $e =~ s/\s+$//;
    push @errs, "$e" if 0 == scalar(@errs);
  };

  my @out = map { "$_" } @errs;

  if (0 < scalar(@out)) {
    my $on_invalid = $self->{options}{onInvalid};
    if (defined $on_invalid && 'CODE' eq ref($on_invalid)) {
      eval {
        $on_invalid->({
          entity => _entname($ctx),
          op => _opname($ctx),
          direction => $direction,
          errs => \@out,
          data => $data,
        });
        1;
      } or do { };
    }
  }

  return \@out;
}

# A RESULT RECORD AS DATA.
#
# make_result turns every record of a LIST into an entity instance, so what
# reaches PreDone for a list is wrappers, not records - and a wrapper checked
# against a field spec fails on every required field while its actual data
# goes unchecked. A load returns the record itself, so this handles both.
sub _unwrap {
  my ($record) = @_;

  if (Scalar::Util::blessed($record) && $record->can('data')) {
    my $data = eval { $record->data };
    return $data if defined $data;
  }

  return $record;
}

# The spec tree with every $OPEN marker removed, so an undeclared key is an
# error rather than a pass. Rebuilt rather than mutated: the entity spec is
# shared by every client in the process.
sub _close {
  my ($node) = @_;

  if (Voxgig::Struct::islist($node)) {
    return [ map { _close($_) } @$node ];
  }

  if (Voxgig::Struct::ismap($node)) {
    my %out;
    for my $k (keys %$node) {
      next if $k eq $OPEN;
      $out{$k} = _close($node->{$k});
    }
    return \%out;
  }

  return $node;
}

1;
