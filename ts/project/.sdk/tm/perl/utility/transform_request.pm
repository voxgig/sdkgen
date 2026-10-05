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

my $field_arg = sub {
  my ($ctx, $name) = @_;
  for my $kind (qw(header cookie query)) {
    my $defs = $ctx->{point} ? ProjectNameHelpers::gpath($ctx->{point}, "args.$kind") : undef;
    next unless Voxgig::Struct::islist($defs);
    for my $ad (@$defs) {
      my $n = ProjectNameHelpers::gp($ad, 'name');
      return 1 if defined $n && !ref $n && $n eq $name &&
        ProjectNameHelpers::rb_truthy(ProjectNameHelpers::gp($ad, 'field'));
    }
  }
  return 0;
};

# A header, cookie or query argument travels where prepare_headers or
# prepare_query sends it, so the body is built from the request data without
# it, unless the entity declares it as a field too.
my $routed_arg_names = sub {
  my ($ctx) = @_;
  return grep { !$field_arg->($ctx, $_) } map { $_->[0] } ProjectNameUtilities::call_args($ctx, 'header'),
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
