# VENDORED: @voxgig/omni 0.1.0 (perl/lib/Voxgig/Omni.pm)
# Source: https://github.com/voxgig/omni @ ef55ad0fa48470146a81a1d652c859b03ebab6fc  [tag: sdk-20261125-1959-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
package Voxgig::Omni;

# voxgig omni - shared multi-language test runner.

use strict;
use warnings;

use Voxgig::Omni::Util;
use Voxgig::Omni::Runner;

use Exporter 'import';
our @EXPORT_OK = qw(makeRunner);

our $VERSION = '0.1.0';

sub makeRunner {
    my ( $specref, $provider ) = @_;
    return Voxgig::Omni::Runner::makeRunner( $specref, $provider );
}

1;
