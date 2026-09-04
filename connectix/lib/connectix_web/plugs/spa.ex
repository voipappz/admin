defmodule ConnectixWeb.Plugs.Spa do
  @moduledoc """
  Serve the React portal (the Vite `dist/`) same-origin: one process serves the
  SPA plus the forwarded API routes and the `/ws/events` socket on one port, so
  the browser never needs a second host or CORS.

  A port of `ConnectixWeb.SpaStatic` in `connectix.io/phone`, deliberately kept
  the same: these two apps are due to merge, and the SPA is the UI in both now
  that the LiveView web is gated off (see the router).

  Rules:

    * GET/HEAD only. The dir is `SPA_ROOT`; unset or missing → no-op, so a
      pure-API boot works and the Vite dev server can own the UI instead.
    * A real file under the root is served with its MIME type.
    * `/` always falls back to `index.html`. Other extensionless paths (SPA
      routes like `/dashboard`, `/calls`) fall back only when the client
      *prefers* HTML — so `curl /health/alive` still reaches the router's JSON
      probe while a browser navigating gets the React page.
    * Backend namespaces always pass through. This is load-bearing, not
      tidiness: a catch-all here answers `/ws/events` and `/health/alive` with
      the SPA's HTML and a 200, which reads as a protocol error at the client
      and as a healthy node at the load balancer.
    * Traversal (`..`) → 403.

  `Plug.Static` is not used: it has no index fallback, and its own `:only`
  handling made every unmatched path a 500 here.
  """

  @behaviour Plug

  import Plug.Conn

  # Namespaces a browser can navigate to that belong to the server, never the
  # SPA. Deliberately short: a path the SPA *fetches* is already safe, because
  # fetch does not ask for `text/html` and so never triggers the index
  # fallback. Listing such a path here instead would shadow the SPA's own page
  # of the same name — `/dashboard` and `/calls` are both a fetch prefix and a
  # React route.
  @backend_prefixes ~w(api ws auth health live dev phoenix webhooks)

  @mime %{
    ".html" => "text/html; charset=utf-8",
    ".js" => "text/javascript",
    ".mjs" => "text/javascript",
    ".css" => "text/css",
    ".json" => "application/json",
    ".svg" => "image/svg+xml",
    ".png" => "image/png",
    ".jpg" => "image/jpeg",
    ".jpeg" => "image/jpeg",
    ".gif" => "image/gif",
    ".ico" => "image/x-icon",
    ".webp" => "image/webp",
    ".woff" => "font/woff",
    ".woff2" => "font/woff2",
    ".map" => "application/json",
    ".txt" => "text/plain; charset=utf-8"
  }

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(%Plug.Conn{method: method} = conn, _opts) when method in ["GET", "HEAD"] do
    dir = System.get_env("SPA_ROOT")

    if is_binary(dir) and dir != "" and File.dir?(dir) do
      serve(conn, dir)
    else
      conn
    end
  end

  def call(conn, _opts), do: conn

  defp serve(conn, dir) do
    cond do
      String.contains?(conn.request_path, "..") ->
        conn |> send_resp(403, "Forbidden") |> halt()

      backend_path?(conn.path_info) ->
        conn

      true ->
        file = Path.join([dir | conn.path_info])

        cond do
          conn.path_info != [] and File.regular?(file) ->
            send_file_resp(conn, file)

          conn.path_info == [] or
              (Path.extname(List.last(conn.path_info)) == "" and prefers_html?(conn)) ->
            index = Path.join(dir, "index.html")
            if File.regular?(index), do: send_file_resp(conn, index), else: conn

          true ->
            conn
        end
    end
  end

  defp backend_path?([first | _]), do: first in @backend_prefixes
  defp backend_path?([]), do: false

  defp prefers_html?(conn) do
    conn |> get_req_header("accept") |> Enum.any?(&String.contains?(&1, "text/html"))
  end

  defp send_file_resp(conn, file) do
    mime = Map.get(@mime, String.downcase(Path.extname(file)), "application/octet-stream")

    conn
    |> put_resp_header("content-type", mime)
    |> send_file(200, file)
    |> halt()
  end
end
