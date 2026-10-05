package JAVAPACKAGE.sdktest;

// Requests in flight at once on one client. Each resolves its operation
// through the cache the client's root context shares with every request, and
// registers and cleans secrets through the one registry the client holds.

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.function.BiFunction;
import java.util.function.IntConsumer;
import java.util.function.Supplier;

import org.junit.jupiter.api.Test;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Operation;
import JAVAPACKAGE.core.ProjectNameSDK;
import JAVAPACKAGE.core.Utility;

public class ConcurrencyTest {

  static final int ROUNDS = 200;
  static final int WIDTH = 8;
  static final int OPS = 32;

  static Map<String, Object> map(Object... kv) {
    Map<String, Object> out = new LinkedHashMap<>();
    for (int i = 0; i + 1 < kv.length; i += 2) {
      out.put((String) kv[i], kv[i + 1]);
    }
    return out;
  }

  // A live client whose transport answers at once.
  static ProjectNameSDK liveClient() {
    BiFunction<String, Map<String, Object>, Map<String, Object>> fetch =
        (url, fetchdef) -> map(
            "status", 200,
            "statusText", "OK",
            "headers", new LinkedHashMap<String, Object>(),
            "json", (Supplier<Object>) () -> map("ok", true));
    return new ProjectNameSDK(map(
        "base", "http://concurrency.test/api",
        "allow", map("op", "direct"),
        "system", map("fetch", fetch)));
  }

  // Runs body on WIDTH threads released together, and returns what they threw.
  static List<Throwable> atOnce(IntConsumer body) throws InterruptedException {
    CyclicBarrier start = new CyclicBarrier(WIDTH);
    ConcurrentLinkedQueue<Throwable> thrown = new ConcurrentLinkedQueue<>();
    List<Thread> threads = new ArrayList<>();
    for (int i = 0; i < WIDTH; i++) {
      final int n = i;
      Thread thread = new Thread(() -> {
        try {
          start.await();
          body.accept(n);
        }
        catch (Throwable t) {
          thrown.add(t);
        }
      });
      thread.start();
      threads.add(thread);
    }
    for (Thread thread : threads) {
      thread.join();
    }
    return new ArrayList<>(thrown);
  }

  @Test
  public void concurrentFirstRequestsSucceed() throws InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      // A fresh client each round, so every request in it is a first request.
      ProjectNameSDK client = liveClient();
      List<Map<String, Object>> results = new ArrayList<>();
      for (int n = 0; n < WIDTH; n++) {
        results.add(null);
      }
      List<Throwable> thrown = atOnce(n -> results.set(n, client.direct(map("path", "p" + n))));

      assertTrue(thrown.isEmpty(), "round " + round + " threw: " + thrown);
      for (int n = 0; n < WIDTH; n++) {
        Map<String, Object> res = results.get(n);
        assertEquals(true, null == res ? null : res.get("ok"),
            "round " + round + ", request " + n + " failed: " + res);
      }
    }
  }

  @Test
  public void concurrentResolutionsShareOneCachedOperation() throws InterruptedException {
    for (int round = 0; round < ROUNDS; round++) {
      ProjectNameSDK client = liveClient();
      Utility utility = client.getUtility();
      Context root = client.getRootCtx();
      Operation[][] ops = new Operation[WIDTH][OPS];
      List<Throwable> thrown = atOnce(n -> {
        for (int k = 0; k < OPS; k++) {
          ops[n][k] = utility.makeContext.apply(map("opname", "op" + k), root).op;
        }
      });

      assertTrue(thrown.isEmpty(), "round " + round + " threw: " + thrown);
      for (int k = 0; k < OPS; k++) {
        Operation cached = utility.makeContext.apply(map("opname", "op" + k), root).op;
        for (int n = 0; n < WIDTH; n++) {
          assertSame(cached, ops[n][k],
              "round " + round + ": op" + k + " resolved to more than one Operation");
        }
      }
    }
  }

  // Secrets registered on some threads while others clean: every clean masks
  // what was registered before it, the longer secret whole, and no
  // registration is lost.
  @Test
  public void concurrentRegistrationKeepsEverySecretMasked() throws InterruptedException {
    for (int round = 0; round < ROUNDS / 4; round++) {
      final int r = round;
      ProjectNameSDK client = liveClient();
      Utility utility = client.getUtility();
      Context root = client.getRootCtx();
      String inner = "INNER-SECRET-" + round;
      utility.cleanAdd.apply(root, inner);
      utility.cleanAdd.apply(root, "OUTER-" + inner + "-TAIL");
      String text = "a " + inner + " b OUTER-" + inner + "-TAIL c";
      String masked = "a [redacted] b [redacted] c";
      assertEquals(masked, utility.clean.apply(root, text));

      CountDownLatch registering = new CountDownLatch(WIDTH / 2);
      ConcurrentLinkedQueue<Object> wrong = new ConcurrentLinkedQueue<>();
      List<Throwable> thrown = atOnce(n -> {
        if (n < WIDTH / 2) {
          try {
            for (int k = 0; k < OPS; k++) {
              utility.cleanAdd.apply(root, "ADDED-SECRET-" + r + "-" + n + "-" + k);
            }
          }
          finally {
            registering.countDown();
          }
          return;
        }
        while (0 < registering.getCount()) {
          Object got = utility.clean.apply(root, text);
          if (!masked.equals(got)) {
            wrong.add(String.valueOf(got));
          }
        }
      });

      assertTrue(thrown.isEmpty(), "round " + round + " threw: " + thrown);
      assertTrue(wrong.isEmpty(), "round " + round + " cleaned to: " + wrong);
      for (int n = 0; n < WIDTH / 2; n++) {
        for (int k = 0; k < OPS; k++) {
          String added = "ADDED-SECRET-" + round + "-" + n + "-" + k;
          assertEquals("[redacted]", utility.clean.apply(root, added),
              "round " + round + ": " + added + " was registered but not masked");
        }
      }
    }
  }
}
