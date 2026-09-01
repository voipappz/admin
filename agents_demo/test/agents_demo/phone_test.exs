defmodule AgentsDemo.PhoneTest do
  use ExUnit.Case, async: true

  alias AgentsDemo.Phone

  test "normalises Israeli numbers to local digits" do
    assert Phone.normalise("+972-3-1234567") == {:ok, "031234567"}
    assert Phone.normalise("03-123 4567") == {:ok, "031234567"}
    assert Phone.normalise("972501234567") == {:ok, "0501234567"}
    assert Phone.normalise(" 0501234567 ") == {:ok, "0501234567"}
  end

  test "anything with letters is not a number" do
    assert Phone.normalise("מרכזייה") == :error
    assert Phone.normalise("call me") == :error
    assert Phone.normalise("03-1234567 please") == :error
  end

  test "refuses what cannot be a line" do
    assert Phone.normalise("123") == :error
    assert Phone.normalise("") == :error
    assert Phone.normalise(nil) == :error
  end
end
