# ProjectName SDK concurrency test
#
# Requests in flight at once on one client. Each resolves its operation
# through the cache the client's root context shares with every request, and
# registers and cleans secrets through the one registry the client holds.

import sys
import threading

from projectname_sdk import ProjectNameSDK


ROUNDS = 50
WIDTH = 8
OPS = 32
MASKED = "a [redacted] b [redacted] c"


# Runs body on WIDTH threads released together, and returns what they raised.
def _at_once(body):
    start = threading.Barrier(WIDTH)
    raised = []

    def run(n):
        try:
            start.wait()
            body(n)
        except BaseException as err:
            raised.append(err)

    threads = [threading.Thread(target=run, args=(n,)) for n in range(WIDTH)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return raised


class TestConcurrency:

    # Threads switch as often as the interpreter allows, so a race a few
    # bytecodes wide has room to show.
    def setup_method(self):
        self._interval = sys.getswitchinterval()
        sys.setswitchinterval(1e-6)

    def teardown_method(self):
        sys.setswitchinterval(self._interval)

    def test_concurrent_resolutions_share_one_cached_operation(self):
        for rnd in range(ROUNDS):
            client = ProjectNameSDK.test(None, None)
            utility = client.get_utility()
            root = client.get_root_ctx()
            ops = [[None] * OPS for _ in range(WIDTH)]

            def resolve(n):
                for k in range(OPS):
                    ops[n][k] = utility.make_context({"opname": "op%d" % k}, root).op

            raised = _at_once(resolve)

            assert [] == raised, "round %d raised: %r" % (rnd, raised)
            for k in range(OPS):
                cached = utility.make_context({"opname": "op%d" % k}, root).op
                for n in range(WIDTH):
                    assert ops[n][k] is cached, \
                        "round %d: op%d resolved to more than one Operation" % (rnd, k)

    # Secrets registered on some threads while others clean: every clean
    # masks what was registered before it, the longer secret whole, and no
    # registration is lost.
    def test_concurrent_registration_keeps_every_secret_masked(self):
        for rnd in range(ROUNDS // 4):
            client = ProjectNameSDK.test(None, None)
            utility = client.get_utility()
            root = client.get_root_ctx()
            inner = "INNER-SECRET-%d" % rnd
            utility.clean_add(root, inner)
            utility.clean_add(root, "OUTER-" + inner + "-TAIL")
            text = "a " + inner + " b OUTER-" + inner + "-TAIL c"
            assert MASKED == utility.clean(root, text)

            lock = threading.Lock()
            registering = [WIDTH // 2]
            registered = threading.Event()
            wrong = []

            def work(n):
                if n < WIDTH // 2:
                    try:
                        for k in range(OPS):
                            utility.clean_add(root, "ADDED-SECRET-%d-%d-%d" % (rnd, n, k))
                    finally:
                        with lock:
                            registering[0] -= 1
                            if 0 == registering[0]:
                                registered.set()
                    return
                while not registered.is_set():
                    got = utility.clean(root, text)
                    if MASKED != got:
                        wrong.append(got)
                        return

            raised = _at_once(work)

            assert [] == raised, "round %d raised: %r" % (rnd, raised)
            assert [] == wrong, "round %d cleaned to: %r" % (rnd, wrong)
            for n in range(WIDTH // 2):
                for k in range(OPS):
                    added = "ADDED-SECRET-%d-%d-%d" % (rnd, n, k)
                    assert "[redacted]" == utility.clean(root, added), \
                        "round %d: %s was registered but not masked" % (rnd, added)
