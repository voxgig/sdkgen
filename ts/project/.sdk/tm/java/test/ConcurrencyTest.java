package JAVAPACKAGE.sdktest;

// Requests in flight at once on one client. Each resolves its operation
// through the cache the client's root context shares with every request.

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
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
}
