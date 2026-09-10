defmodule Connectix.Disk do
  @moduledoc """
  How much room is left where this node keeps its data.

  The portal writes two things to disk and both grow without asking: the
  DuckDB event store and Mnesia's tables, side by side under
  `Connectix.Config.data_dir/0`. A live switch writes ~146,000 events and
  ~556MB of raw JSON a day, so a volume with a few gigabytes free is days from
  full — and when it fills, Mnesia goes with it. Losing the event store is an
  inconvenience; losing the conversation store is not.

  Nothing reported this. `/health/ready` answered 200 with 5.7GB left and
  would have answered 200 with 5MB left.

  `:disksup` rather than shelling out to `df`: it is OTP, it is already
  sampling on a timer, and reading its table costs nothing on a health poll
  that runs every few seconds.
  """

  @doc """
  Usage for the filesystem holding `path`, or `nil` when it cannot be read.

  `:disksup` reports mount points, so the answer is the LONGEST mount that
  prefixes the path — `/data` beats `/` for `/data/events`, and getting that
  backwards reports the root filesystem's space for a mounted volume, which is
  the number that looks fine right up until the volume fills.
  """
  @spec usage(String.t()) :: %{
          mount: String.t(),
          total_bytes: non_neg_integer(),
          used_percent: non_neg_integer(),
          free_percent: non_neg_integer(),
          free_bytes: non_neg_integer()
        } | nil
  def usage(path \\ Connectix.Config.data_dir()) do
    case mount_for(path, disk_data()) do
      nil ->
        nil

      {mount, total_kb, used_percent} ->
        total = total_kb * 1024
        free_percent = 100 - used_percent

        %{
          mount: mount,
          total_bytes: total,
          used_percent: used_percent,
          free_percent: free_percent,
          free_bytes: div(total * free_percent, 100)
        }
    end
  end

  @doc "Whether the filesystem holding `path` has at least the configured free share."
  @spec ok?(String.t()) :: boolean()
  def ok?(path \\ Connectix.Config.data_dir()) do
    case usage(path) do
      # Unreadable is not "full". A node whose disk cannot be measured should
      # not page someone at 3am; the check says so in its detail instead.
      nil -> true
      %{free_percent: free} -> free >= Connectix.Config.disk_min_free_percent()
    end
  end

  defp disk_data do
    :disksup.get_disk_data()
  rescue
    _ -> []
  catch
    _, _ -> []
  end

  defp mount_for(path, data) do
    path = Path.expand(path)

    data
    |> Enum.map(fn {mount, total_kb, used} -> {to_string(mount), total_kb, used} end)
    |> Enum.filter(fn {mount, total_kb, _used} ->
      total_kb > 0 and (path == mount or String.starts_with?(path, ensure_slash(mount)))
    end)
    |> Enum.max_by(fn {mount, _total, _used} -> String.length(mount) end, fn -> nil end)
  end

  defp ensure_slash("/"), do: "/"
  defp ensure_slash(mount), do: mount <> "/"
end
