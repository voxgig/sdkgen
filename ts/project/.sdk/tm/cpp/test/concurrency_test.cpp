// ProjectName SDK - requests in flight at once on one client. Each resolves
// its operation through the cache the client's root context shares with
// every request.

#include "testlib.hpp"

#include <atomic>
#include <mutex>
#include <thread>
#include <vector>

using namespace sdk;

static const int ROUNDS = 200;
static const int WIDTH = 8;
static const int OPS = 32;

// A live client whose transport answers at once.
static std::shared_ptr<ProjectNameSDK> liveClient() {
  auto client = std::make_shared<ProjectNameSDK>(vmap({
      {"base", Value(std::string("http://concurrency.test/api"))},
      {"allow", vmap({{"op", Value(std::string("direct"))}})}}));
  // Through the base: an entity accessor may share the member's name.
  SdkClient& base = *client;
  base.utility->fetcher = [](CtxPtr, const std::string&, const Value&) -> Value {
    vs::Injector json = [](vs::Injection&, const Value&, const std::string&, const Value&) -> Value {
      return vmap({{"ok", Value(true)}});
    };
    return vmap({{"status", Value(200)}, {"statusText", Value(std::string("OK"))},
                 {"headers", vmap()}, {"json", Value(json)}});
  };
  return client;
}

// Runs body on WIDTH threads released together, and returns what they threw.
template <typename F>
static std::vector<std::string> atOnce(F body) {
  std::atomic<int> ready{0};
  std::mutex mu;
  std::vector<std::string> thrown;
  std::vector<std::thread> threads;
  for (int n = 0; n < WIDTH; n++) {
    threads.emplace_back([&, n]() {
      ready.fetch_add(1);
      while (ready.load() < WIDTH) std::this_thread::yield();
      try {
        body(n);
      } catch (const SdkErrorPtr& e) {
        std::lock_guard<std::mutex> lk(mu);
        thrown.push_back(e->msg);
      } catch (const std::exception& e) {
        std::lock_guard<std::mutex> lk(mu);
        thrown.push_back(e.what());
      }
    });
  }
  for (auto& t : threads) t.join();
  return thrown;
}

static void concurrent_first_requests_succeed() {
  for (int round = 0; round < ROUNDS; round++) {
    // A fresh client each round, so every request in it is a first request.
    auto client = liveClient();
    std::vector<Value> results(WIDTH);
    auto thrown = atOnce([&](int n) {
      results[n] = client->direct(vmap({{"path", Value("p" + std::to_string(n))}}));
    });
    if (!thrown.empty()) {
      ASSERT_TRUE(false, "round " + std::to_string(round) + " threw: " + thrown[0]);
      return;
    }
    for (int n = 0; n < WIDTH; n++) {
      if (!is_true(getp(results[n], "ok"))) {
        ASSERT_TRUE(false, "round " + std::to_string(round) + ", request " + std::to_string(n) +
                    " failed: " + sdktest::vstr(results[n]));
        return;
      }
    }
  }
  ASSERT_TRUE(true, "every request succeeded");
}

static void concurrent_resolutions_share_one_cached_operation() {
  for (int round = 0; round < ROUNDS; round++) {
    auto client = liveClient();
    auto utility = client->getUtility();
    auto root = client->getRootCtx();
    std::vector<std::vector<OperationPtr>> ops(WIDTH, std::vector<OperationPtr>(OPS));
    auto resolve = [&](int k) {
      CtxSpec cs;
      cs.setOpname("op" + std::to_string(k));
      return utility->makeContext(cs, root)->op;
    };
    auto thrown = atOnce([&](int n) {
      for (int k = 0; k < OPS; k++) ops[n][k] = resolve(k);
    });
    if (!thrown.empty()) {
      ASSERT_TRUE(false, "round " + std::to_string(round) + " threw: " + thrown[0]);
      return;
    }
    for (int k = 0; k < OPS; k++) {
      OperationPtr cached = resolve(k);
      for (int n = 0; n < WIDTH; n++) {
        if (ops[n][k] != cached) {
          ASSERT_TRUE(false, "round " + std::to_string(round) + ": op" + std::to_string(k) +
                      " resolved to more than one Operation");
          return;
        }
      }
    }
  }
  ASSERT_TRUE(true, "every operation resolved to one cached Operation");
}

int main() {
  T_RUN(concurrent_first_requests_succeed);
  T_RUN(concurrent_resolutions_share_one_cached_operation);
  return sdktest::summary("concurrency_test");
}
