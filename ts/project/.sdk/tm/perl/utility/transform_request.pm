# ProjectName SDK utility: transform_request

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/param.pm"));

package ProjectNameUtilities;

our %REGISTRY;

# `$action` selects the point (see make_point); it is never an API field, so
# the body is a copy without it. The caller's hash is left untouched.
my $omit = sub {
  my ($reqdata, @names) = @_;
  return $reqdata unless 'HASH' eq ref $reqdata && grep { exists $reqdata->{$_} } @names;
  my %body = %$reqdata;
  delete @body{@names};
  return \%body;
};

my $strip_action = sub { $omit->($_[0], '$action') };

# A header or query argument travels where prepare_headers or prepare_query
# sends it, so the body is built from the request data without it.
my $routed_arg_names = sub {
  my ($ctx) = @_;
  return map { $_->[0] } ProjectNameUtilities::call_args($ctx, 'header'),
    ProjectNameUtilities::call_args($ctx, 'cookie'), ProjectNameUtilities::call_args($ctx, 'query');
};

$REGISTRY{transform_request} = sub {
  my ($ctx) = @_;
  my $spec = $ctx->{spec};
  my $point = $ctx->{point};
  $spec->{step} = 'reqform' if $spec;
  my $data = $omit->($ctx->{reqdata}, $routed_arg_names->($ctx));
  my $transform = ProjectNameHelpers::to_map(ProjectNameHelpers::gp($point, 'transform'));
  return $strip_action->($data) unless $transform;
  my $reqform = ProjectNameHelpers::gp($transform, 'req');
  return $strip_action->($data) unless ProjectNameHelpers::rb_truthy($reqform);
  return $strip_action->(Voxgig::Struct::transform({ 'reqdata' => $data }, $reqform));
};

1;
