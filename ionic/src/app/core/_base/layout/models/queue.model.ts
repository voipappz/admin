export interface Queue {
    uuid?: string;
    name: string;
    environment_uuid?: string;
    enabled?: boolean;
    strategy?: string;
    // Support both UUID (for create/update) and full object (from server response)
    intro_announcement_uuid?: string;
    intro_announcement?: QueueAnnouncement;
    hold_announcement_uuid?: string;
    hold_announcement?: QueueAnnouncement;
    max_wait_time?: number | string;
    max_wait_time_bridge_type?: string;
    max_wait_time_bridge_uuid?: string;
    agents?: string[];  // Array of user UUIDs
    tiers?: QueueTier[];  // Agent tiers with state info
    notes?: string;
}

export interface QueueAnnouncement {
    uuid: string;
    name?: string;
    url?: string;
    enabled?: boolean;
}

export interface QueueTier {
    queue?: string;
    agent: string;
    state?: string;
    level?: string;
    position?: string;
}

export interface QueueAgent {
    uuid: string;
    username?: string;
    fullname?: string;
    email?: string;
}
