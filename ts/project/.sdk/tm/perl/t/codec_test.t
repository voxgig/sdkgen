#!perl
# ProjectName SDK body codec test
#
# Every form, multipart and raw point this SDK has, driven through a real
# entity operation against a local listener that decodes what arrives. The
# cases come from the client's own config, so no case names an entity.

use strict;
use warnings;
use Test::More;
use FindBin;
use lib "$FindBin::Bin/../lib";
use IO::Socket::INET ();
use JSON::PP ();
use Scalar::Util ();
use POSIX ();

use ProjectNameSDK;

my $PROBE = ProjectNameSDK->new({ 'base' => 'http://127.0.0.1:1' });
my $CONFIG = $PROBE->get_root_ctx->{config};

sub accessors {
  my ($client) = @_;
  my %out;
  no strict 'refs';
  for my $sym (sort keys %{ ref($client) . '::' }) {
    next unless $sym =~ /^[A-Z]/ && defined &{ ref($client) . "::$sym" };
    my $ent = eval { $client->$sym() };
    next unless Scalar::Util::blessed($ent) && $ent->can('get_name');
    my $name = $ent->get_name;
    $out{$name} = $sym if defined $name && $CONFIG->{entity}{$name};
  }
  return \%out;
}

# A value for each path parameter a point names.
sub params {
  my ($point) = @_;
  my %out;
  for my $part (@{ $point->{parts} || [] }) {
    $out{$1} = 'p1' if defined $part && !ref $part && $part =~ /\A\{(.+)\}\z/;
  }
  return \%out;
}

sub action_of {
  my ($point) = @_;
  return ref $point->{select} eq 'HASH' ? $point->{select}{'$action'} : undef;
}

sub select_of {
  my ($point) = @_;
  my $action = action_of($point);
  return defined $action ? { '$action' => $action } : {};
}

sub content { return "file:$_[0]\x00\xff\r\n--" }

sub truthy { return $_[0] ? 1 : 0 }

# The data a form or multipart point is sent, and the parts it must arrive as.
sub plan_for {
  my ($client, $body) = @_;
  my (%data, @expect);
  my $form = 'form' eq $body->{kind};
  for my $field (@{ $body->{fields} || [] }) {
    my $name = $field->{name};
    if (truthy($field->{binary})) {
      my $type = $form ? undef : ($field->{media} // 'application/octet-stream');
      $data{$name} = $client->binary->bytes(content($name),
        { name => "/local/dir/$name.bin", type => $type });
      push @expect, $form ? { name => $name, value => content($name) }
        : { name => $name, file => content($name), filename => "$name.bin", type => $type };
    }
    elsif (truthy($field->{list})) {
      $data{$name} = ['a', 'b c'];
      push @expect, { name => $name, value => 'a' }, { name => $name, value => 'b c' };
    }
    elsif (defined $field->{join} && !ref $field->{join}) {
      $data{$name} = ['a', 'b'];
      push @expect, { name => $name, value => 'a' . $field->{join} . 'b' };
    }
    else {
      $data{$name} = "v\"$name\r\n";
      push @expect, { name => $name, value => "v\"$name\r\n" };
    }
  }
  return (\%data, \@expect);
}

sub multipart_parts {
  my ($arrived) = @_;
  my $type = $arrived->{headers}{'content-type'} // '';
  my ($boundary) = $type =~ /boundary=([^;]+)/;
  die "no boundary in $type\n" unless defined $boundary;
  my $text = $arrived->{body};
  die "the body does not close\n" unless $text =~ /\Q--$boundary--\E\r\n\z/;
  my @chunks = split /\Q--$boundary\E/, $text, -1;
  my @parts;
  for my $chunk (@chunks[1 .. $#chunks - 1]) {
    my $at = index($chunk, "\r\n\r\n");
    my $head = substr($chunk, 2, $at - 2);
    my $body = substr($chunk, $at + 4, length($chunk) - $at - 6);
    my @lines = split /\r\n/, $head;
    my ($name, $filename) = map {
      /\AContent-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?\z/ ? ($1, $2) : ()
    } @lines;
    die "a part without a disposition: $head\n" unless defined $name;
    my ($ctype) = map { /\AContent-Type: (.*)\z/ ? ($1) : () } @lines;
    push @parts, defined $filename
      ? { name => $name, file => $body, filename => $filename, type => $ctype }
      : { name => $name, value => $body };
  }
  return @parts;
}

sub form_pairs {
  my ($text) = @_;
  return map {
    my ($n, $v) = map { (my $s = $_) =~ tr/+/ /; $s =~ s/%([0-9A-Fa-f]{2})/chr(hex $1)/ge; $s }
      split /=/, $_, 2;
    { name => $n, value => $v // '' }
  } grep { length } split /&/, $text;
}

# One listener per request: a child that answers one connection with the
# given answer and reports what arrived through a pipe.
sub serve {
  my ($answer) = @_;
  my $listen = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => 0,
    Listen => 1, Proto => 'tcp', ReuseAddr => 1) or die "listen: $!";
  my $port = $listen->sockport;
  pipe(my $rd, my $wr) or die "pipe: $!";
  my $pid = fork();
  die "fork: $!" unless defined $pid;
  if (0 == $pid) {
    close $rd;
    my $conn = $listen->accept;
    my $head = '';
    while ($head !~ /\r\n\r\n/) {
      my $n = sysread($conn, my $buf, 1);
      last unless $n;
      $head .= $buf;
    }
    my ($line, @lines) = split /\r\n/, $head;
    my %headers = map { my ($k, $v) = split /:\s*/, $_, 2; (lc $k => $v) } grep { length } @lines;
    my $body = '';
    my $len = $headers{'content-length'} // 0;
    while (length $body < $len) {
      my $n = sysread($conn, my $buf, $len - length $body);
      last unless $n;
      $body .= $buf;
    }
    my $out = $answer->{body} // '';
    print {$conn} 'HTTP/1.1 ' . ($answer->{status} // 200) . " OK\r\n"
      . 'Content-Type: ' . ($answer->{type} // 'application/json') . "\r\n"
      . 'Content-Length: ' . length($out) . "\r\nConnection: close\r\n\r\n" . $out;
    close $conn;
    print {$wr} JSON::PP->new->latin1->encode({ line => $line, headers => \%headers,
      body => $body });
    close $wr;
    POSIX::_exit(0);
  }
  close $wr;
  close $listen;
  return {
    base => "http://127.0.0.1:$port",
    arrived => sub {
      local $/;
      my $json = <$rd>;
      close $rd;
      waitpid($pid, 0);
      die "nothing arrived\n" unless defined $json && length $json;
      return JSON::PP->new->latin1->decode($json);
    },
    stop => sub { kill 'TERM', $pid; waitpid($pid, 0) },
  };
}

sub client_for {
  my ($net) = @_;
  return ProjectNameSDK->new({ 'base' => $net->{base} });
}

sub same {
  my ($got, $want, $label) = @_;
  is_deeply($got, $want, $label) or die "$label\n";
}

sub cases {
  my @out;
  my $acc = accessors($PROBE);
  for my $ename (sort keys %{ $CONFIG->{entity} }) {
    my $accessor = $acc->{$ename};
    next unless defined $accessor;
    my $ops = $CONFIG->{entity}{$ename}{op} || {};
    for my $opname (sort keys %$ops) {
      for my $point (@{ $ops->{$opname}{points} || [] }) {
        my $action = action_of($point);
        my $label = "$ename.$opname" . (defined $action ? ":$action" : '');
        my $rb = $point->{body};
        my $rs = $point->{response};
        my $writes = grep { $_ eq $opname } qw(create update patch);

        if (ref $rb eq 'HASH' && $writes && ($rb->{kind} // '') =~ /\A(?:form|multipart)\z/) {
          push @out, { name => "$label sends a $rb->{kind} body", run => sub {
            my $net = serve({ body => '{"id":"p1"}' });
            my $client = client_for($net);
            my ($data, $expect) = plan_for($client, $rb);
            $client->$accessor()->$opname({ %{ params($point) }, %{ select_of($point) }, %$data });
            my $arrived = $net->{arrived}->();
            my %want = map { ($_->{name} => 1) } @$expect;
            if ('form' eq $rb->{kind}) {
              same($arrived->{headers}{'content-type'}, $rb->{media}, "$label: content type");
              same([grep { $want{ $_->{name} } } form_pairs($arrived->{body})],
                [map { { name => $_->{name}, value => $_->{value} } } @$expect],
                "$label: form pairs");
            }
            else {
              same([grep { $want{ $_->{name} } } multipart_parts($arrived)], $expect,
                "$label: multipart parts");
            }
          } };
        }

        if (ref $rb eq 'HASH' && $writes && 'raw' eq ($rb->{kind} // '')) {
          my $binary = truthy($rb->{binary});
          push @out, { name => "$label sends a raw " . ($binary ? 'binary' : 'text') . ' body',
            run => sub {
            my $net = serve({ body => '{"id":"p1"}' });
            my $client = client_for($net);
            my $ent = $client->$accessor();
            $ent->data_set(params($point));
            $ent->match_set(params($point));
            if ($binary) {
              my $got = $ent->binary($action)->put(
                $client->binary->bytes(content($label), { type => $rb->{media} }));
              same(Scalar::Util::refaddr($got), Scalar::Util::refaddr($ent),
                "$label: put answers the entity");
              same($net->{arrived}->()->{body}, content($label), "$label: the bytes arrive");
            }
            else {
              $ent->$opname({ %{ select_of($point) }, '$body' => "text \"$label\"\n" });
              same($net->{arrived}->()->{body}, "text \"$label\"\n", "$label: the text arrives");
            }
          } };
        }

        if (ref $rs eq 'HASH' && 'load' eq $opname && 'raw' eq ($rs->{kind} // '')) {
          my $binary = truthy($rs->{binary});
          push @out, { name => "$label reads a raw " . ($binary ? 'binary' : 'text') . ' body',
            run => sub {
            if ($binary) {
              my $net = serve({ type => $rs->{media}, body => content($label) });
              my $ent = client_for($net)->$accessor();
              $ent->data_set(params($point));
              $ent->match_set(params($point));
              same($ent->binary($action)->bytes, content($label), "$label: the bytes");
              $net->{arrived}->();
              my $refused = eval { $ent->load({ %{ params($point) }, %{ select_of($point) } }); 1 }
                ? undef : $@;
              same(Scalar::Util::blessed($refused) ? $refused->code : "$refused",
                'binary_sink_required', "$label: a plain load is refused");
            }
            else {
              my $text = "caf\xc3\xa9 $label";
              my $net = serve({ type => $rs->{media}, body => $text });
              my $ent = client_for($net)->$accessor();
              my $got = $ent->load({ %{ params($point) }, %{ select_of($point) } });
              $net->{arrived}->();
              same(Scalar::Util::refaddr($got), Scalar::Util::refaddr($ent),
                "$label: load answers the entity");
              my $want = $text;
              utf8::decode($want);
              same($ent->data_get->{'$body'}, $want, "$label: the text");
            }
          } };
        }
      }
    }
  }
  return @out;
}

my @CASES = cases();
my ($ran, $failed) = (0, 0);

ok(0 < @CASES, 'this SDK has a point to drive');

for my $kase (@CASES) {
  $ran++;
  subtest $kase->{name} => sub {
    my $ok = eval { $kase->{run}->(); 1 };
    unless ($ok) {
      $failed++;
      fail($kase->{name} . ': ' . ($@ // 'failed'));
    }
    pass($kase->{name}) if $ok;
  };
}

note("codec: ran $ran case(s), $failed failed");

done_testing();
