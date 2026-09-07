defmodule Connectix.Agents.DemoSetup do
  @moduledoc """
  Demo-specific setup and configuration.

  This module contains demo-specific behavior that you would NOT want in production:
  - File seeding for new users
  - Default disk persistence configuration
  - Demo content management

  **For production**: Remove this module and configure persistence/seeding
  according to your application's needs.
  """

  alias Connectix.Config
  alias Sagents.FileSystem
  alias Sagents.FileSystem.FileSystemConfig
  alias Sagents.FileSystem.Persistence.Disk

  require Logger

  @doc """
  Ensure a user's filesystem is running.

  This function is idempotent - calling it multiple times for the same user
  will return the same filesystem scope without error.

  For new users (directory doesn't exist), copies template files from
  `priv/new_user_template/` to provide helpful starter content.

  Files are stored in:
  - **Development/Production**: `user_files/{user_id}/memories/` at project root
  - **Test**: `/tmp/connectix_test{partition}/user_files/{user_id}/memories/` (auto-cleaned)

  **Production Note**: In production, you might want:
  - Database-backed persistence
  - Cloud storage (S3, etc.)
  - No persistence (ephemeral conversations)
  - Per-organization or per-workspace storage

  ## Examples

      {:ok, scope_key} = DemoSetup.ensure_user_filesystem(user_id)
      # => {:ok, {:user, 123}}

  Note: callers don't pass this scope into `start_conversation_session/2`.
  `Connectix.Agents.Factory.create_agent/2` derives the same key from
  the FactoryConfig's `:scope` and ensures the filesystem is up before
  wiring the FileSystem middleware.
  """
  def ensure_user_filesystem(user_id) do
    # Setup directory structure and get storage path
    storage_path = setup_user_directory(user_id)

    # Create filesystem config with scope_key
    scope_key = {:user, user_id}

    {:ok, fs_config} =
      FileSystemConfig.new(%{
        scope_key: scope_key,
        base_directory: "Memories",
        persistence_module: Disk,
        debounce_ms: 5000,
        storage_opts: [path: storage_path]
      })

    # Start the filesystem (idempotent). File-change events are delivered
    # directly to subscribers via Sagents.Publisher (see
    # `Sagents.FileSystemServer.subscribe/1`).
    case FileSystem.ensure_filesystem(scope_key, [fs_config]) do
      {:ok, _pid} ->
        Logger.info("User filesystem ready for user #{user_id} (scope: #{inspect(scope_key)})")
        {:ok, scope_key}

      {:error, :supervisor_not_ready} = error ->
        # This is expected in async tests where FileSystemSupervisor isn't available
        Logger.debug(
          "FileSystemSupervisor not available for user #{user_id} - filesystem will not be available"
        )

        error

      {:error, :registry_unavailable} = error ->
        # This node is draining. Sagents deliberately does not start a
        # filesystem it cannot first check for, since it cannot see whether one
        # already exists elsewhere. A routine deploy, so :warning rather than
        # :error: logging it as a failure trains people to ignore the level.
        Logger.warning(
          "Filesystem for user #{user_id} not started: this node is draining, " <>
            "its Sagents registry is unavailable"
        )

        error

      {:error, reason} = error ->
        # Actual errors should be logged at error level
        Logger.error("Failed to start filesystem for user #{user_id}: #{inspect(reason)}")
        error
    end
  end

  # Private helper to setup user directory and return storage path
  defp setup_user_directory(user_id) do
    # CONNECTIX_DATA_DIR, or a per-environment default. See
    # `Connectix.Config.data_dir/0` — in particular why this cannot ask
    # `Mix.env()`, which does not exist in a release.
    base_path = Config.data_dir()
    storage_path = Path.join([base_path, to_string(user_id), "memories"])

    # Check if this is a new user (directory doesn't exist)
    is_new_user = not File.exists?(storage_path)

    if is_new_user do
      # New user - create directory and copy template files
      File.mkdir_p!(storage_path)

      priv_dir = :code.priv_dir(:connectix) |> to_string()
      template_path = Path.join(priv_dir, "new_user_template")

      if File.exists?(template_path) and not empty_directory?(storage_path) == false do
        # Copy contents of template directory (not the directory itself)
        copy_directory_contents(template_path, storage_path)
        Logger.info("Initialized filesystem for new user #{user_id} from template")
      else
        Logger.debug("Created empty filesystem directory for user #{user_id}")
      end
    else
      # Returning user - leave their files as-is
      Logger.debug("Using existing filesystem for user #{user_id}")
    end

    storage_path
  end

  # Check if directory is empty
  defp empty_directory?(path) do
    case File.ls(path) do
      {:ok, []} -> true
      {:ok, _entries} -> false
      {:error, _reason} -> true
    end
  end

  # Private helper to copy directory contents (not the directory itself)
  defp copy_directory_contents(source_dir, dest_dir) do
    {:ok, entries} = File.ls(source_dir)

    Enum.each(entries, fn entry ->
      source_path = Path.join(source_dir, entry)
      dest_path = Path.join(dest_dir, entry)

      if File.dir?(source_path) do
        # Recursively copy subdirectory
        File.mkdir_p!(dest_path)
        copy_directory_contents(source_path, dest_path)
      else
        # Copy file
        File.cp!(source_path, dest_path)
      end
    end)
  end
end
