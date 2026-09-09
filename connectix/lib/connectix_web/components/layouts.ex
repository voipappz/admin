defmodule ConnectixWeb.Layouts do
  @moduledoc """
  This module holds layouts and related functionality
  used by your application.
  """
  use ConnectixWeb, :html

  # Embed all files in layouts/* within this module.
  # The default root.html.heex file contains the HTML
  # skeleton of your application, namely HTML headers
  # and other static content.
  embed_templates "layouts/*"

  @doc """
  Renders your app layout.

  This function is typically invoked from every template,
  and it often contains your application menu, sidebar,
  or similar.

  ## Examples

      <Layouts.app flash={@flash}>
        <h1>Content</h1>
      </Layouts.app>

  """
  attr :flash, :map, required: true, doc: "the map of flash messages"

  attr :current_scope, :map,
    default: nil,
    doc: "the current [scope](https://hexdocs.pm/phoenix/scopes.html)"

  slot :inner_block, required: true

  def app(assigns) do
    ~H"""
    <header class="navbar px-4 sm:px-6 lg:px-8">
      <div class="flex-1">
        <a href="/" class="flex-1 flex w-fit items-center gap-2">
          <img src={~p"/images/logo.svg"} width="36" />
          <span class="text-sm font-semibold">v{Application.spec(:phoenix, :vsn)}</span>
        </a>
      </div>
      <div class="flex-none">
        <ul class="flex flex-column px-1 space-x-4 items-center">
          <li>
            <a href="https://phoenixframework.org/" class="btn btn-ghost">Website</a>
          </li>
          <li>
            <a href="https://github.com/phoenixframework/phoenix" class="btn btn-ghost">GitHub</a>
          </li>
          <li>
            <.theme_toggle />
          </li>
          <li>
            <a href="https://hexdocs.pm/phoenix/overview.html" class="btn btn-primary">
              Get Started <span aria-hidden="true">&rarr;</span>
            </a>
          </li>
        </ul>
      </div>
    </header>

    <main class="px-4 py-20 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-2xl space-y-4">
        {render_slot(@inner_block)}
      </div>
    </main>

    <.flash_group flash={@flash} />
    """
  end

  @doc """
  Shows the flash group with standard titles and content.

  ## Examples

      <.flash_group flash={@flash} />
  """
  attr :flash, :map, required: true, doc: "the map of flash messages"
  attr :id, :string, default: "flash-group", doc: "the optional id of flash container"

  def flash_group(assigns) do
    ~H"""
    <div id={@id} aria-live="polite">
      <.flash kind={:info} flash={@flash} />
      <.flash kind={:error} flash={@flash} />

      <.flash
        id="client-error"
        kind={:error}
        title={gettext("We can't find the internet")}
        phx-disconnected={show(".phx-client-error #client-error") |> JS.remove_attribute("hidden")}
        phx-connected={hide("#client-error") |> JS.set_attribute({"hidden", ""})}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="hero-arrow-path" class="ml-1 size-3 motion-safe:animate-spin" />
      </.flash>

      <.flash
        id="server-error"
        kind={:error}
        title={gettext("Something went wrong!")}
        phx-disconnected={show(".phx-server-error #server-error") |> JS.remove_attribute("hidden")}
        phx-connected={hide("#server-error") |> JS.set_attribute({"hidden", ""})}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="hero-arrow-path" class="ml-1 size-3 motion-safe:animate-spin" />
      </.flash>
    </div>
    """
  end

  @doc """
  Appearance, as ONE button that cycles system -> light -> dark.

  It was a three-state segmented control, which is the right shape in a wide
  header and the wrong one anywhere narrow: three targets side by side inside
  64px are ~18px each, too small to hit and too small to read. One button is
  one 40px target and still reaches all three states.

  Cycling rather than toggling keeps "system" reachable. A plain light/dark
  switch strands anyone who wants the OS to decide, and "follow the system" is
  the default every OS-level dark mode assumes.

  The icon shows the state you are IN, not the one you would move to. A control
  that displays its own destination reads as mislabelled every time the page
  loads.

  The state itself is written by the inline script in root.html.heex, which
  owns both localStorage and the `data-theme` attribute. This only decides
  which state comes next. See app.css for why the palette has to answer to
  BOTH `data-theme` and `prefers-color-scheme`.
  """
  def theme_toggle(assigns) do
    ~H"""
    <button
      id="theme-cycle"
      type="button"
      phx-hook="ThemeCycle"
      title="Appearance"
      aria-label="Appearance"
      class="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-none"
    >
      <%!-- All three icons ship; CSS shows the one matching the current state,
           so the button is correct on FIRST PAINT with no JS having run. The
           unstamped document is "system". Deciding this in JS would flash the
           wrong icon on every page load. --%>
      <.icon
        name="hero-computer-desktop"
        class="size-5 [[data-theme=light]_&]:hidden [[data-theme=dark]_&]:hidden"
      />
      <.icon name="hero-sun" class="size-5 hidden [[data-theme=light]_&]:block" />
      <.icon name="hero-moon" class="size-5 hidden [[data-theme=dark]_&]:block" />
    </button>
    """
  end
end
