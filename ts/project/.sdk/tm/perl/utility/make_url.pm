# ProjectName SDK utility: make_url

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));

package ProjectNameUtilities;

our %REGISTRY;

$REGISTRY{make_url} = sub {
  my ($ctx) = @_;
  my $spec = $ctx->{spec};
  my $result = $ctx->{result};

  return ('', $ctx->make_error('url_no_spec',
    'Expected context spec property to be defined.')) unless $spec;
  return ('', $ctx->make_error('url_no_result',
    'Expected context result property to be defined.')) unless $result;

  my $url = Voxgig::Struct::join(
    [$spec->{base}, $spec->{prefix}, $spec->{path}, $spec->{suffix}], '/', 1);
  my $resmatch = {};

  # Sent with the request, never recorded as the entity's match.
  my %authquery = map { $_ => 1 } @{ $spec->{authquery} || [] };

  # A route the definition ends with a slash keeps it: a server such as a
  # Django REST one redirects or refuses the route without it.
  my $orig = $ctx->{point} ? ProjectNameHelpers::gp($ctx->{point}, 'orig') : undef;
  $url .= '/' if defined $orig && !ref $orig && $orig =~ m{/\z}
    && !(defined $spec->{suffix} && '' ne $spec->{suffix}) && $url !~ m{/\z};

  my $param_items = Voxgig::Struct::items($spec->{params});
  if ($param_items) {
    for my $item (@$param_items) {
      my ($key, $val) = @$item;
      if (ProjectNameHelpers::rb_truthy($val) && defined $key && !ref $key) {
        my $placeholder = '{' . $key . '}';
        my $encoded = Voxgig::Struct::escurl("$val");
        $url =~ s/\Q$placeholder\E/$encoded/g;
        $resmatch->{$key} = $val;
      }
    }
  }

  # Append query string from spec.query.
  my $qsep = '?';
  my $query_items = Voxgig::Struct::items($spec->{query});
  if ($query_items) {
    for my $item (@$query_items) {
      my ($key, $val) = @$item;
      if (ProjectNameHelpers::rb_truthy($val) && defined $key && !ref $key) {
        $url .= $qsep . Voxgig::Struct::escurl("$key") . '=' . Voxgig::Struct::escurl("$val");
        $qsep = '&';
        $resmatch->{$key} = $val unless $authquery{$key};
      }
    }
  }

  $result->{resmatch} = $resmatch;
  return ($url, undef);
};

1;
