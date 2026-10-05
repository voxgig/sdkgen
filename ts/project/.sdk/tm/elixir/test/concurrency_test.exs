# ProjectName SDK concurrency test
#
# Requests in flight at once on one client, each in its own process, register
# and clean secrets through the one registry the client holds.

defmodule ProjectName.ConcurrencyTest do
  use ExUnit.Case

  alias ProjectName.Utility

  @rounds 3
  @width 8
  @added 16
  @masked "a [redacted] b [redacted] c"

  # Runs body in @width processes released together, and returns what they raised.
  defp at_once(body) do
    parent = self()

    tasks =
      for n <- 0..(@width - 1) do
        Task.async(fn ->
          send(parent, {:ready, self()})

          receive do
            :go -> :ok
          end

          try do
            body.(n)
            nil
          rescue
            err -> err
          end
        end)
      end

    for _ <- tasks do
      receive do
        {:ready, pid} -> send(pid, :go)
      end
    end

    tasks |> Task.await_many(:infinity) |> Enum.reject(&is_nil/1)
  end

  # A cleaner pauses between passes, so the registrars contend with each other.
  defp clean_while(root, text, registering) do
    if 0 < :counters.get(registering, 1) do
      got = Utility.clean(root, text)

      if @masked != got do
        raise "cleaned to: " <> inspect(got)
      end

      Process.sleep(1)
      clean_while(root, text, registering)
    end
  end

  # Secrets registered in some processes while others clean: every clean masks
  # what was registered before it, the longer secret whole, and no
  # registration is lost.
  test "concurrent registration keeps every secret masked" do
    for round <- 1..@rounds do
      client = ProjectName.test()
      root = ProjectName.get_root_ctx(client)
      inner = "INNER-SECRET-#{round}"
      Utility.clean_add(root, inner)
      Utility.clean_add(root, "OUTER-#{inner}-TAIL")
      text = "a #{inner} b OUTER-#{inner}-TAIL c"
      assert @masked == Utility.clean(root, text)

      registering = :counters.new(1, [:atomics])
      :counters.put(registering, 1, div(@width, 2))

      raised =
        at_once(fn n ->
          if n < div(@width, 2) do
            try do
              for k <- 1..@added, do: Utility.clean_add(root, "ADDED-SECRET-#{round}-#{n}-#{k}")
            after
              :counters.sub(registering, 1, 1)
            end
          else
            clean_while(root, text, registering)
          end
        end)

      assert [] == raised, "round #{round} raised: #{inspect(raised)}"

      for n <- 0..(div(@width, 2) - 1), k <- 1..@added do
        added = "ADDED-SECRET-#{round}-#{n}-#{k}"

        assert "[redacted]" == Utility.clean(root, added),
               "round #{round}: #{added} was registered but not masked"
      end
    end
  end
end
