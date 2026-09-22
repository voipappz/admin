import { Bot } from './bot.model';

/**
 * A phone number on the connectix box (`/api/admin/numbers`).
 *
 * The local resource keys on `id`; `uuid` is the mirror AdminService adds so the
 * existing pages keep working. A number's job is: these digits, answered by that
 * bot — hence `bot_id`/`bot` instead of the mothership's bridge/destination tree.
 */
export interface NumberEntity {
    /** Local primary key. */
    id?: string;
    /** Mirror of `id`. */
    uuid?: string;
    /** Bare E.164 digits, e.g. "972545234585". */
    number?: string;
    notes?: string;
    enabled?: boolean;

    /** Which bot answers this number (required by the local resource). */
    bot_id?: string;
    /** Mirror of `bot_id`. */
    bot_uuid?: string;
    /** Embedded bot row, present on list/get responses. */
    bot?: Bot | null;

    /** Carrier provenance — read-only here, set when bought through a carrier API. */
    provider?: string;
    provider_number_id?: string;
    connection_id?: string;

    inserted_at?: string;
    updated_at?: string;
    /** Mirror of `inserted_at`. */
    created_at?: string;

    /**
     * Mothership-only association. Retained so legacy callers still type-check;
     * the local API neither returns nor accepts it.
     */
    environment_uuid?: string;
    environment?: NumberEnvironment;
}

export interface NumberEnvironment {
    uuid: string;
    name?: string;
}
