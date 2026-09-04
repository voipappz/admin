defmodule Connectix.Bots.Version.Voice do
  @moduledoc "Voice profile for a future realtime adapter. References only; secrets stay in the environment."
  @derive Jason.Encoder
  defstruct enabled: false, locale: nil, voice_profile: nil, greeting: nil, max_call_seconds: nil

  @fields [:enabled, :locale, :voice_profile, :greeting, :max_call_seconds]

  def new(attrs \\ %{}) do
    m = Connectix.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    errors = Connectix.Bots.Version.range(%{}, :max_call_seconds, m.max_call_seconds, gt: 0)
    Connectix.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
