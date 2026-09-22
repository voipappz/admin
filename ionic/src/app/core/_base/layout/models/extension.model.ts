/**
 * A SIP extension on the connectix box — a row of `/api/admin/users`. On this
 * box a "user" IS an extension: a username the phone REGISTERs as (9001, 9002),
 * a display name, a password, and whether the box itself registers it.
 *
 * A row that also carries `server`/`port`/`domain` is a carrier trunk
 * (e.g. sip.telnyx.com) rather than a desk phone.
 */
export interface Extension {
    /** Local primary key. */
    id?: string;
    /** Mirror of `id`. */
    uuid?: string;

    /** SIP username / extension number, e.g. "9001". */
    username?: string;
    display_name?: string;
    /**
     * Write-only. Always null in responses — send it only when setting a new one.
     */
    password?: string | null;
    enabled?: boolean;
    /** Whether the box registers this account itself. Serialized as `register?`. */
    'register?'?: boolean;

    /** Set together, these make the row a carrier trunk instead of a desk phone. */
    server?: string | null;
    port?: number | null;
    domain?: string | null;

    inserted_at?: string;
    updated_at?: string;
    /** Mirror of `inserted_at`. */
    created_at?: string;

    /**
     * Mothership-only fields. Retained so legacy callers still type-check; the
     * local API neither returns nor accepts them.
     */
    name?: string;
    notes?: string;
    switch?: string;
    user?: ExtensionUser;
    environment?: ExtensionEnvironment;
}

export interface ExtensionUser {
    uuid: string;
    name?: string;
}

export interface ExtensionEnvironment {
    uuid: string;
    name?: string;
    created_at?: string;
}
