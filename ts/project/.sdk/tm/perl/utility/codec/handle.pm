# ProjectName SDK body codec: handle

use strict;
use warnings;

use File::Basename ();
use Cwd ();

my $__dir;
BEGIN { $__dir = File::Basename::dirname(Cwd::abs_path(__FILE__)) }
require(Cwd::abs_path("$__dir/../media.pm"));

# An entity's named bytes. Each call is one run of the entity's own
# operation on the slot's point; in core only whole, in-memory bodies move.
# A slot, as the entity component derived it from the model, is the action
# whose points move its bytes ('' for the entity's own) and the operations
# that read and write them: `{ action, read?, write? }`.
package ProjectNameBinaryHandle;

sub new {
  my ($class, $entity, $slots, $slot) = @_;
  $slot = defined $slot ? "$slot" : '';
  return bless {
    entity => $entity,
    slot => $slot,
    def => (exists $slots->{$slot} ? $slots->{$slot} : undef),
  }, $class;
}

sub name { $_[0]->{slot} }

# The whole body, within maxBuffer.
sub bytes {
  my ($self, $opts, $ctrl) = @_;
  die $self->_inactive('read a range') if ref $opts eq 'HASH' && defined $opts->{range};
  my $def = $self->_direction('read');
  my $transfer = { slot => $self->{slot}, direction => 'read' };
  my $op = $def->{read};
  $self->{entity}->$op($self->_select($def), { %{ $ctrl || {} }, transfer => $transfer });
  return defined $transfer->{bytes} ? $transfer->{bytes} : '';
}

# Sends in-memory content as the slot's body; answers the entity.
sub put {
  my ($self, $source, $ctrl) = @_;
  my $def = $self->_direction('write');
  my $transfer = { slot => $self->{slot}, direction => 'write' };
  my $op = $def->{write};
  $self->{entity}->$op({ %{ $self->_select($def) }, $ProjectNameUtilities::RAW_BODY => $source },
    { %{ $ctrl || {} }, transfer => $transfer });
  return $self->{entity};
}

sub save { die $_[0]->_inactive('save') }

sub stream { die $_[0]->_inactive('stream') }

sub open { die $_[0]->_inactive('open') }

sub _select {
  my ($self, $def) = @_;
  return '' eq $def->{action} ? {} : { '$action' => $def->{action} };
}

sub _direction {
  my ($self, $way) = @_;
  my $def = $self->{def};
  my $name = $self->{entity}->get_name;
  die $self->_error('binary_slot_unknown',
    "Entity \"$name\" has no binary slot \"$self->{slot}\".") unless defined $def;
  die $self->_error('binary_slot_direction', "The binary slot \"$self->{slot}\" of entity \""
    . $name . '" cannot be ' . ('read' eq $way ? 'read' : 'written') . '.')
    unless defined $def->{$way};
  return $def;
}

sub _inactive {
  my ($self, $what) = @_;
  return $self->_error('binary_feature_inactive', "The binary slot \"$self->{slot}\" of entity \""
    . $self->{entity}->get_name . "\" cannot $what without the binary feature; in core it "
    . 'answers bytes() and put().');
}

sub _error {
  my ($self, $code, $msg) = @_;
  return $self->{entity}{_entctx}->make_error($code, $msg);
}

1;
