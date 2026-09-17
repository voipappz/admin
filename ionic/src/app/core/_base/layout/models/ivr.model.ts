/**
 * IVR (Interactive Voice Response) Menu Model
 * Used for configuring automated phone menus
 */

export interface IvrEntry {
    entry: string;        // DTMF digit (0-9, *, #)
    name: string;         // Description of this option
    bridge_type: string;  // Destination type (extension, queue, ivr, etc.)
    bridge_uuid: string;  // Destination UUID
}

export interface Ivr {
    uuid?: string;
    created_at?: string;
    updated_at?: string;
    name?: string;                    // Required - IVR name
    enabled?: boolean;
    environment_uuid?: string;        // Environment UUID
    environment?: any;                // Populated environment object
    announcement_uuid?: string;       // Required - Greeting audio file
    announcement?: any;               // Populated announcement URL or object
    timeout?: number | string;        // Seconds to wait for input
    timeout_bridge_type?: string;     // Destination type when timeout
    timeout_bridge_uuid?: string;     // Destination UUID when timeout
    invalid?: number | string;        // Max invalid attempts before routing
    invalid_bridge_type?: string;     // Destination type for invalid input
    invalid_bridge_uuid?: string;     // Destination UUID for invalid input
    entries?: IvrEntry[];             // Menu options (what happens when 1, 2, 3... pressed)
    notes?: string;                   // Optional notes
    profile?: {                       // Profile settings
        direct_dial?: string;         // "true" or "false" - Allow direct extension dialing
    };
}

/**
 * Bridge types available for IVR routing
 */
export const IVR_BRIDGE_TYPES = [
    'extension',
    'queue',
    'ivr',
    'ring_group',
    'voicemail',
    'announcement',
    'number'
] as const;

export type IvrBridgeType = typeof IVR_BRIDGE_TYPES[number];

/**
 * DTMF keys available for IVR entries
 */
export const IVR_KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

export type IvrKeypadKey = typeof IVR_KEYPAD_KEYS[number];
