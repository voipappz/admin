# dependency patches (durable)

Hex packages are re-downloaded **pristine** by every `mix deps.get` /
`mix deps.clean`, wiping any edits made under `deps/`. The fixes the app depends
on live here as unified diffs and are re-applied automatically.

Most patches target `parrot_platform` (the directory's original scope). A patch
named `<dep>__<path>.patch` targets `deps/<dep>` instead — currently one `ash`
patch (see the table).

## How it re-applies

`mix.exs` runs `priv/parrot_patches/apply.sh` from the `setup` alias (right after
`deps.get`) and then force-recompiles parrot. You can also run it by hand:

```bash
mix parrot.patch          # apply patches + recompile parrot (dev)
MIX_ENV=test mix parrot.patch   # same, for the test build
```

`apply.sh` is **idempotent**: an already-applied patch is detected (reverse
dry-run) and skipped, so repeated runs are no-ops. It exits non-zero only if a
hunk no longer applies (e.g. parrot was version-bumped) — that needs a human to
reconcile the diff against the new pristine source.

Patches are generated against `parrot_platform 0.0.1-alpha.3` (the pin in
`mix.exs`). If you bump that pin, regenerate them:

```bash
# extract the new pristine source, then for each changed file:
diff -u pristine/<path> deps/parrot_platform/<path> | \
  sed -e '1s|^--- .*|--- a/<path>|' -e '2s|^+++ .*|+++ b/<path>|' \
  > priv/parrot_patches/<path-with-_>.patch
```

## The patches

| Patch | File | Why |
|---|---|---|
| `ash__lib_ash_data_layer_mnesia_mnesia.ex.patch` | `deps/ash` `data_layer/mnesia/mnesia.ex` | `run_aggregate_query/3` pipes its result into a `case` with no success clause, so any paginated read with `count: true` (every Cinder table in `/admin` via ash_admin) crashes with `CaseClauseError: {:ok, %{count: n}}`. Adds the `{:ok, _}` clause. Present in ash 3.29.3 **and** 3.30.0. |
| `lib_parrot_sip_connection.ex.patch` | `sip/connection.ex` | `received`/`rport` must apply only to the **topmost** Via; stacked Vias (Kamailio→FreeSWITCH) arrive as a list and crashed `Via.with_parameter` with `(KeyError) :parameters`. |
| `lib_parrot_sip_handler_adapter_core.ex.patch` | `sip/handler_adapter/core.ex` | `transaction_trying` passed `data.request` (nil) to the handler → empty To-user → 404 on every inbound INVITE. Use `data.transaction.request`. |
| `lib_parrot_sip_transaction.ex.patch` | `sip/transaction.ex` | The transaction FSM uses `get_in/2` on the `Transaction` struct, which needs `Access`. Structs don't implement it → `UndefinedFunctionError`, blocking 200-OK handling. Implement `Access` (delegating to `Map`). |
| `lib_parrot_media_media_session.ex.patch` | `media/media_session.ex` | Route `audio_source: :webrtc` to `Connectix.WebRtcMediaPipeline` (browser-mic call path) **and** `audio_source: :bot` to `Connectix.BotMediaPipeline` (a real inbound SIP call answered by a bot — `Connectix.Voice.BotSipCall`). |
| `lib_parrot_media_rtp_packet_logger.ex.patch` | `media/rtp_packet_logger.ex` | **(CLAUDE.md #8)** Broadcast `{:rtp_pulse, %{level, payload, …}}` per RTP packet on the `"phone"` PubSub. Drives the live equalizer **and** the browser "Listen" feature, and is what `make verify-loopback` asserts (real RTP audio: `level>0` + a playable `payload`). Pristine alpha.3 only *logs* packets, so without this the loopback media gate fails. |
| `lib_parrot_media_portaudio_pipeline.ex.patch` | `media/portaudio_pipeline.ex` | Force **mono** PortAudio capture (`channels: 1`). Pulse-via-WSLg opens 32 native channels, which the downstream resampler rejects → pipeline crash. Only affects `:device` audio mode (real mic/speaker) — not exercised on WSL/CI, but kept so on-hardware capture works. |

(The membrane file-recording / MP3 / WAV.Serializer fixes documented historically
in `CLAUDE.md` as #3/#4/#7 are already present in pristine `0.0.1-alpha.3` —
`membrane_alaw_pipeline.ex` is byte-for-byte pristine — so they no longer need
patching here.)
