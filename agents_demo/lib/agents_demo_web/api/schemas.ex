defmodule AgentsDemoWeb.Api.Schemas do
  @moduledoc """
  Request and response shapes for the public API.

  One module rather than one file per schema: there are few of them, they are
  read together, and `OpenApiSpex.schema/1` already gives each its own struct.
  """

  alias OpenApiSpex.Schema

  defmodule Conversation do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "Conversation",
      description: "A thread of messages between someone and the agent.",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        title: %Schema{type: :string, nullable: true},
        source: %Schema{
          type: :string,
          description:
            "Where the conversation came from. `api` for conversations you create here; " <>
              "`chat` for the web UI; a channel name such as `whatsapp` when it arrived from one.",
          example: "api"
        },
        bot_id: %Schema{type: :string, format: :uuid},
        bot_version_id: %Schema{
          type: :string,
          format: :uuid,
          description: "The published version pinned at creation; never changes."
        },
        handler: %Schema{
          type: :string,
          enum: ["bot", "human"],
          description: "Who answers. While `human`, messages are stored and the bot stands down."
        },
        inserted_at: %Schema{type: :string, format: :"date-time"},
        updated_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :source, :bot_id, :bot_version_id, :handler],
      example: %{
        "id" => "026aa1cd-8e5d-4f9f-8018-beffd094015a",
        "title" => "Refund policy",
        "source" => "api",
        "inserted_at" => "2026-08-16T10:34:43Z",
        "updated_at" => "2026-08-16T10:36:51Z"
      }
    })
  end

  defmodule Message do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "Message",
      description: """
      One entry in a conversation. A single agent turn can produce several:
      its reasoning, any tool calls it makes, and the reply itself. Clients
      that only want what to show the end user should keep
      `role: "assistant"` with `type: "text"`.
      """,
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        role: %Schema{
          type: :string,
          enum: ["user", "assistant", "system", "tool"],
          description: "Who produced it."
        },
        type: %Schema{
          type: :string,
          description: "text, thinking, tool_call, tool_result, …",
          example: "text"
        },
        text: %Schema{
          type: :string,
          nullable: true,
          description: "Present for textual entries; null for structured ones such as tool calls."
        },
        status: %Schema{type: :string, nullable: true, example: "completed"},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :role, :type],
      example: %{
        "id" => "4038ddc6-b29d-47ff-bb30-b4b9d39bc196",
        "role" => "assistant",
        "type" => "text",
        "text" => "I can search the web, keep files, and work through tasks with you.",
        "status" => "completed",
        "inserted_at" => "2026-08-16T10:36:51Z"
      }
    })
  end

  defmodule ConversationResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "ConversationResponse",
      type: :object,
      properties: %{data: Conversation},
      required: [:data]
    })
  end

  defmodule MessagesResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "MessagesResponse",
      type: :object,
      properties: %{data: %Schema{type: :array, items: Message}},
      required: [:data]
    })
  end

  defmodule CreateMessageRequest do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "CreateMessageRequest",
      type: :object,
      properties: %{
        text: %Schema{type: :string, minLength: 1, description: "What to say to the agent."},
        reply_id: %Schema{
          type: :string,
          description: "The id of an option the bot offered, instead of (or alongside) free text."
        }
      },
      example: %{"text" => "What can you help me with?"}
    })
  end

  defmodule CreateConversationRequest do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "CreateConversationRequest",
      type: :object,
      properties: %{
        title: %Schema{
          type: :string,
          description: "Optional. Generated from the first message otherwise."
        },
        bot_id: %Schema{
          type: :string,
          format: :uuid,
          description: "Pin this bot's current published version. Default: your default bot."
        },
        bot_version_id: %Schema{
          type: :string,
          format: :uuid,
          description: "Pin this exact published version instead, for reproducible integrations."
        }
      },
      example: %{"title" => "Refund policy"}
    })
  end

  defmodule BotVersionSummary do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotVersionSummary",
      description: "A version's identity and lifecycle, without its configuration.",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        number: %Schema{type: :integer, minimum: 1},
        status: %Schema{type: :string, enum: ["draft", "published", "retired"]},
        fingerprint: %Schema{
          type: :string,
          nullable: true,
          description: "`sha256:` digest of the canonical configuration; set on publish."
        },
        published_at: %Schema{type: :string, format: :"date-time", nullable: true},
        inserted_at: %Schema{type: :string, format: :"date-time"},
        updated_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :number, :status]
    })
  end

  defmodule Skill do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "Skill",
      description:
        "A Skill selected from the catalog, by stable id and version, with validated settings.",
      type: :object,
      properties: %{
        skill_id: %Schema{type: :string, example: "web_lookup"},
        skill_version: %Schema{type: :string, example: "1.0.0"},
        settings: %Schema{type: :object, additionalProperties: true},
        position: %Schema{type: :integer, minimum: 0}
      },
      required: [:skill_id, :skill_version]
    })
  end

  defmodule BotVersionAreas do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotVersionAreas",
      description: """
      The configuration areas of a version. Every area is optional on write and
      validated as a whole on publish; each has a fixed, documented shape.
      """,
      type: :object,
      properties: %{
        behavior: %Schema{
          type: :object,
          properties: %{
            instructions: %Schema{
              type: :string,
              description: "The complete prompt. Replaces the platform default, never extends it."
            },
            purpose: %Schema{type: :string, nullable: true},
            audience_description: %Schema{type: :string, nullable: true},
            languages: %Schema{type: :array, items: %Schema{type: :string}},
            style: %Schema{type: :string, nullable: true}
          }
        },
        model: %Schema{
          type: :object,
          properties: %{
            provider: %Schema{type: :string, enum: ["anthropic"]},
            name: %Schema{
              type: :string,
              nullable: true,
              description: "null = the deployment default"
            },
            temperature: %Schema{type: :number, nullable: true},
            thinking_budget_tokens: %Schema{type: :integer, nullable: true},
            max_output_tokens: %Schema{type: :integer, nullable: true}
          }
        },
        safety: %Schema{
          type: :object,
          properties: %{
            interrupt_on: %Schema{type: :array, items: %Schema{type: :string}},
            forbidden_tools: %Schema{type: :array, items: %Schema{type: :string}},
            data_classes: %Schema{type: :array, items: %Schema{type: :string}}
          }
        },
        knowledge: %Schema{type: :object, additionalProperties: true},
        memory: %Schema{type: :object, properties: %{files_enabled: %Schema{type: :boolean}}},
        output: %Schema{type: :object, additionalProperties: true},
        handoff: %Schema{
          type: :object,
          properties: %{
            enabled: %Schema{type: :boolean},
            destination: %Schema{type: :string, enum: ["human_operator"]},
            stand_down: %Schema{type: :boolean},
            in_hours_text: %Schema{type: :string, nullable: true},
            after_hours_text: %Schema{type: :string, nullable: true}
          }
        },
        voice: %Schema{type: :object, additionalProperties: true},
        limits: %Schema{
          type: :object,
          properties: %{
            max_runs: %Schema{type: :integer, minimum: 1, maximum: 50},
            tool_timeout_ms: %Schema{type: :integer},
            session_idle_timeout_seconds: %Schema{type: :integer, nullable: true},
            max_session_seconds: %Schema{type: :integer, nullable: true},
            token_budget: %Schema{type: :integer, nullable: true}
          }
        },
        availability: %Schema{
          type: :object,
          properties: %{
            time_zone: %Schema{type: :string, example: "Asia/Jerusalem"},
            windows: %Schema{
              type: :array,
              items: %Schema{
                type: :object,
                properties: %{
                  day: %Schema{
                    type: :string,
                    enum:
                      ~w(monday tuesday wednesday thursday friday saturday sunday weekdays weekends everyday)
                  },
                  start_minute: %Schema{type: :integer, minimum: 0, maximum: 1439},
                  end_minute: %Schema{type: :integer, minimum: 1, maximum: 1440}
                },
                required: [:day, :start_minute, :end_minute]
              }
            }
          }
        },
        audiences: %Schema{
          type: :object,
          properties: %{
            default_id: %Schema{type: :string, example: "customer"},
            entries: %Schema{
              type: :array,
              items: %Schema{
                type: :object,
                properties: %{
                  phone: %Schema{type: :string},
                  audience_id: %Schema{type: :string},
                  name: %Schema{type: :string, nullable: true}
                },
                required: [:phone, :audience_id]
              }
            }
          }
        },
        skills: %Schema{type: :array, items: Skill},
        change_note: %Schema{type: :string, nullable: true}
      }
    })
  end

  defmodule BotVersion do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotVersion",
      description: "A version in full: lifecycle plus every configuration area.",
      allOf: [
        BotVersionSummary,
        BotVersionAreas,
        %Schema{
          type: :object,
          properties: %{
            retired_at: %Schema{type: :string, format: :"date-time", nullable: true},
            conversations: %Schema{
              type: :integer,
              nullable: true,
              description: "How many conversations pin this version (listing only)."
            }
          }
        }
      ]
    })
  end

  defmodule Bot do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "Bot",
      description: """
      A bot's stable identity and lifecycle. What it does lives in its
      versions: `current_version` is the published one new conversations pin,
      `draft_version` the one being edited, if any.
      """,
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        name: %Schema{type: :string, maxLength: 100},
        slug: %Schema{
          type: :string,
          description: "Stable, URL-safe; derived from the name unless given."
        },
        description: %Schema{type: :string, nullable: true},
        status: %Schema{type: :string, enum: ["active", "archived"]},
        current_version: %Schema{allOf: [BotVersionSummary], nullable: true},
        draft_version: %Schema{allOf: [BotVersionSummary], nullable: true},
        inserted_at: %Schema{type: :string, format: :"date-time"},
        updated_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :name, :slug, :status],
      example: %{
        "id" => "9f1c2b3a-4d5e-6f70-8192-a3b4c5d6e7f8",
        "name" => "Support",
        "slug" => "support",
        "description" => "Answers billing questions.",
        "status" => "active",
        "current_version" => %{"id" => "…", "number" => 2, "status" => "published"},
        "draft_version" => nil
      }
    })
  end

  defmodule CreateBotRequest do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "CreateBotRequest",
      description: "Creates the bot and its draft v1 from `version`.",
      type: :object,
      properties: %{
        name: %Schema{type: :string, maxLength: 100},
        slug: %Schema{type: :string, description: "Optional; derived from the name."},
        description: %Schema{type: :string},
        version: BotVersionAreas
      },
      required: [:name],
      example: %{
        "name" => "Support",
        "version" => %{
          "behavior" => %{"instructions" => "You answer billing questions. Escalate refunds."},
          "skills" => [%{"skill_id" => "web_lookup", "skill_version" => "1.0.0"}]
        }
      }
    })
  end

  defmodule UpdateBotRequest do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "UpdateBotRequest",
      description: "`name`/`description` change the bot; `version` edits the draft.",
      type: :object,
      properties: %{
        name: %Schema{type: :string, maxLength: 100},
        description: %Schema{type: :string, nullable: true},
        version: BotVersionAreas
      },
      example: %{"version" => %{"behavior" => %{"instructions" => "Be brief."}}}
    })
  end

  defmodule PublishRequest do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "PublishRequest",
      type: :object,
      properties: %{
        retire_previous: %Schema{
          type: :boolean,
          description:
            "Also retire the version being replaced, so it can no longer be pinned explicitly."
        }
      }
    })
  end

  defmodule ValidationIssue do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "ValidationIssue",
      type: :object,
      properties: %{
        code: %Schema{type: :string, example: "no_instructions"},
        path: %Schema{type: :string, example: "behavior.instructions"},
        message: %Schema{type: :string}
      },
      required: [:code, :path, :message]
    })
  end

  defmodule ValidationReport do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "ValidationReport",
      type: :object,
      properties: %{
        valid: %Schema{type: :boolean},
        errors: %Schema{type: :array, items: ValidationIssue},
        warnings: %Schema{type: :array, items: ValidationIssue}
      },
      required: [:valid, :errors, :warnings]
    })
  end

  defmodule CapabilityBadge do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "CapabilityBadge",
      description: "One operation a Skill exposes to the model, with its policy.",
      type: :object,
      properties: %{
        id: %Schema{type: :string, example: "customer_lookup"},
        description: %Schema{type: :string},
        risk: %Schema{
          type: :string,
          enum: ["read", "write", "external", "destructive", "financial"]
        },
        approval: %Schema{type: :string, enum: ["none", "human"]},
        idempotent: %Schema{type: :boolean},
        timeout_ms: %Schema{type: :integer}
      },
      required: [:id, :risk, :approval]
    })
  end

  defmodule CatalogSkill do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "CatalogSkill",
      type: :object,
      properties: %{
        id: %Schema{type: :string, example: "web_lookup"},
        version: %Schema{type: :string, example: "1.0.0"},
        name: %Schema{type: :string},
        description: %Schema{type: :string},
        default_settings: %Schema{type: :object, additionalProperties: true},
        capabilities: %Schema{type: :array, items: CapabilityBadge}
      },
      required: [:id, :version, :name]
    })
  end

  defmodule SkillsResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "SkillsResponse",
      type: :object,
      properties: %{data: %Schema{type: :array, items: CatalogSkill}},
      required: [:data]
    })
  end

  defmodule CompiledSpec do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "CompiledSpec",
      description:
        "A version resolved into what the model runs with; nothing secret, nothing executable.",
      type: :object,
      properties: %{
        bot_version_id: %Schema{type: :string, format: :uuid},
        fingerprint: %Schema{type: :string, nullable: true},
        prompt: %Schema{type: :string, description: "The complete system prompt."},
        prompt_segments: %Schema{
          type: :array,
          items: %Schema{
            type: :object,
            properties: %{source: %Schema{type: :string}, text: %Schema{type: :string}}
          }
        },
        model: %Schema{type: :object, additionalProperties: true},
        skills: %Schema{type: :array, items: %Schema{type: :object, additionalProperties: true}},
        capabilities: %Schema{type: :array, items: CapabilityBadge},
        interrupt_on: %Schema{type: :array, items: %Schema{type: :string}},
        forbidden_tools: %Schema{type: :array, items: %Schema{type: :string}},
        limits: %Schema{type: :object, additionalProperties: true},
        availability: %Schema{type: :object, additionalProperties: true},
        audiences: %Schema{type: :object, additionalProperties: true},
        handoff: %Schema{type: :object, additionalProperties: true}
      }
    })
  end

  defmodule PreflightResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "PreflightResponse",
      type: :object,
      properties: %{
        data: %Schema{
          type: :object,
          properties: %{
            version_number: %Schema{type: :integer},
            report: ValidationReport,
            compiled: %Schema{allOf: [CompiledSpec], nullable: true}
          },
          required: [:version_number, :report]
        }
      },
      required: [:data]
    })
  end

  defmodule ValidationReportResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "ValidationReportResponse",
      type: :object,
      properties: %{data: ValidationReport},
      required: [:data]
    })
  end

  defmodule ValidationError do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "ValidationError",
      description: "A publish refused: the message plus the full report.",
      type: :object,
      properties: %{
        error: %Schema{type: :string},
        errors: %Schema{type: :array, items: ValidationIssue},
        warnings: %Schema{type: :array, items: ValidationIssue}
      },
      required: [:error]
    })
  end

  defmodule BotResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotResponse",
      type: :object,
      properties: %{data: Bot},
      required: [:data]
    })
  end

  defmodule BotsResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotsResponse",
      type: :object,
      properties: %{data: %Schema{type: :array, items: Bot}},
      required: [:data]
    })
  end

  defmodule BotVersionResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotVersionResponse",
      type: :object,
      properties: %{data: BotVersion},
      required: [:data]
    })
  end

  defmodule BotVersionsResponse do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "BotVersionsResponse",
      type: :object,
      properties: %{data: %Schema{type: :array, items: BotVersion}},
      required: [:data]
    })
  end

  defmodule Error do
    @moduledoc false
    require OpenApiSpex

    OpenApiSpex.schema(%{
      title: "Error",
      type: :object,
      properties: %{error: %Schema{type: :string}},
      required: [:error],
      example: %{"error" => "not found"}
    })
  end
end
