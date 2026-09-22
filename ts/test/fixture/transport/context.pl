use strict;
use warnings;
use Scalar::Util qw(refaddr);
require './core/context.pm';

my $root = DemoContext->new({config => {}});
my $entity = DemoContext->new({}, $root);
my $first = DemoContext->new({opname => 'list'}, $entity);
$first->{ctrl}{paging} = {cursor => 'first'};
my $second = DemoContext->new({opname => 'list'}, $entity);
die 'shared operation control' if refaddr($first->{ctrl}) == refaddr($second->{ctrl});
die 'root paging changed' if defined $root->{ctrl}{paging};
die 'paging leaked' if defined $second->{ctrl}{paging};
die 'nested control lost' unless refaddr(DemoContext->new({}, $first)->{ctrl}) == refaddr($first->{ctrl});
my $paging = {cursor => 'explicit'};
my $explicit = DemoContext->new({opname => 'list', ctrl => {paging => $paging}}, $entity);
die 'explicit paging lost' unless refaddr($explicit->{ctrl}{paging}) == refaddr($paging);
print "context: isolated defaults; explicit and nested controls preserved\n";
