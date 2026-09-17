import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { Announcement, TtsGenerationResponse } from '../models/announcement.model';
import { UserData } from '../../../providers/user-data';

declare var CONFIG: any;

@Injectable()
export class AnnouncementService {
    constructor(
        private handleRequest: HandleRequest,
        private http: HttpClient,
        private userData: UserData
    ) {}

    /**
     * Get all announcements
     */
    getAnnouncements(): Observable<Announcement[]> {
        return this.handleRequest.get('/api/announcements') as Observable<Announcement[]>;
    }

    /**
     * Get a single announcement by UUID
     */
    getAnnouncement(uuid: string): Observable<Announcement> {
        return this.handleRequest.get(`/api/announcements/${uuid}`) as Observable<Announcement>;
    }

    /**
     * Create announcement with file upload
     */
    createWithFile(file: File, name: string, enabled: boolean = true): Observable<Announcement> {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('enabled', enabled.toString());
        formData.append('type', 'file');
        // formData.append('action', 'announcement');


        // Add environment_uuid from logged-in user
        const user = this.userData.getUserData();
        if (user?.environment?.uuid) {
            formData.append('environment_uuid', user.environment.uuid);
        }
        formData.append('file', file);
        return this.handleRequest.postWithFiles('/api/announcements', formData) as Observable<Announcement>;
    }

    /**
     * Create announcement from TTS-generated audio
     */
    createFromTts(name: string, enabled: boolean, path: string, lang: string, text: string): Observable<Announcement> {
        const payload: any = {
            name,
            enabled,
            type: 'tts',
            path,
            lang,
            text
        };
        // Add environment_uuid from logged-in user
        const user = this.userData.getUserData();
        if (user?.environment?.uuid) {
            payload.environment_uuid = user.environment.uuid;
        }
        return this.handleRequest.post('/api/announcements', payload) as Observable<Announcement>;
    }

    /**
     * Generate TTS audio from text
     * Returns the path to the generated audio file
     */
    generateTts(lang: string, text: string): Observable<TtsGenerationResponse> {
        return this.handleRequest.post('/api/tts', { lang, text }) as Observable<TtsGenerationResponse>;
    }

    /**
     * Update an existing announcement
     */
    update(uuid: string, data: Partial<Announcement>): Observable<Announcement> {
        return this.handleRequest.patch(`/api/announcements/${uuid}`, data) as Observable<Announcement>;
    }

    /**
     * Delete an announcement
     */
    delete(uuid: string): Observable<void> {
        return this.handleRequest.delete(`/api/announcements/${uuid}`, {}).pipe(
            map(() => void 0)
        );
    }

    /**
     * Get the audio URL for an announcement
     * Handles various URL field names from the API
     */
    getAudioUrl(announcement: Announcement): string | null {
        return announcement.url || announcement.file_url || announcement.path || null;
    }
}
