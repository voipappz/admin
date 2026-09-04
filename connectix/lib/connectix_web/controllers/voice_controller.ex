defmodule ConnectixWeb.VoiceController do
  @moduledoc """
  The vendored Feline/pipecat demo client (`connectix/priv/static/voice/`,
  copied verbatim from `deps/feline/examples/client/dist/` — Feline's own
  build, not ours; see `Connectix.Voice.FelinePipeline`).

  Deliberately NOT under `Connectix.static_paths()`/`Plug.Static`: that skips
  the router entirely, and this is the one static asset in the app that
  should sit behind the same `Plugs.BasicAuth` gate as the chat LiveView —
  `Plug.Static` has no such gate. `send_file/3` through a controller gets it
  for (almost) free — routed through the router's `:voice_assets` pipeline,
  not `:browser`, because `:browser`'s `protect_from_forgery` 403s a plain
  GET response with a `text/javascript` content-type (its cross-origin-JS
  guard), which is exactly what serving this bundle looks like.

  `index/2` redirects rather than serving the HTML directly so the client's
  own `?ws=` override (read from `location.search` by its bundled JS, see
  `deps/feline/examples/client/src/app.js`) can carry BOTH the right host and
  the conversation to attach to — `ChatLive` links here with its own
  `@conversation_id` so a voice call and the open chat share one transcript.
  """

  use ConnectixWeb, :controller

  @assets_dir Application.app_dir(:connectix, "priv/static/voice")

  def index(conn, params) do
    ws_url = voice_ws_url(conn, params["conversation_id"])
    redirect(conn, to: ~p"/voice/page?ws=#{ws_url}")
  end

  def page(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> send_file(200, Path.join(@assets_dir, "index.html"))
  end

  def asset(conn, %{"file" => file}) do
    path = Path.join(@assets_dir, ["assets", "/", file])

    if String.contains?(file, "..") or not File.regular?(path) do
      send_resp(conn, 404, "not found")
    else
      conn
      |> put_resp_content_type("text/javascript")
      |> send_file(200, path)
    end
  end

  defp voice_ws_url(conn, conversation_id) do
    scheme = if conn.scheme == :https, do: "wss", else: "ws"
    qs = if conversation_id, do: "?conversation_id=#{URI.encode_www_form(conversation_id)}", else: ""
    "#{scheme}://#{conn.host}:#{conn.port}/voice/ws#{qs}"
  end
end
