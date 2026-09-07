defmodule ConnectixWeb.Plugs.BasicAuthTest do
  @moduledoc """
  What the gate does when it has no credentials — which is the only case that
  has ever mattered.

  Everything behind the `:browser` pipeline is anonymous if this plug lets a
  request through: `/chat`, whose agent runs tool calls and fetches URLs from
  inside the host, and `/voice/ws`, which attaches a Deepgram/Cartesia
  pipeline and spends the deployment's credit. Unconfigured used to be a
  pass-through everywhere, with a boot warning as the only signal — and no
  deploy manifest set `PORTAL_UI_USER`/`PORTAL_UI_PASS`, so the first public
  deployment would have served all of that to anyone who found the host.

  The split under test: open in dev and test (a credential to run the suite
  buys nothing), refused in prod.
  """

  use ExUnit.Case, async: false
  import Plug.Test
  import Plug.Conn

  alias ConnectixWeb.Plugs.BasicAuth

  defp with_env(pairs, fun) do
    previous = Map.new(pairs, fn {k, _v} -> {k, System.get_env(k)} end)

    Enum.each(pairs, fn
      {k, nil} -> System.delete_env(k)
      {k, v} -> System.put_env(k, v)
    end)

    try do
      fun.()
    after
      Enum.each(previous, fn
        {k, nil} -> System.delete_env(k)
        {k, v} -> System.put_env(k, v)
      end)
    end
  end

  defp call(conn), do: BasicAuth.call(conn, BasicAuth.init([]))

  describe "with credentials configured" do
    test "a correct credential passes" do
      with_env([{"PORTAL_UI_USER", "op"}, {"PORTAL_UI_PASS", "s3cret-long-enough"}], fn ->
        conn =
          conn(:get, "/chat")
          |> put_req_header("authorization", Plug.BasicAuth.encode_basic_auth("op", "s3cret-long-enough"))
          |> call()

        refute conn.halted
      end)
    end

    test "a wrong password is refused with a challenge" do
      with_env([{"PORTAL_UI_USER", "op"}, {"PORTAL_UI_PASS", "s3cret-long-enough"}], fn ->
        conn =
          conn(:get, "/chat")
          |> put_req_header("authorization", Plug.BasicAuth.encode_basic_auth("op", "wrong"))
          |> call()

        assert conn.status == 401
        assert conn.halted
        assert get_resp_header(conn, "www-authenticate") != []
      end)
    end

    test "no credential at all is refused" do
      with_env([{"PORTAL_UI_USER", "op"}, {"PORTAL_UI_PASS", "s3cret-long-enough"}], fn ->
        conn = call(conn(:get, "/chat"))

        assert conn.status == 401
        assert conn.halted
      end)
    end

    test "one variable without the other counts as unconfigured" do
      # `Config.basic_auth/0` needs both; a half-set pair must not be read as
      # a credential with an empty half.
      with_env([{"PORTAL_UI_USER", "op"}, {"PORTAL_UI_PASS", nil}], fn ->
        assert Connectix.Config.basic_auth() == nil
      end)
    end
  end

  describe "with no credentials configured" do
    test "passes through here, because this is not production" do
      with_env([{"PORTAL_UI_USER", nil}, {"PORTAL_UI_PASS", nil}], fn ->
        refute Connectix.Config.prod?()
        conn = call(conn(:get, "/chat"))

        refute conn.halted, "unconfigured must stay frictionless in dev and test"
      end)
    end

    test "the production branch refuses, and names what is missing" do
      # The plug's prod decision is `Config.prod?()`, compiled in — the suite
      # cannot be running as :prod, so the branch is asserted directly. This
      # is what a public host does with no credentials set.
      refute Connectix.Config.prod?()

      assert Connectix.Config.prod?() == (Mix.env() == :prod)

      # The contract in one line: prod without credentials must not serve.
      # Guarding the source keeps this honest without compiling a second env.
      source = File.read!("lib/connectix_web/plugs/basic_auth.ex")
      assert source =~ "if Connectix.Config.prod?() do"
      assert source =~ "send_resp(401"
      assert source =~ "|> halt()"

      refute source =~ ~r/nil ->\s*\n\s*conn\s*\n\s*end/,
             "the unconditional pass-through is back; unconfigured prod would serve the agent UI"
    end
  end
end
