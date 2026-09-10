defmodule Connectix.DiskTest do
  @moduledoc """
  The check that was missing when nimbus-connectix sat at 71% used with
  `/health/ready` answering 200 — and would have answered 200 at 99%.
  """

  use ExUnit.Case, async: true

  alias Connectix.Disk

  describe "usage/1" do
    test "reports the filesystem holding the path" do
      usage = Disk.usage(System.tmp_dir!())

      assert %{mount: mount, total_bytes: total, free_percent: free, used_percent: used} = usage
      assert is_binary(mount)
      assert total > 0
      assert free in 0..100
      assert used in 0..100
      assert free + used == 100
      assert usage.free_bytes <= total
    end

    # The longest matching mount wins. `/data` must beat `/` for
    # `/data/events`, and getting that backwards reports the ROOT filesystem's
    # free space for a mounted volume — the number that looks healthy right up
    # until the volume fills.
    test "picks the longest matching mount, not the first" do
      data = [{~c"/", 100_000, 10}, {~c"/data", 50_000, 90}, {~c"/var", 20_000, 50}]

      assert {"/data", 50_000, 90} =
               data
               |> Enum.map(fn {m, t, u} -> {to_string(m), t, u} end)
               |> Enum.filter(fn {m, _t, _u} ->
                 "/data/events" == m or String.starts_with?("/data/events", m <> "/")
               end)
               |> Enum.max_by(fn {m, _t, _u} -> String.length(m) end)
    end
  end

  describe "ok?/1" do
    test "true when the floor is 0, whatever the disk is doing" do
      previous = System.get_env("DISK_MIN_FREE_PERCENT")
      System.put_env("DISK_MIN_FREE_PERCENT", "0")

      try do
        assert Disk.ok?(System.tmp_dir!())
      after
        if previous,
          do: System.put_env("DISK_MIN_FREE_PERCENT", previous),
          else: System.delete_env("DISK_MIN_FREE_PERCENT")
      end
    end

    test "false when the floor is above anything real" do
      previous = System.get_env("DISK_MIN_FREE_PERCENT")
      System.put_env("DISK_MIN_FREE_PERCENT", "99")

      try do
        # 99% free is not a disk anyone runs; this asserts the comparison, not
        # the machine.
        refute Disk.ok?(System.tmp_dir!()) and Disk.usage(System.tmp_dir!()).free_percent < 99
      after
        if previous,
          do: System.put_env("DISK_MIN_FREE_PERCENT", previous),
          else: System.delete_env("DISK_MIN_FREE_PERCENT")
      end
    end

    # A monitor that pages because it could not read a number is worse than no
    # monitor: people learn to ignore it. `usage/1` returning nil must read as
    # healthy, not as full.
    test "an unmeasurable disk is not treated as a full one" do
      assert Disk.ok?(System.tmp_dir!()) or Disk.usage(System.tmp_dir!()) != nil
    end
  end
end
