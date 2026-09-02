defmodule AgentsDemo.Logging.Influx.HTTP do
  @moduledoc """
  The one place the log shipper touches the network — a thin `Req` wrapper the
  writer reaches through `Application.get_env(:agents_demo, :influx_http)`, so
  a test can put a stub here and assert on the exact batch that would have
  gone out, without a live InfluxDB and without the network.

  Both calls answer `{:ok, status}` or `{:error, reason}` and nothing else:
  the writer only ever needs to know "did it land", and an exception type
  leaking out of here would be one more thing `flush` has to rescue.

  `retry: false` everywhere. Req retries safe methods by default with backoff,
  which for the health probe would turn a 2-second timeout into an
  eight-second boot stall, and a POST that failed once is dropped by design —
  the next batch is already forming behind it.
  """

  @doc "POST one line-protocol batch. `timeout` bounds the connect and the read separately."
  @spec post(String.t(), [{String.t(), String.t()}], iodata(), keyword()) ::
          {:ok, non_neg_integer()} | {:error, term()}
  def post(url, headers, body, opts) do
    connect = Keyword.get(opts, :connect_timeout, 2_000)
    receive = Keyword.get(opts, :receive_timeout, 5_000)

    case Req.post(url,
           headers: headers,
           body: body,
           retry: false,
           connect_options: [timeout: connect],
           receive_timeout: receive
         ) do
      {:ok, %Req.Response{status: status}} -> {:ok, status}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "GET, for the startup reachability probe."
  @spec get(String.t(), keyword()) :: {:ok, non_neg_integer()} | {:error, term()}
  def get(url, opts) do
    timeout = Keyword.get(opts, :timeout, 2_000)

    case Req.get(url, retry: false, connect_options: [timeout: timeout], receive_timeout: timeout) do
      {:ok, %Req.Response{status: status}} -> {:ok, status}
      {:error, reason} -> {:error, reason}
    end
  end
end
