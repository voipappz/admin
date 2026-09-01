defmodule AgentsDemo.Capabilities.CustomerLookupTest do
  use ExUnit.Case, async: true

  alias AgentsDemo.Capabilities.CustomerLookup

  @token "fireberry-token-should-never-appear"

  setup do
    previous = System.get_env("FIREBERRY_TOKEN")
    System.put_env("FIREBERRY_TOKEN", @token)

    on_exit(fn ->
      if previous,
        do: System.put_env("FIREBERRY_TOKEN", previous),
        else: System.delete_env("FIREBERRY_TOKEN")
    end)

    :ok
  end

  defp stub(fun) do
    Application.put_env(:agents_demo, :fireberry_req_options, plug: fun)
    on_exit(fn -> Application.delete_env(:agents_demo, :fireberry_req_options) end)
  end

  defp row do
    %{
      "telephone1" => "031234567",
      "pcfsystemfield179" => "nimbus.example",
      "pcfsystemfield166" => "072-1111111"
    }
  end

  test "found: the account's domain and trunks" do
    stub(fn conn ->
      assert ["fireberry-token-should-never-appear"] = Plug.Conn.get_req_header(conn, "tokenid")
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      assert body =~ "(telephone1 = 031234567)"
      Req.Test.json(conn, %{"data" => %{"Data" => [row()]}})
    end)

    assert {:ok,
            %{found: true, line: "031234567", domain: "nimbus.example", trunks: "072-1111111"}} =
             CustomerLookup.lookup("+972-3-123 4567")
  end

  test "not found" do
    stub(fn conn -> Req.Test.json(conn, %{"data" => %{"Data" => []}}) end)
    assert {:ok, %{found: false, reason: "not_found"}} = CustomerLookup.lookup("031234567")
  end

  test "a CRM error is a bounded answer, never an exception" do
    stub(fn conn -> Plug.Conn.send_resp(conn, 500, "boom") end)
    assert {:ok, %{found: false, reason: "crm_unavailable"}} = CustomerLookup.lookup("031234567")

    stub(fn conn -> Req.Test.transport_error(conn, :econnrefused) end)
    assert {:ok, %{found: false, reason: "crm_unavailable"}} = CustomerLookup.lookup("031234567")
  end

  test "letters never reach the CRM" do
    stub(fn _conn -> flunk("the CRM must not be called for a non-number") end)

    assert {:ok, %{found: false, reason: "invalid_line_number"}} =
             CustomerLookup.lookup("מרכזייה")
  end

  test "without a token the bot still runs" do
    System.delete_env("FIREBERRY_TOKEN")
    assert {:ok, %{found: false, reason: "crm_unavailable"}} = CustomerLookup.lookup("031234567")
  end

  test "the result the model sees carries no token" do
    stub(fn conn -> Req.Test.json(conn, %{"data" => %{"Data" => [row()]}}) end)
    {:ok, result} = CustomerLookup.lookup("031234567")
    refute inspect(result) =~ @token
  end
end
