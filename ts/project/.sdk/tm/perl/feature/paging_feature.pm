# ProjectName SDK paging feature
#
# Pagination support for list operations. On the way out (PreRequest) it
# stamps page/limit (or a cursor) into the request query; on the way back
# (PreResult) it reads the server's pagination signals - a Link rel="next"
# header, X-Page/X-Next-Page/X-Total-Count headers, or next/cursor/
# nextCursor/hasMore fields in the body - and records them on
# result.paging. A per-call ctrl paging value (page or cursor) takes
# priority. Parameter names ("pageParam", "limitParam", "cursorParam"),
# "startPage" (default 1) and page size ("limit") are configurable.

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/base_feature.pm"));

package ProjectNamePagingFeature;

our @ISA = ('ProjectNameBaseFeature');

sub new {
  my ($class) = @_;
  my $self = ProjectNameBaseFeature::new($class);
  $self->{version} = '0.0.1';
  $self->{name} = 'paging';
  # Inactive until init (feature_init only fires init when active).
  $self->{active} = 0;
  $self->{client} = undef;
  $self->{options} = {};
  return $self;
}

sub init {
  my ($self, $ctx, $options) = @_;
  $self->{client} = $ctx->{client};
  $self->{options} = Voxgig::Struct::ismap($options) ? $options : {};
  $self->{active} = ProjectNameHelpers::is_true($self->{options}{active});
  return;
}

sub PreRequest {
  my ($self, $ctx) = @_;
  return unless $self->{active};
  return unless $self->_list($ctx);
  my $spec = $ctx->{spec};
  return unless $spec;
  $spec->{query} = {} unless defined $spec->{query};

  my $page_param = defined $self->{options}{pageParam} ? $self->{options}{pageParam} : 'page';
  my $limit_param = defined $self->{options}{limitParam} ? $self->{options}{limitParam} : 'limit';
  my $cursor_param = defined $self->{options}{cursorParam} ? $self->{options}{cursorParam} : 'cursor';

  # A per-call cursor/page from ctrl takes priority (used by auto-iteration).
  my $paging = {};
  if ($ctx->{ctrl} && Voxgig::Struct::ismap($ctx->{ctrl}{paging})) {
    $paging = $ctx->{ctrl}{paging};
  }

  if (defined $paging->{cursor}) {
    $spec->{query}{$cursor_param} = $paging->{cursor};
  }
  elsif (!defined $spec->{query}{$page_param}) {
    $spec->{query}{$page_param} = defined $paging->{page}
      ? $paging->{page}
      : (defined $self->{options}{startPage} ? $self->{options}{startPage} : 1);
  }

  if (defined $self->{options}{limit} && !defined $spec->{query}{$limit_param}) {
    $spec->{query}{$limit_param} = $self->{options}{limit};
  }
  return;
}

sub PreResult {
  my ($self, $ctx) = @_;
  return unless $self->{active};
  return unless $self->_list($ctx);
  my $result = $ctx->{result};
  return unless $result;

  my $headers = $result->{headers} || {};
  my $body = $result->{body};

  my $paging = {
    'page' => $self->_num($self->_header($headers, 'x-page')),
    'totalCount' => $self->_num($self->_header($headers, 'x-total-count')),
    'nextPage' => $self->_num($self->_header($headers, 'x-next-page')),
    'next' => undef,
    'cursor' => undef,
    'hasMore' => 0,
  };

  # Link: <...>; rel="next"
  my $link = $self->_header($headers, 'link');
  if (defined $link) {
    if ("$link" =~ /<([^>]+)>\s*;\s*rel="?next"?/i) {
      $paging->{next} = $1;
    }
  }

  # Body-level cursors.
  if (Voxgig::Struct::ismap($body)) {
    my $bnext = ProjectNameHelpers::gp($body, 'next');
    $paging->{next} = defined $paging->{next} ? $paging->{next} : $bnext
      if defined $bnext;
    my $bcursor = ProjectNameHelpers::gp($body, 'cursor');
    $paging->{cursor} = $bcursor if defined $bcursor;
    my $bnextcursor = ProjectNameHelpers::gp($body, 'nextCursor');
    $paging->{cursor} = $bnextcursor if defined $bnextcursor;
    my $bhasmore = $body->{hasMore};
    if (ProjectNameHelpers::is_true($bhasmore) || ProjectNameHelpers::is_false($bhasmore)) {
      $paging->{hasMore} = ProjectNameHelpers::is_true($bhasmore) ? 1 : 0;
    }
  }

  $paging->{hasMore} = ($paging->{hasMore}
    || defined $paging->{next} || defined $paging->{cursor}
    || defined $paging->{nextPage}) ? 1 : 0;

  $result->{paging} = $paging;

  $self->{client}{_paging} = { 'last' => $paging };
  return;
}

sub _list {
  my ($self, $ctx) = @_;
  my $ops = $self->{options}{ops} || ['list'];
  my $opname = $ctx->{op} ? $ctx->{op}{name} : undef;
  return (defined $opname && grep { "$_" eq $opname } @$ops) ? 1 : 0;
}

sub _header {
  my ($self, $headers, $name) = @_;
  my $lower = lc $name;
  for my $k (keys %$headers) {
    return $headers->{$k} if lc("$k") eq $lower;
  }
  return undef;
}

sub _num {
  my ($self, $v) = @_;
  return undef unless defined $v;
  return int($v) if "$v" =~ /^-?[0-9]+$/;
  return 0 + $v if Scalar::Util::looks_like_number("$v");
  return undef;
}

1;
