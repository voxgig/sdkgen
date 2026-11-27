# ProjectName SDK utility: op_key

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

# The custom action a call names: `$action` in its own request argument,
# never in a response.
sub op_action {
  my ($ctx) = @_;
  my $op = $ctx->{op} || {};
  my $input = $op->{input} // '';
  my $req = 'data' eq $input ? $ctx->{reqdata} : $ctx->{reqmatch};
  my $action = Voxgig::Struct::ismap($req) ? ProjectNameHelpers::gp($req, '$action') : undef;
  return (defined $action && !ref $action && '' ne $action) ? "$action" : undef;
}

# The keys an operation is looked up and filed by, most specific first:
# `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
sub op_keys {
  my ($ctx) = @_;
  my $op = $ctx->{op} || {};
  my $name = (defined $op->{name} && '' ne $op->{name}) ? $op->{name} : '_';
  my $entity = $op->{entity};
  if (!(defined $entity && '' ne $entity)) {
    my $e = $ctx->{entity};
    $entity = (Scalar::Util::blessed($e) && $e->can('get_name')) ? $e->get_name : undef;
  }
  my $base = ((defined $entity && '' ne $entity) ? $entity : '_') . '.' . $name;
  my $action = op_action($ctx);
  return defined $action ? ("$base:$action", $base, $name, '*') : ($base, $name, '*');
}

# The key a call is filed under where a consumer reads it: the first key,
# with the action cleaned as the `action` field of a record, so a sensitive
# key name masks it as well as a registered value.
sub op_file_key {
  my ($ctx) = @_;
  my @keys = op_keys($ctx);
  my $action = op_action($ctx);
  return $keys[0] unless defined $action;
  my $clean = $ctx->{utility} ? $ctx->{utility}{clean} : undef;
  my $out = ref $clean eq 'CODE' ? $clean->($ctx, { 'action' => $action }) : undef;
  my $cleaned = ref $out eq 'HASH' ? $out->{action} : undef;
  return $keys[1] . ':' . ((defined $cleaned && !ref $cleaned) ? $cleaned : $action);
}

1;
