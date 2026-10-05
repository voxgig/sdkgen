package KOTLINPACKAGE.sdktest

// Requests in flight at once on one client. Each resolves its operation
// through the cache the client's root context shares with every request.

import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CyclicBarrier
import java.util.function.BiFunction
import java.util.function.Supplier

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

import KOTLINPACKAGE.core.Operation
import KOTLINPACKAGE.core.ProjectNameSDK

class ConcurrencyTest {

  private val rounds = 200
  private val width = 8
  private val ops = 32

  // A live client whose transport answers at once.
  private fun liveClient(): ProjectNameSDK {
    val fetch = BiFunction<String, MutableMap<String, Any?>, MutableMap<String, Any?>> { _, _ ->
      linkedMapOf<String, Any?>(
        "status" to 200,
        "statusText" to "OK",
        "headers" to linkedMapOf<String, Any?>(),
        "json" to Supplier<Any?> { linkedMapOf<String, Any?>("ok" to true) },
      )
    }
    return ProjectNameSDK(linkedMapOf<String, Any?>(
      "base" to "http://concurrency.test/api",
      "allow" to linkedMapOf<String, Any?>("op" to "direct"),
      "system" to linkedMapOf<String, Any?>("fetch" to fetch),
    ))
  }

  // Runs body on `width` threads released together, and returns what they threw.
  private fun atOnce(body: (Int) -> Unit): List<Throwable> {
    val start = CyclicBarrier(width)
    val thrown = ConcurrentLinkedQueue<Throwable>()
    val threads = (0 until width).map { n ->
      Thread {
        try {
          start.await()
          body(n)
        } catch (t: Throwable) {
          thrown.add(t)
        }
      }.also { it.start() }
    }
    threads.forEach { it.join() }
    return thrown.toList()
  }

  @Test
  fun concurrentFirstRequestsSucceed() {
    repeat(rounds) { round ->
      // A fresh client each round, so every request in it is a first request.
      val client = liveClient()
      val results = arrayOfNulls<MutableMap<String, Any?>>(width)
      val thrown = atOnce { n -> results[n] = client.direct(linkedMapOf<String, Any?>("path" to "p$n")) }

      assertTrue(thrown.isEmpty(), "round $round threw: $thrown")
      results.forEachIndexed { n, res ->
        assertEquals(true, res?.get("ok"), "round $round, request $n failed: $res")
      }
    }
  }

  @Test
  fun concurrentResolutionsShareOneCachedOperation() {
    repeat(rounds) { round ->
      val client = liveClient()
      val utility = client.getUtility()
      val root = client.getRootCtx()
      val got = Array(width) { arrayOfNulls<Operation>(ops) }
      val thrown = atOnce { n ->
        for (k in 0 until ops) {
          got[n][k] = utility.makeContext(linkedMapOf<String, Any?>("opname" to "op$k"), root).op
        }
      }

      assertTrue(thrown.isEmpty(), "round $round threw: $thrown")
      for (k in 0 until ops) {
        val cached = utility.makeContext(linkedMapOf<String, Any?>("opname" to "op$k"), root).op
        for (n in 0 until width) {
          assertSame(cached, got[n][k], "round $round: op$k resolved to more than one Operation")
        }
      }
    }
  }
}
