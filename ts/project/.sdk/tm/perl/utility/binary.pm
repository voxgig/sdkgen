# ProjectName SDK utility: binary

use strict;
use warnings;

use File::Basename ();
use Cwd ();
use Scalar::Util ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../lib/Voxgig/Struct.pm"));
require(Cwd::abs_path("$__dir/../core/helpers.pm"));
require(Cwd::abs_path("$__dir/media.pm"));


# File content a caller hands the SDK, held as bytes. A character string is
# content, held as its UTF-8: nothing here reads a path.
package ProjectNameBinarySource;

sub new {
  my ($class, $data, $opts) = @_;
  $opts = {} unless ref $opts eq 'HASH';
  my $self = bless {
    kind => 'bytes',
    data => ProjectNameBinary::to_bytes($data),
  }, $class;
  $self->{name} = $opts->{name} if defined $opts->{name} && !ref $opts->{name};
  $self->{type} = $opts->{type}
    if defined $opts->{type} && !ref $opts->{type} && '' ne $opts->{type};
  return $self;
}

sub data { $_[0]->{data} }
sub name { $_[0]->{name} }
sub type { $_[0]->{type} }
sub size { length $_[0]->{data} }

# A source serialised anywhere is described, never copied.
sub TO_JSON {
  my ($self) = @_;
  my $desc = { 'binary$' => 'bytes', 'size' => $self->size };
  $desc->{type} = $self->{type} if defined $self->{type};
  return $desc;
}


# The one source core builds: `$client->binary->bytes($data, { name, type })`.
package ProjectNameBinary;

sub bytes {
  my ($class, $data, $opts) = @_;
  return ProjectNameBinarySource->new($data, $opts);
}

sub to_bytes {
  my ($value) = @_;
  return '' unless defined $value;
  my $bytes = "$value";
  utf8::encode($bytes) if utf8::is_utf8($bytes);
  return $bytes;
}


package ProjectNameUtilities;

my $MAXDEPTH = 32;

sub is_source {
  my ($value) = @_;
  return Scalar::Util::blessed($value) && $value->isa('ProjectNameBinarySource') ? 1 : 0;
}

sub is_stream_value {
  my ($value) = @_;
  return 0 unless ref $value;
  my $type = Scalar::Util::reftype($value) // '';
  return 1 if 'GLOB' eq $type || 'IO' eq $type;
  return Scalar::Util::blessed($value) && $value->can('read') ? 1 : 0;
}

# The path of the first source in a value, or undef.
sub _source_at {
  my ($value, $path, $depth, $seen) = @_;
  return undef unless ref $value;
  return $path if is_source($value);
  return undef if $MAXDEPTH <= $depth || is_stream_value($value);
  my $type = Scalar::Util::reftype($value) // '';
  return undef unless 'HASH' eq $type || 'ARRAY' eq $type;
  my $addr = Scalar::Util::refaddr($value);
  return undef if $seen->{$addr}++;
  my @keys = 'ARRAY' eq $type ? (0 .. $#$value) : Voxgig::Struct::_map_keys($value);
  for my $key (@keys) {
    my $item = 'ARRAY' eq $type ? $value->[$key] : $value->{$key};
    my $found = _source_at($item, '' eq $path ? "$key" : "$path.$key", $depth + 1, $seen);
    return $found if defined $found;
  }
  return undef;
}

# The data keys whose values are file content: a multipart or form body's
# binary fields, and the whole of a raw body.
sub binary_names {
  my ($point) = @_;
  my $body = ProjectNameHelpers::gp($point, 'body');
  my $kind = ProjectNameHelpers::gp($body, 'kind');
  return () unless defined $kind && !ref $kind;
  return ($ProjectNameUtilities::RAW_BODY) if 'raw' eq $kind;
  return () unless 'multipart' eq $kind || 'form' eq $kind;
  my $fields = ProjectNameHelpers::gp($body, 'fields');
  return map { ProjectNameHelpers::gp($_, 'name') }
    grep {
      my $name = ProjectNameHelpers::gp($_, 'name');
      ProjectNameHelpers::is_true(ProjectNameHelpers::gp($_, 'binary'))
        && defined $name && !ref $name;
    } (Voxgig::Struct::islist($fields) ? @$fields : ());
}

# Moves the values of binary fields out of the request data, before a hook,
# a transform, validation or clean reads it. A source anywhere else is
# refused: answers the error, else undef.
sub lift_sources {
  my ($ctx) = @_;
  return undef if defined $ctx->{sources};

  my @names = binary_names($ctx->{point});
  my $lifted = {};
  my $reqdata = $ctx->{reqdata};

  if (Voxgig::Struct::ismap($reqdata) && grep { exists $reqdata->{$_} } @names) {
    $reqdata = { %$reqdata };
    for my $name (@names) {
      $lifted->{$name} = delete $reqdata->{$name} if exists $reqdata->{$name};
    }
  }

  my $stray = _source_at($reqdata, '', 0, {}) // _source_at($ctx->{reqmatch}, '', 0, {});
  if (defined $stray) {
    return $ctx->make_error('binary_source_refused', 'A binary source was passed in "'
      . $stray . '", which is not a field the operation declares binary.');
  }

  $ctx->{reqdata} = $reqdata;
  $ctx->{sources} = $lifted;
  return undef;
}

# A response the model declares to be bytes is read only through the
# entity's binary handle, never into its data.
sub bytes_refused {
  my ($ctx) = @_;
  my $response = ProjectNameHelpers::gp($ctx->{point}, 'response');
  my $kind = ProjectNameHelpers::gp($response, 'kind');
  return undef unless defined $kind && 'raw' eq $kind
    && ProjectNameHelpers::is_true(ProjectNameHelpers::gp($response, 'binary'))
    && !defined $ctx->{ctrl}{transfer};
  my $action = ProjectNameHelpers::gp(ProjectNameHelpers::gp($ctx->{point}, 'select'), '$action');
  my $call = defined $action ? "binary('$action')" : 'binary()';
  my $op = $ctx->{op} || {};
  return $ctx->make_error('binary_sink_required', 'Operation "' . ($op->{name} // '')
    . '" on entity "' . ($op->{entity} // '') . '" answers bytes, which never enter the '
    . "entity's data: read them with \$entity->$call->bytes().");
}

# A plain value as the text of a form pair or a multipart part.
sub item_text {
  my ($value) = @_;
  return Voxgig::Struct::is_jbool($value) ? ($$value ? 'true' : 'false') : 'null'
    if Voxgig::Struct::is_jbool($value) || Voxgig::Struct::is_jnull($value);
  return "$value" unless ref $value;
  return Voxgig::Struct::jsonify($value, { indent => 0 });
}

# The values a form or multipart body carries, in wire order: the fields the
# model declares, in its order, then any other key of the data, in code point
# order. An array repeats its field per item, or is one value joined by the
# field's `join`; an absent or null value sends nothing.
sub body_items {
  my ($body, $data, $lifted) = @_;
  my $fdefs = ProjectNameHelpers::gp($body, 'fields');
  my @fields = grep {
    my $n = ProjectNameHelpers::gp($_, 'name');
    defined $n && !ref $n;
  } (Voxgig::Struct::islist($fdefs) ? @$fdefs : ());
  my %declared = map { (ProjectNameHelpers::gp($_, 'name') => $_) } @fields;
  my $plain = Voxgig::Struct::ismap($data) ? $data : {};
  $lifted = {} unless ref $lifted eq 'HASH';

  my @names = (
    (grep { exists $plain->{$_} || exists $lifted->{$_} }
      map { ProjectNameHelpers::gp($_, 'name') } @fields),
    (sort grep { !exists $declared{$_} } keys %$plain),
  );

  my $absent = sub {
    my ($v) = @_;
    return !defined $v || Voxgig::Struct::is_jnull($v) || Voxgig::Struct::is_none($v);
  };

  my @items;
  for my $name (@names) {
    my $field = $declared{$name} || { name => $name };
    my $value = exists $lifted->{$name} ? $lifted->{$name} : $plain->{$name};
    my $file = ProjectNameHelpers::is_true(ProjectNameHelpers::gp($field, 'binary')) ? 1 : 0;
    next if $absent->($value);
    if (Voxgig::Struct::islist($value)) {
      my @present = grep { !$absent->($_) } @$value;
      my $join = ProjectNameHelpers::gp($field, 'join');
      if (!$file && defined $join && !ref $join) {
        push @items, { name => $name, field => $field, binary => $file,
          value => join($join, map { item_text($_) } @present) };
      }
      else {
        push @items, map { { name => $name, field => $field, binary => $file, value => $_ } }
          @present;
      }
    }
    else {
      push @items, { name => $name, field => $field, binary => $file, value => $value };
    }
  }
  return @items;
}

1;
