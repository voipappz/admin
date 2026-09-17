defmodule ConnectixWeb.AppControllerTest do
  @moduledoc """
  The `/app` mount, which has exactly two failure modes worth a test.

  The first is ROUTING: the Ionic app owns paths like `/app/calls` that are not
  files, so `Plug.Static` falls through to the router and something has to
  answer. Get the glob wrong and the app works until someone presses F5 or
  shares a link — a bug that never appears in a click-through.

  The second is the ABSENT BUNDLE. `ionic/` is built in its own node container
  by `make app`; no `mix` task produces it, so a dev checkout and a CI run
  without the `ionic` stage both have nothing to serve. Answering 404 there
  would read as a broken mount or a wrong base href, which are the two real
  failures this route has.

  Both branches are exercised through `:ionic_bundle_dir` rather than by
  writing into `priv/app`, where a fixture would delete the bundle a developer
  had just built — and which the endpoint's `Plug.Static` is serving from.

  What is NOT asserted here: that the bundle renders. A wrong `<base href>` or
  an index.html naming a chunk the build no longer emits are build facts, and
  they are asserted where a real bundle exists — `make -C ionic check`, the
  same assertions in the `ionic` stage of Dockerfile.production, and the
  `ionic` CI job.
  """

  use ConnectixWeb.ConnCase, async: false

  setup do
    original = Application.get_env(:connectix, :ionic_bundle_dir)

    on_exit(fn ->
      if original,
        do: Application.put_env(:connectix, :ionic_bundle_dir, original),
        else: Application.delete_env(:connectix, :ionic_bundle_dir)
    end)

    :ok
  end

  describe "with a bundle" do
    setup %{tmp_dir: tmp_dir} do
      File.write!(Path.join(tmp_dir, "index.html"), ~s(<!DOCTYPE html><base href="/app/">))
      Application.put_env(:connectix, :ionic_bundle_dir, tmp_dir)
      :ok
    end

    @tag :tmp_dir
    test "GET /app serves the HTML shell", %{conn: conn} do
      conn = get(conn, "/app")

      assert response(conn, 200) =~ "<base href=\"/app/\">"
      assert response_content_type(conn, :html)
    end

    @tag :tmp_dir
    test "the shell is never cached — it names content-hashed chunks", %{conn: conn} do
      # A cached index.html keeps naming chunks the next deploy no longer has,
      # and the app then loads and shows a blank page until the user clears
      # their own cache. There is no server-side fix for that after the fact,
      # which is why the header is asserted rather than assumed.
      conn = get(conn, "/app")

      assert get_resp_header(conn, "cache-control") == ["no-cache"]
    end

    @tag :tmp_dir
    test "a deep link the Angular router owns gets the same shell", %{conn: conn} do
      assert get(conn, "/app/calls") |> response(200) =~ "<base href=\"/app/\">"
      assert get(conn, "/app/tabs/calls/12345") |> response(200) =~ "<base href=\"/app/\">"
    end
  end

  describe "with no bundle in this build" do
    setup %{tmp_dir: tmp_dir} do
      # An EMPTY directory, not a missing one: that is what a dev checkout and
      # a release built without the `ionic` stage both look like.
      Application.put_env(:connectix, :ionic_bundle_dir, tmp_dir)
      :ok
    end

    @tag :tmp_dir
    test "GET /app says how to build it instead of 404ing", %{conn: conn} do
      conn = get(conn, "/app")

      body = response(conn, 503)
      assert body =~ "not in this build"
      assert body =~ "make app"
    end

    @tag :tmp_dir
    test "a deep link refuses the same way, not with a NoRouteError", %{conn: conn} do
      assert get(conn, "/app/calls") |> response(503) =~ "make app"
    end
  end
end
