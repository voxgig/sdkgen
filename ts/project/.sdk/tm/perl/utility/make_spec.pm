# ProjectName SDK utility: make_spec

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/../core/spec.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{make_spec} = sub {
  my ($ctx) = @_;

  if ($ctx->{out}{spec}) {
    $ctx->{spec} = $ctx->{out}{spec};
    return ($ctx->{spec}, undef);
  }

  my $point = $ctx->{point};
  my $options = $ctx->{options};
  my $utility = $ctx->{utility};

  my $base = ProjectNameHelpers::gp($options, 'base');
  $base = '' unless defined $base;
  my $prefix = ProjectNameHelpers::gp($options, 'prefix');
  $prefix = '' unless defined $prefix;
  my $suffix = ProjectNameHelpers::gp($options, 'suffix');
  $suffix = '' unless defined $suffix;

  my $parts = [];
  $parts = ProjectNameHelpers::gp($point, 'parts') if $point;
  $parts = [] unless Voxgig::Struct::islist($parts);

  $ctx->{spec} = ProjectNameSpec->new({
    'base' => $base, 'prefix' => $prefix, 'parts' => $parts,
    'suffix' => $suffix, 'step' => 'start',
  });

  $ctx->{spec}{method} = $utility->{prepare_method}->($ctx);

  my $allow_method = ProjectNameHelpers::gpath($options, 'allow.method');
  $allow_method = '' unless defined $allow_method && !ref $allow_method;
  unless (index($allow_method, $ctx->{spec}{method}) >= 0) {
    return (undef, $ctx->make_error('spec_method_allow',
      "Method \"$ctx->{spec}{method}\" not allowed by SDK option allow.method value: \"$allow_method\""));
  }

  $ctx->{spec}{params} = $utility->{prepare_params}->($ctx);
  $ctx->{spec}{query} = $utility->{prepare_query}->($ctx);
  $ctx->{spec}{headers} = $utility->{prepare_headers}->($ctx);
  $ctx->{spec}{body} = $utility->{prepare_body}->($ctx);
  $ctx->{spec}{path} = $utility->{prepare_path}->($ctx);

  $ctx->{ctrl}{explain}{spec} = $ctx->{spec} if $ctx->{ctrl}{explain};

  my ($spec, $err) = $utility->{prepare_auth}->($ctx);
  return (undef, $err) if $err;

  $ctx->{spec} = $spec;
  return ($spec, undef);
};

1;
