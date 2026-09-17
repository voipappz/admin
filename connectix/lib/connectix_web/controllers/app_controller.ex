defmodule ConnectixWeb.AppController do
  @moduledoc """
  The Ionic app's HTML, for every path under `/app` that is not a file.

  The bundle itself is served by `Plug.Static` in the endpoint, straight off
  disk and ahead of the router. This controller exists for the other half of a
  single-page app: `/app/calls` is a ROUTE, not a file, so `Plug.Static` finds
  nothing, falls through, and without a catch-all the router raises
  `NoRouteError` on every reload and every shared link.

  ## Why the bundle is not under `priv/static`

  `mix phx.digest` walks all of `priv/static` regardless of
  `ConnectixWeb.static_paths/0`, so a bundle placed there gets a second
  content-hashed copy of every Angular chunk plus a `cache_manifest.json`
  entry — for nothing, because Angular already content-hashes its own
  filenames and `index.html` references those names. `priv/app` keeps digest
  out of it entirely, the same reason the extension zip lives in
  `priv/extension` rather than `priv/static`.

  ## Why a 503 and not a 404

  A dev checkout has no bundle: `ionic/` is built by `make app`, in its own
  node container, and nothing in a `mix` build produces it. Answering 404 for
  a route that exists reads as a broken mount or a wrong base href — the two
  real failures this route has — and sends you looking at the endpoint. So the
  absence is reported as what it is, with the command that fixes it.
  """

  use ConnectixWeb, :controller

  @default_dir Application.app_dir(:connectix, "priv/app")

  @not_built """
  The Ionic app is not in this build.

  It is built in its own node container, not by mix:

      make app        # builds ionic/ and bundles it into connectix/priv/app

  A release image builds it in the `ionic` stage of Dockerfile.production, so
  a deployed node that shows this message was built without that stage.
  """

  @doc """
  Where the bundle is, which is `priv/app` unless something says otherwise.

  Read at request time rather than baked in, so a test can exercise BOTH
  branches below. The alternative was a test that writes an `index.html` into
  `priv/app` and deletes it afterwards — which would delete the bundle a
  developer had just built with `make app`, in the same directory the
  endpoint's `Plug.Static` is serving from.

  `Plug.Static` reads the compile-time path in the endpoint, so overriding
  this moves the HTML shell WITHOUT moving the assets. That is fine for a test
  and wrong for a deployment: relocating the bundle for real means changing
  both, and there is no reason to.
  """
  def bundle_dir, do: Application.get_env(:connectix, :ionic_bundle_dir, @default_dir)

  def index(conn, _params) do
    index = Path.join(bundle_dir(), "index.html")

    if File.regular?(index) do
      conn
      |> put_resp_content_type("text/html")
      # The HTML shell must never be cached: it names content-hashed bundles,
      # so a cached index.html keeps pointing at chunks a new deploy no longer
      # has — the app then loads, fetches a 404 and shows a blank page, and it
      # stays broken until the user clears their cache. The hashed assets
      # themselves are immutable and cache forever, which is the whole point of
      # hashing them.
      |> put_resp_header("cache-control", "no-cache")
      |> send_file(200, index)
    else
      conn
      |> put_resp_content_type("text/plain")
      |> send_resp(503, @not_built)
    end
  end
end
