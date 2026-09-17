export interface Announcement {
    uuid?: string;
    created_at?: string;
    updated_at?: string;
    name: string;
    type?: 'file' | 'tts';
    enabled?: boolean;
    lang?: string;
    path?: string;
    file_url?: string;
    url?: string;
    text?: string;
    environment_uuid?: string;
}

export interface TtsGenerationRequest {
    lang: string;
    text: string;
}

export interface TtsGenerationResponse {
    path: string;
}

export interface AnnouncementCreateResult {
    uuid: string;
    name: string;
    type: 'file' | 'tts';
    path?: string;
    url?: string;
}
