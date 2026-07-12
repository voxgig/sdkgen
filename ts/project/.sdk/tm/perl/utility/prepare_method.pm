# ProjectName SDK utility: prepare_method

use strict;
use warnings;

package ProjectNameUtilities;

our %REGISTRY;

my %METHOD_MAP = (
  'create' => 'POST',
  'update' => 'PUT',
  'load'   => 'GET',
  'list'   => 'GET',
  'remove' => 'DELETE',
  'patch'  => 'PATCH',
);

$REGISTRY{prepare_method} = sub {
  my ($ctx) = @_;
  my $m = $METHOD_MAP{ $ctx->{op}{name} };
  return defined $m ? $m : 'GET';
};

1;
