import { Injectable } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HandleRequest } from './handleRequest.service';
import {
    Conversation,
    ConversationMessage,
    ConversationMetadata,
    ConversationFactory
} from '../models/conversation.model';

/**
 * Service for fetching and managing call conversation transcripts.
 *
 * Usage:
 * ```typescript
 * constructor(private conversationService: ConversationService) {}
 *
 * loadConversation(callUuid: string) {
 *   this.conversationService.getByCallUuid(callUuid).subscribe({
 *     next: (conversation) => this.conversation = conversation,
 *     error: (err) => console.error('Failed to load conversation:', err)
 *   });
 * }
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class ConversationService {
    private readonly apiPath = '/api/calls';

    /** Enable mock mode for development/testing */
    private useMockData = true;

    constructor(private handleRequest: HandleRequest) {}

    /**
     * Fetches the conversation transcript for a specific call.
     *
     * @param callUuid - The UUID of the call
     * @returns Observable<Conversation> - The conversation with messages
     */
    getByCallUuid(callUuid: string): Observable<Conversation> {
        if (this.useMockData) {
            return this.getMockConversation(callUuid);
        }

        return this.handleRequest
            .get(`${this.apiPath}/${callUuid}/transcript`)
            .pipe(
                map((response: any) => this.mapResponseToConversation(callUuid, response)),
                catchError((error) => {
                    console.error('Error fetching conversation:', error);
                    return of(ConversationFactory.createFailed(callUuid, error.message || 'Failed to load transcript'));
                })
            );
    }

    /**
     * Fetches conversation with call metadata included.
     * Combines call details API with transcript API.
     *
     * @param callUuid - The UUID of the call
     * @returns Observable<Conversation> - Complete conversation with metadata
     */
    getWithCallDetails(callUuid: string): Observable<Conversation> {
        if (this.useMockData) {
            return this.getMockConversation(callUuid);
        }

        // In real implementation, this would combine two API calls
        // or use a single endpoint that returns both
        return this.handleRequest
            .get(`${this.apiPath}/${callUuid}?action=load`)
            .pipe(
                map((callData: any) => {
                    const conversation = ConversationFactory.createPending(callUuid);
                    conversation.metadata = this.mapCallToMetadata(callData);
                    return conversation;
                }),
                catchError((error) => {
                    console.error('Error fetching call details:', error);
                    return of(ConversationFactory.createFailed(callUuid, error.message));
                })
            );
    }

    /**
     * Maps API response to Conversation model.
     * Adapt this method when the real API structure is known.
     */
    private mapResponseToConversation(callUuid: string, response: any): Conversation {
        // TODO: Adapt mapping when real API structure is defined
        const messages: ConversationMessage[] = (response.messages || response.transcript || [])
            .map((msg: any, index: number) => ({
                uuid: msg.uuid || msg.id || String(index),
                speaker: this.normalizeSpeaker(msg.speaker || msg.role),
                text: msg.text || msg.content || msg.message || '',
                timestamp: msg.timestamp || msg.time || 0,
                confidence: msg.confidence,
                speakerName: msg.speaker_name || msg.speakerName
            }));

        return {
            callUuid,
            status: 'completed',
            messages,
            metadata: response.metadata || {
                contactName: response.contact_name || '',
                contactNumber: response.contact_number || '',
                direction: response.direction || 'incoming',
                callDate: new Date(response.call_date || response.created_at),
                duration: response.duration || 0,
                agentName: response.agent_name
            }
        };
    }

    /**
     * Maps call data to ConversationMetadata
     */
    private mapCallToMetadata(callData: any): ConversationMetadata {
        const meta = callData.meta || {};
        return {
            contactName: meta._contact_fullname ||
                `${meta._contact_first_name || ''} ${meta._contact_last_name || ''}`.trim() ||
                'Unknown',
            contactNumber: meta._contact_number || '',
            direction: meta._direction || 'incoming',
            callDate: new Date(callData.created_at),
            duration: this.parseDuration(meta._duration),
            agentName: meta._agent_name
        };
    }

    /**
     * Normalizes speaker value to expected enum
     */
    private normalizeSpeaker(speaker: string): 'agent' | 'caller' | 'system' {
        const normalized = (speaker || '').toLowerCase();
        if (normalized === 'agent' || normalized === 'user' || normalized === 'operator') {
            return 'agent';
        }
        if (normalized === 'system' || normalized === 'bot' || normalized === 'auto') {
            return 'system';
        }
        return 'caller';
    }

    /**
     * Parses duration string (e.g., "4:05") to seconds
     */
    private parseDuration(duration: string | number): number {
        if (typeof duration === 'number') {
            return duration;
        }
        if (!duration) {
            return 0;
        }
        const parts = duration.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return parseInt(duration, 10) || 0;
    }

    /**
     * Returns mock conversation data for development/testing.
     * Simulates network delay.
     */
    private getMockConversation(callUuid: string): Observable<Conversation> {
        // Simulate network delay
        return of(ConversationFactory.createMock(callUuid)).pipe(
            delay(500)
        );
    }

    /**
     * Enables or disables mock data mode.
     * Useful for testing or when API is not available.
     */
    setMockMode(enabled: boolean): void {
        this.useMockData = enabled;
    }

    /**
     * Check if service is using mock data
     */
    isMockMode(): boolean {
        return this.useMockData;
    }
}
