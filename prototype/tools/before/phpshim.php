<?php
// A stand-in for PHPUnit's TestCase with the four assertions the generated
// ReadmeExamplesTest.php uses: it runs that file's own test_* methods with the
// real php binary. Usage (in a generated php SDK): php <this> test/ReadmeExamplesTest.php
namespace PHPUnit\Framework {
  class AssertionFailed extends \Exception {}
  class TestCase {
    public int $assertions = 0;
    private function check(bool $ok, string $msg): void { $this->assertions++; if (!$ok) throw new AssertionFailed($msg); }
    public function assertSame($e, $a, string $m = ''): void { $this->check($e === $a, $m . ' expected ' . var_export($e, true) . ' got ' . var_export($a, true)); }
    public function assertGreaterThan($e, $a, string $m = ''): void { $this->check($a > $e, $m . " expected > $e, got " . var_export($a, true)); }
    public function assertNotEmpty($a, string $m = ''): void { $this->check(!empty($a), $m . ' expected non-empty'); }
    public function assertFileExists(string $f, string $m = ''): void { $this->check(file_exists($f), $m . " missing $f"); }
    public function assertTrue($a, string $m = ''): void { $this->check($a === true, $m); }
    public function fail(string $m = ''): void { throw new AssertionFailed($m); }
  }
}
namespace {
  $file = realpath($argv[1]);
  require $file;
  $class = basename($file, '.php');
  $t = new $class();
  $fail = 0; $n = 0;
  foreach (get_class_methods($t) as $m) {
    if (strpos($m, 'test') !== 0) continue;
    $n++;
    try { $t->$m(); echo "ok $m\n"; }
    catch (\Throwable $e) { $fail++; echo "FAIL $m: " . substr($e->getMessage(), 0, 2000) . "\n"; }
  }
  echo "$n tests, {$t->assertions} assertions, $fail failures\n";
  exit($fail ? 1 : 0);
}
