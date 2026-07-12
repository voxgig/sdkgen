# ProjectName SDK EntityName entity

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package EntyClass;

sub new {
  my ($class, $client, $entopts) = @_;
  $entopts = {} unless defined $entopts;
  if (!defined $entopts->{active}) {
    $entopts->{active} = Voxgig::Struct::JTRUE();
  }
  elsif (ProjectNameHelpers::is_false($entopts->{active})) {
    # keep false
  }
  else {
    $entopts->{active} = Voxgig::Struct::JTRUE();
  }

  my $self = bless {
    _name => 'entityname',
    _client => $client,
    _utility => $client->get_utility,
    _entopts => $entopts,
    _data => {},
    _match => {},
  }, $class;

  $self->{_entctx} = $self->{_utility}{make_context}->({
    'entity' => $self,
    'entopts' => $entopts,
  }, $client->get_root_ctx);

  $self->{_utility}{feature_hook}->($self->{_entctx}, 'PostConstructEntity');

  return $self;
}

sub get_name {
  my ($self) = @_;
  return $self->{_name};
}

sub make {
  my ($self) = @_;
  my $opts = { %{ $self->{_entopts} } };
  return EntyClass->new($self->{_client}, $opts);
}

sub data_set {
  my ($self, $args) = @_;
  if ($args) {
    $self->{_data} = ProjectNameHelpers::to_map(Voxgig::Struct::clone($args)) || {};
    $self->{_utility}{feature_hook}->($self->{_entctx}, 'SetData');
  }
  return;
}

# Returns the current EntityName data (hashref).
sub data_get {
  my ($self) = @_;
  $self->{_utility}{feature_hook}->($self->{_entctx}, 'GetData');
  return Voxgig::Struct::clone($self->{_data});
}

sub match_set {
  my ($self, $args) = @_;
  if ($args) {
    $self->{_match} = ProjectNameHelpers::to_map(Voxgig::Struct::clone($args)) || {};
    $self->{_utility}{feature_hook}->($self->{_entctx}, 'SetMatch');
  }
  return;
}

# Returns the current match filter (any subset of EntityName fields).
sub match_get {
  my ($self) = @_;
  $self->{_utility}{feature_hook}->($self->{_entctx}, 'GetMatch');
  return Voxgig::Struct::clone($self->{_match});
}

# #LoadOp

# #ListOp

# #CreateOp

# #UpdateOp

# #RemoveOp

sub _run_op {
  my ($self, $ctx, $post_done) = @_;
  my $utility = $self->{_utility};

  my $out = eval {
    # #PrePoint-Hook

    my ($point, $point_err) = $utility->{make_point}->($ctx);
    $ctx->{out}{point} = $point;
    return $utility->{make_error}->($ctx, $point_err) if $point_err;

    # #PreSpec-Hook

    my ($spec, $spec_err) = $utility->{make_spec}->($ctx);
    $ctx->{out}{spec} = $spec;
    return $utility->{make_error}->($ctx, $spec_err) if $spec_err;

    # #PreRequest-Hook

    my ($resp, $req_err) = $utility->{make_request}->($ctx);
    $ctx->{out}{request} = $resp;
    return $utility->{make_error}->($ctx, $req_err) if $req_err;

    # #PreResponse-Hook

    my ($resp2, $res_err) = $utility->{make_response}->($ctx);
    $ctx->{out}{response} = $resp2;
    return $utility->{make_error}->($ctx, $res_err) if $res_err;

    # #PreResult-Hook

    my ($result, $result_err) = $utility->{make_result}->($ctx);
    $ctx->{out}{result} = $result;
    return $utility->{make_error}->($ctx, $result_err) if $result_err;

    # #PreDone-Hook

    $post_done->();

    $utility->{done}->($ctx);
  };
  if (my $operr = $@) {
    # #PreUnexpected-Hook

    die $operr;
  }
  return $out;
}

1;
