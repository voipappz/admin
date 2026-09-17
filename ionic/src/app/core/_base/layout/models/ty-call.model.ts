/**
 * Represents a call record from the API
 */
export interface TyCall {
    /** Unique call identifier */
    uuid: string;

    /** Legacy field - use meta._contact_fullname instead */
    name?: string;

    /** Call timestamp (ISO date string) - used for grouping by date */
    created_at?: string;

    /** Recording information */
    recording?: { url: string };

    /** Legacy audio source */
    audioSrc?: [{ src: string; type: string }];

    /** UI state: show/hide audio player */
    play_audio?: boolean;

    /** UI state: expand/collapse call details */
    show_notes?: boolean;

    /** Is the caller's number blocked */
    blacklisted?: boolean;

    /** Call metadata */
    meta?: TyCallMeta;
}

/**
 * Call metadata containing contact and call details
 */
export interface TyCallMeta {
    /** Call direction */
    _direction: 'incoming' | 'outgoing' | 'missed';

    /** Contact first name (empty string if unknown) */
    _contact_first_name: string;

    /** Contact last name (empty string if unknown) */
    _contact_last_name: string;

    /** Computed full name (first + last, or 'unknown') */
    _contact_fullname: string;

    /** Contact phone number */
    _contact_number: string;

    /** Call duration as string (e.g., '4:05') */
    _duration: string;

    /** Blacklist status for UI icon display */
    _blacklisted: boolean;
}

/**
 * Factory for creating mock call data
 */
export class TyCallFactory {
    /**
     * Hebrew-named fallback used by the calls page when the server returns
     * an empty list. The first two entries pair with the Hebrew mock
     * conversations registered by CallsPage.assignConversationVariants().
     */
    static createMockListHebrew(): TyCall[] {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        return [
            {
                uuid: 'mock-call-001',
                created_at: now.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'incoming',
                    _contact_first_name: 'יעל',
                    _contact_last_name: 'כהן',
                    _contact_fullname: 'יעל כהן',
                    _contact_number: '050-123-4567',
                    _duration: '2:22',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-002',
                created_at: now.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'outgoing',
                    _contact_first_name: 'רותם',
                    _contact_last_name: 'שפירא',
                    _contact_fullname: 'רותם שפירא',
                    _contact_number: '054-444-5555',
                    _duration: '3:35',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-003',
                created_at: now.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'missed',
                    _contact_first_name: 'עומר',
                    _contact_last_name: 'אזולאי',
                    _contact_fullname: 'עומר אזולאי',
                    _contact_number: '052-000-1111',
                    _duration: '0:00',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-004',
                created_at: yesterday.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'incoming',
                    _contact_first_name: 'נעה',
                    _contact_last_name: 'ברק',
                    _contact_fullname: 'נעה ברק',
                    _contact_number: '053-222-3333',
                    _duration: '1:15',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-005',
                created_at: yesterday.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'outgoing',
                    _contact_first_name: 'דניאל',
                    _contact_last_name: 'אבני',
                    _contact_fullname: 'דניאל אבני',
                    _contact_number: '058-555-7777',
                    _duration: '4:30',
                    _blacklisted: false
                }
            }
        ];
    }

    static createMockList(): TyCall[] {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        return [
            {
                uuid: 'mock-call-001',
                created_at: now.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'incoming',
                    _contact_first_name: 'John',
                    _contact_last_name: 'Doe',
                    _contact_fullname: 'John Doe',
                    _contact_number: '+1 555-123-4567',
                    _duration: '4:05',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-002',
                created_at: now.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'outgoing',
                    _contact_first_name: 'Jane',
                    _contact_last_name: 'Smith',
                    _contact_fullname: 'Jane Smith',
                    _contact_number: '+1 555-987-6543',
                    _duration: '2:30',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-003',
                created_at: now.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'missed',
                    _contact_first_name: '',
                    _contact_last_name: '',
                    _contact_fullname: 'unknown',
                    _contact_number: '+1 555-000-1111',
                    _duration: '0:00',
                    _blacklisted: false
                }
            },
            {
                uuid: 'mock-call-004',
                created_at: yesterday.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: true,
                meta: {
                    _direction: 'incoming',
                    _contact_first_name: 'Bob',
                    _contact_last_name: 'Wilson',
                    _contact_fullname: 'Bob Wilson',
                    _contact_number: '+1 555-222-3333',
                    _duration: '1:15',
                    _blacklisted: true
                }
            },
            {
                uuid: 'mock-call-005',
                created_at: yesterday.toISOString(),
                recording: { url: '' },
                play_audio: false,
                show_notes: false,
                blacklisted: false,
                meta: {
                    _direction: 'outgoing',
                    _contact_first_name: 'Alice',
                    _contact_last_name: 'Johnson',
                    _contact_fullname: 'Alice Johnson',
                    _contact_number: '+1 555-444-5555',
                    _duration: '8:45',
                    _blacklisted: false
                }
            }
        ];
    }
}
