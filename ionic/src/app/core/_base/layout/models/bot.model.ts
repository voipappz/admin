/**
 * A bot on the connectix box (`/api/admin/bots`) — the thing that answers a
 * number. `script` is a plain-text rule list; see ScriptRule below.
 */
export interface Bot {
    /** Local primary key. */
    id?: string;
    /** Mirror of `id`. */
    uuid?: string;
    /** Required and unique. */
    name?: string;
    /** e.g. "gemini-2.5-flash". */
    model?: string;
    system_prompt?: string;
    greeting?: string;
    /** Raw script text — lines of `keyword => reply`, `#` starts a comment. */
    script?: string;
    enabled?: boolean;

    inserted_at?: string;
    updated_at?: string;
    /** Mirror of `inserted_at`. */
    created_at?: string;
}

/** One parsed line of a bot `script`. */
export interface ScriptRule {
    /** What the caller says. Empty for a comment-only line. */
    keyword: string;
    /** What the bot replies. */
    reply: string;
    /** True when the line was a `#` comment (or blank) — preserved verbatim. */
    comment: boolean;
    /** The original line, kept so comments/blank lines round-trip unchanged. */
    raw?: string;
}

/**
 * Parse a bot script into rule rows. `keyword => reply` becomes an editable
 * rule; `#` comments and blank lines are preserved verbatim so a save never
 * silently eats the author's notes.
 */
export function parseBotScript(script: string | null | undefined): ScriptRule[] {
    if (!script) { return []; }
    return script.split('\n').map((line) => {
        const trimmed = line.trim();
        const arrow = trimmed.indexOf('=>');
        if (trimmed.charAt(0) === '#' || trimmed === '' || arrow === -1) {
            return { keyword: '', reply: '', comment: true, raw: line };
        }
        return {
            keyword: trimmed.slice(0, arrow).trim(),
            reply: trimmed.slice(arrow + 2).trim(),
            comment: false,
            raw: line
        };
    });
}

/** Serialize rule rows back to script text. Empty rules are dropped. */
export function serializeBotScript(rules: ScriptRule[] | null | undefined): string {
    if (!rules || !rules.length) { return ''; }
    return rules
        .map((rule) => {
            if (rule.comment) { return rule.raw != null ? rule.raw : ''; }
            const keyword = (rule.keyword || '').trim();
            const reply = (rule.reply || '').trim();
            if (!keyword && !reply) { return null; }
            return keyword + ' => ' + reply;
        })
        .filter((line) => line !== null)
        .join('\n');
}
