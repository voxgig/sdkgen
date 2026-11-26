# ProjectName SDK utility: prepare_body

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/media.pm"));

package ProjectNameUtilities;

our %REGISTRY;

# A list, load or remove routed to a method with a body sends the match
# fields that body declares, never a path parameter, and never a header,
# cookie or query argument the body does not also declare as a field.
my $match_body = sub {
  my ($ctx, $fields) = @_;
  my $point = $ctx->{point};
  my $params = ProjectNameHelpers::gp($point, 'params');
  my %routed = map { defined $_ && !ref $_ ? ($_ => 1) : () }
    Voxgig::Struct::islist($params) ? @$params : ();
  for my $kind (qw(params header cookie query)) {
    my $defs = ProjectNameHelpers::gpath($point, "args.$kind");
    next unless Voxgig::Struct::islist($defs);
    for my $ad (@$defs) {
      next unless 'params' eq $kind || !ProjectNameHelpers::is_true(ProjectNameHelpers::gp($ad, 'field'));
      my $name = ProjectNameHelpers::gp($ad, 'name');
      $routed{$name} = 1 if defined $name && !ref $name;
    }
  }
  my $body = {};
  for my $name (@$fields) {
    next unless defined $name && !ref $name;
    next if '$action' eq $name || $routed{$name};
    my $val = ProjectNameHelpers::gp($ctx->{reqmatch} || {}, $name);
    $body->{$name} = $val if defined $val && !Voxgig::Struct::is_jnull($val);
  }
  return $body;
};

$REGISTRY{prepare_body} = sub {
  my ($ctx) = @_;
  if ('data' eq $ctx->{op}{input}) {
    return ProjectNameUtilities::raw_body($ctx->{reqdata})
      if ProjectNameUtilities::is_raw_request($ctx->{point});
    return $ctx->{utility}{transform_request}->($ctx);
  }
  my $fields = $ctx->{point} ? ProjectNameHelpers::gp($ctx->{point}, 'fields') : undef;
  return undef unless Voxgig::Struct::islist($fields) && @$fields;
  return $match_body->($ctx, $fields);
};

1;
