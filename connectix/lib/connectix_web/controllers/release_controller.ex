defmodule ConnectixWeb.ReleaseController do
  @moduledoc """
  The release page for THIS node, and the assets on it.

  Two assets today: the Chrome extension, and the Ionic app served at `/app`.

  Both are built from the same commit this portal was, in their own node stages
  (`Dockerfile.production`'s `extension` and `ionic`), so "which client goes
  with this portal?" is answered by the page rather than by unpacking a zip.

  The extension posts to `/auth/user_login` here and opens its socket on
  `/ws/events` here, so the node it talks to is the only honest place to get it
  from. Downloading it from a shared release page is how an agent ends up
  running a build against a different deployment: the zip is identical from the
  outside, and the failure is a login that looks broken.

  `Dockerfile.production` builds it in its own node stage and copies the zip to
  `priv/extension/`. Nothing else in the image knows about node, and a build
  that skipped that stage answers 404 here rather than serving a stale file —
  absent is diagnosable, stale is not.

  ## Not behind Basic Auth

  Deliberately, and for the same reason as `/health`: the person who needs the
  zip is an AGENT, whose credential is the user login (`users`), not the portal
  UI account (`PORTAL_UI_USER`). Gating it on the account nobody hands out
  means nobody can install the extension.

  Nothing here is secret. The zip is the same public client every agent runs,
  and the only deployment-specific thing in it is the address of the very node
  you fetched it from.
  """
  use ConnectixWeb, :controller

  @relative_path "extension/voipappz-extension.zip"
  @sha_path "extension/build-sha"
  @basename "voipappz-extension"

  @doc """
  The release page. What a GitHub release page is for, served by the node the
  extension actually talks to.

  HTML rather than JSON because the reader is a person about to install
  something, and the two things they get wrong are both answered here: WHICH
  build this is (version and digest, on the page, not inside the zip) and that
  Chrome loads an extension from a FOLDER, never from the .zip they just
  downloaded. `/extension/info` is the same facts for a machine.
  """
  def index(conn, _params) do
    {version, digest, size, name} =
      case read() do
        {:ok, zip} ->
          {manifest_version(zip) || "unknown",
           Base.encode16(:crypto.hash(:sha256, zip), case: :lower), byte_size(zip), filename(zip)}

        :error ->
          {nil, nil, 0, nil}
      end

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, page(version, digest, size, name, origin(conn), app_section()))
  end

  @doc """
  What this node is publishing: whether an extension is present, its version,
  and the digest.

  The version is the PORTAL's — `mix.exs` is stamped into the manifest at build
  time — so a mismatch between `app_version` and `extension_version` means the
  zip did not come from this build. That is exactly what the post-deploy hook
  asserts.
  """
  def info(conn, _params) do
    case read() do
      {:ok, zip} ->
        json(conn, %{
          available: true,
          app_version: app_version(),
          extension_version: manifest_version(zip),
          build_sha: build_sha(),
          filename: filename(zip),
          bytes: byte_size(zip),
          sha256: Base.encode16(:crypto.hash(:sha256, zip), case: :lower),
          download: "/release/download"
        })

      :error ->
        conn
        |> put_status(:not_found)
        |> json(%{
          available: false,
          app_version: app_version(),
          reason: "this image was built without the extension stage"
        })
    end
  end

  @doc """
  The zip itself, under a name that says WHICH BUILD it is.

  The file is stored under a stable path so the code can find it, and served
  under `voipappz-extension-<version>-<sha>.zip` so it is still identifiable
  once it is sitting in someone's Downloads folder next to four others. A
  support conversation that starts "I have voipappz-extension.zip" establishes
  nothing; one that starts with the version and the commit establishes
  everything.
  """
  def download(conn, _params) do
    case read() do
      {:ok, zip} ->
        conn
        |> put_resp_content_type("application/zip")
        |> put_resp_header("content-disposition", ~s(attachment; filename="#{filename(zip)}"))
        |> send_resp(200, zip)

      :error ->
        conn
        |> put_resp_content_type("text/plain")
        |> send_resp(404, "no extension in this build\n")
    end
  end

  # voipappz-extension-0.1.0-a1b2c3d.zip. Each part is dropped rather than
  # written as a placeholder when it is unknown: "unknown" in a filename is
  # noise, and a name that is merely shorter is still correct.
  defp filename(zip) do
    [@basename, manifest_version(zip), build_sha()]
    |> Enum.reject(&(&1 in [nil, "", "unknown"]))
    |> Enum.join("-")
    |> Kernel.<>(".zip")
  end

  defp build_sha do
    case File.read(Path.join(:code.priv_dir(:connectix), @sha_path)) do
      {:ok, sha} -> String.trim(sha)
      {:error, _} -> nil
    end
  end

  defp read do
    case File.read(Path.join(:code.priv_dir(:connectix), @relative_path)) do
      {:ok, zip} -> {:ok, zip}
      {:error, _} -> :error
    end
  end

  defp app_version do
    :connectix |> Application.spec(:vsn) |> to_string()
  end

  # Read out of the zip rather than trusting a value written beside it: the
  # manifest IS what Chrome loads, so it is the only version that can be wrong
  # in a way that matters.
  defp manifest_version(zip) do
    with {:ok, files} <- :zip.extract(zip, [:memory]),
         {_name, json} <- Enum.find(files, fn {name, _} -> to_string(name) == "manifest.json" end),
         {:ok, %{"version" => version}} <- Jason.decode(json) do
      version
    else
      _ -> nil
    end
  end

  defp origin(conn) do
    scheme = if conn.scheme == :https, do: "https", else: "http"
    "#{scheme}://#{conn.host}"
  end

  defp bytes(n) when n > 0, do: "#{Float.round(n / 1024 / 1024, 2)} MB"
  defp bytes(_), do: "—"

  # A self-contained page: no layout, no assets, no LiveView. This route is in
  # no pipeline (see the router), so it has no root layout to render into — and
  # a download page that depends on the rest of the app rendering correctly is
  # exactly the page you cannot reach on the day you need it.
  defp page(version, digest, size, name, origin, app_section) do
    {status, body} =
      if version do
        {"v#{version}",
         """
         <ol>
           <li><b>Download</b> the package below and <b>unzip</b> it to a folder you keep, for example <code>~/voipappz-extension</code>.</li>
           <li>Open <code>chrome://extensions</code> — type it, links to it do not work.</li>
           <li>Turn on <b>Developer mode</b>, top right.</li>
           <li><b>Load unpacked</b>, and pick the folder that directly holds <code>manifest.json</code>.</li>
           <li><b>Pin</b> it from the puzzle-piece icon, then click it and sign in.</li>
         </ol>
         <p class="warn"><b>Chrome loads it from that folder every start — it does not copy it.</b>
         Move or delete the folder and the extension stops working.</p>
         <h2>Sign in</h2>
         <table>
           <tr><th>Domain</th><td><code>#{origin}</code></td></tr>
           <tr><th>Username</th><td>your <b>user</b> email address</td></tr>
           <tr><th>Password</th><td>that user's password</td></tr>
         </table>
         <p class="note">It is the <b>user</b> login, not the portal account — a different credential
         in a different table. Both wrong ones return the same <code>Invalid email or password</code>.</p>
         <h2>Two things that look like failures and are not</h2>
         <ul>
           <li>Chrome asks at every start whether to keep it. That is how it stops extensions being
               installed behind your back. It applies to every unpacked extension. Choose keep.</li>
           <li>A standing "disable developer mode extensions" warning. Expected.</li>
         </ul>
         <p class="note">Both stop only for Web Store installs.</p>
         <h2>If it does not work</h2>
         <table class="tbl">
           <tr><th>What you see</th><th>Why</th></tr>
           <tr><td>No <b>Load unpacked</b> button</td><td>Developer mode is off</td></tr>
           <tr><td>"Manifest file is missing or unreadable"</td>
               <td>You picked the .zip, or the wrong folder level — pick the one directly holding <code>manifest.json</code></td></tr>
           <tr><td>Gone after restarting Chrome</td><td>The folder was moved or deleted, or the startup prompt was declined</td></tr>
           <tr><td>No icon in the toolbar</td><td>Not pinned</td></tr>
           <tr><td><code>Invalid email or password</code></td>
               <td>The portal account instead of the user login, or a <code>+</code> in the address — which is rejected before the password is checked</td></tr>
         </table>
         """}
      else
        {"not in this build",
         """
         <p class="warn">This portal was built without the extension stage, so there is nothing to download.
         Rebuild the image from <code>Dockerfile.production</code>, which builds <code>chrome/</code> and
         copies the package into the release.</p>
         """}
      end

    download =
      if version do
        """
        <a class="dl" href="/release/download">Download #{name}</a>
        <dl>
          <dt>Version</dt><dd>#{version} <span class="note">— same version as this portal</span></dd>
          <dt>Build</dt><dd>#{build_sha() || "unknown"} <span class="note">— the commit this node was built from</span></dd>
          <dt>Size</dt><dd>#{bytes(size)}</dd>
          <dt>SHA-256</dt><dd><code class="sha">#{digest}</code></dd>
          <dt>Serves</dt><dd><code>#{origin}</code></dd>
        </dl>
        """
      else
        ""
      end

    """
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>What this node ships</title>
    <style>
      :root { color-scheme: light dark; --fg:#111; --bg:#fff; --mut:#666; --line:#e3e3e3; --acc:#1a56db; --warnbg:#fff8e1; --warnln:#ffca28; }
      @media (prefers-color-scheme: dark) {
        :root { --fg:#e8e8e8; --bg:#16181d; --mut:#9aa0a6; --line:#2c2f36; --acc:#7aa2f7; --warnbg:#2a2413; --warnln:#8a6d1f; }
      }
      * { box-sizing: border-box; }
      body { margin:0; background:var(--bg); color:var(--fg);
             font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
      main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; }
      h1 { font-size:1.7rem; margin:0 0 .25rem; letter-spacing:-.02em; }
      h2 { font-size:1.05rem; margin:2.25rem 0 .5rem; padding-top:1.25rem; border-top:1px solid var(--line); }
      h3 { font-size:.98rem; margin:1.75rem 0 .5rem; }
      .sub { color:var(--mut); margin:0 0 2rem; }
      .dl { display:inline-block; background:var(--acc); color:#fff; text-decoration:none;
            padding:.7rem 1.15rem; border-radius:7px; font-weight:600; }
      .dl:hover { filter:brightness(1.08); }
      dl { display:grid; grid-template-columns:max-content 1fr; gap:.4rem 1.25rem; margin:1.5rem 0 0; }
      dt { color:var(--mut); }
      dd { margin:0; }
      code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.875em;
             background:color-mix(in srgb, var(--fg) 8%, transparent); padding:.12em .4em; border-radius:4px; }
      .sha { word-break:break-all; font-size:.78em; }
      table { border-collapse:collapse; margin:.5rem 0; }
      th { text-align:left; padding:.35rem 1.25rem .35rem 0; color:var(--mut); font-weight:400; vertical-align:top; }
      td { padding:.35rem 0; }
      .tbl { width:100%; }
      .tbl th { border-bottom:1px solid var(--line); padding-bottom:.5rem; }
      .tbl td { border-bottom:1px solid var(--line); padding:.55rem 1.25rem .55rem 0; vertical-align:top; }
      .tbl td:last-child { padding-right:0; color:var(--mut); }
      ol, ul { padding-left:1.25rem; }
      li { margin:.35rem 0; }
      .warn { background:var(--warnbg); border-left:3px solid var(--warnln); padding:.75rem 1rem; border-radius:0 5px 5px 0; }
      .note { color:var(--mut); font-size:.9em; }
      footer { margin-top:3rem; padding-top:1.25rem; border-top:1px solid var(--line); color:var(--mut); font-size:.85em; }
      footer a { color:var(--acc); }
    </style></head>
    <body><main>
      <h1>What this node ships</h1>
      <p class="sub">Two clients, built from the same commit this portal was.
      One is <b>served here</b>; the other is a <b>download</b> you install in Chrome.</p>
      #{app_section}
      <h2>Chrome extension <span class="note">— a download, not served</span></h2>
      <p class="sub">Screen pops, call state and agent availability — #{status}.
      Chrome runs it from a folder you unzip; nothing serves it at a URL.</p>
      #{download}
      <h3>Install</h3>
      #{body}
      <footer>Built and served by this node. Machine-readable: <a href="/release/info">/release/info</a></footer>
    </main></body></html>
    """
  end

  # THE IONIC APP — the second asset, and the reason this page is not titled
  # after the extension any more. It needs no install instructions: it is
  # served by this origin at /app, so the "download" is a link.
  #
  # Absence is reported rather than hidden. A release built without the `ionic`
  # stage serves a 503 at /app, and this page is where someone looks to find
  # out whether the bundle is in the image at all.
  defp app_section do
    case app_bundle() do
      {files, bytes} ->
        """
        <h2>The app <span class="note">— served by this node</span></h2>
        <p class="sub">The portal UI — calls, dashboard, the softphone. Inside this release, at
        <code>/app</code>, same origin as the API and the socket. Nothing to install.</p>
        <a class="dl" href="/app">Open the app</a>
        <dl>
          <dt>Build</dt><dd>#{build_sha() || "unknown"} <span class="note">— the commit this node was built from</span></dd>
          <dt>Files</dt><dd>#{files} <span class="note">— including the pre-compressed copies</span></dd>
          <dt>Size</dt><dd>#{bytes(bytes)}</dd>
          <dt>Served at</dt><dd><code>/app</code></dd>
        </dl>
        """

      :none ->
        """
        <h2>The app</h2>
        <p class="warn">This image was built without the <code>ionic</code> stage, so <code>/app</code>
        has nothing to serve and answers 503. Rebuild from <code>Dockerfile.production</code>, which
        builds <code>ionic/</code> and copies the bundle into the release.</p>
        """
    end
  end

  # Counted rather than stored: a build manifest would be one more thing that
  # can disagree with the directory beside it. This page is not on a hot path.
  defp app_bundle do
    dir = ConnectixWeb.AppController.bundle_dir()

    if File.regular?(Path.join(dir, "index.html")) do
      Path.wildcard(Path.join(dir, "**/*"))
      |> Enum.reduce({0, 0}, fn path, {files, bytes} ->
        case File.stat(path) do
          {:ok, %{type: :regular, size: size}} -> {files + 1, bytes + size}
          _directory_or_gone -> {files, bytes}
        end
      end)
    else
      :none
    end
  end

end
