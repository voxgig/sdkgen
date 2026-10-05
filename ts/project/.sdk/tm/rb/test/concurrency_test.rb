# ProjectName SDK concurrency test
#
# Requests in flight at once on one client. Each resolves its operation
# through the cache the client's root context shares with every request, and
# registers and cleans secrets through the one registry the client holds.
#
# The interpreter switches threads about every 100ms, so each test runs long
# enough to be switched in the middle of a resolution or a registration.

require "minitest/autorun"
require_relative "../ProjectName_sdk"

class ConcurrencyTest < Minitest::Test
  ROUNDS = 3
  WIDTH = 8
  OPS = 6000
  SEEDED = 1000
  ADDED = 400
  MASKED = "a [redacted] b [redacted] c"

  # Runs the block on WIDTH threads released together, and returns what they raised.
  def at_once
    gate = Queue.new
    raised = Queue.new
    threads = (0...WIDTH).map do |n|
      Thread.new do
        gate.pop
        yield n
      rescue Exception => e
        raised << e
      end
    end
    WIDTH.times { gate << true }
    threads.each(&:join)
    Array.new(raised.size) { raised.pop }
  end

  def test_concurrent_resolutions_share_one_cached_operation
    ROUNDS.times do |round|
      client = ProjectNameSDK.test(nil, nil)
      utility = client.get_utility
      root = client.get_root_ctx
      ops = Array.new(WIDTH) { Array.new(OPS) }

      raised = at_once do |n|
        OPS.times { |k| ops[n][k] = utility.make_context.call({ "opname" => "op#{k}" }, root).op }
      end

      assert_empty raised, "round #{round} raised: #{raised.inspect}"
      OPS.times do |k|
        cached = utility.make_context.call({ "opname" => "op#{k}" }, root).op
        WIDTH.times do |n|
          assert_same cached, ops[n][k], "round #{round}: op#{k} resolved to more than one Operation"
        end
      end
    end
  end

  # Secrets registered on some threads while others clean: every clean masks
  # what was registered before it, the longer secret whole, and no
  # registration is lost.
  def test_concurrent_registration_keeps_every_secret_masked
    client = ProjectNameSDK.test(nil, nil)
    utility = client.get_utility
    root = client.get_root_ctx
    SEEDED.times { |k| utility.clean_add.call(root, "SEEDED-SECRET-#{k}") }
    utility.clean_add.call(root, "INNER-SECRET")
    utility.clean_add.call(root, "OUTER-INNER-SECRET-TAIL")
    text = "a INNER-SECRET b OUTER-INNER-SECRET-TAIL c"
    assert_equal MASKED, utility.clean.call(root, text)

    lock = Mutex.new
    registering = WIDTH / 2
    wrong = Queue.new
    raised = at_once do |n|
      if n < WIDTH / 2
        begin
          ADDED.times { |k| utility.clean_add.call(root, "ADDED-SECRET-#{n}-#{k}") }
        ensure
          lock.synchronize { registering -= 1 }
        end
      else
        while 0 < lock.synchronize { registering }
          got = utility.clean.call(root, text)
          if MASKED != got
            wrong << got
            break
          end
          Thread.pass
        end
      end
    end

    cleaned = Array.new(wrong.size) { wrong.pop }
    assert_empty raised, "raised: #{raised.inspect}"
    assert_empty cleaned, "cleaned to: #{cleaned.inspect}"
    (WIDTH / 2).times do |n|
      ADDED.times do |k|
        added = "ADDED-SECRET-#{n}-#{k}"
        assert_equal "[redacted]", utility.clean.call(root, added), "#{added} was registered but not masked"
      end
    end
  end
end
