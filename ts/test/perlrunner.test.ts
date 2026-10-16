import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import Path from 'node:path'
import { spawnSync } from 'node:child_process'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// The entity, as a generated perl SDK builds one: a blessed hash whose
// context refers back to it.
const PROBE = `
my $tm = shift;
require "$tm/perl/t/runner.pm";
package Ent;
sub new {
  my ($c, $d) = @_;
  my $s = bless { _data => $d }, $c;
  $s->{_ctx} = { entity => $s };
  return $s;
}
sub data_get { return $_[0]{_data} }
package main;
my $out = ProjectNameTestRunner::entity_list_to_data(
  [ Ent->new({ id => 'e1' }), { id => 'p2' } ]);
print join(',', map {
  (Scalar::Util::blessed($_) // 'plain') . ':' . ($_->{id} // '-') } @$out), "\\n";
`


describe('perl test runner', () => {

  test('entity_list_to_data takes the data hop for an entity', (t) => {
    const ran = spawnSync('perl', ['-e', PROBE, TM],
      { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' })

    if (null != ran.error) {
      return t.skip('no perl here')
    }

    strictEqual(ran.status, 0, ran.stdout + ran.stderr)

    // perl's ismap accepts a blessed hash, so an entity read as a map
    // reaches select whole and no list check ever finds its record.
    strictEqual(ran.stdout.trim(), 'plain:e1,plain:p2')
  })
})
