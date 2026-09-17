import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ConversationService } from '../../core/_base/layout/services/conversation.service';
import {
    Conversation,
    ConversationMessage,
    ConversationFactory
} from '../../core/_base/layout/models/conversation.model';

/**
 * Displays a call conversation/transcript in a chat-style interface.
 *
 * Features:
 * - WhatsApp-style message bubbles
 * - Speaker differentiation (agent vs caller)
 * - System messages (call started/ended)
 * - Timestamp display
 * - Auto-scroll to bottom
 * - Loading and error states
 *
 * Route: /app/conversation/:callUuid
 */
@Component({
    selector: 'page-conversation',
    templateUrl: 'conversation-page.html',
    styleUrls: ['./conversation-page.scss'],
    standalone: false
})
export class ConversationPage implements OnInit, OnDestroy {
    @ViewChild('messagesContainer') messagesContainer: ElementRef;

    /** The conversation data */
    conversation: Conversation | null = null;

    /** Loading state */
    loading = true;

    /** Error message if loading failed */
    error: string | null = null;

    /** Call UUID from route params */
    private callUuid: string = '';

    /** Route params subscription */
    private routeSub: Subscription | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private conversationService: ConversationService,
        private translate: TranslateService
    ) {}

    ngOnInit(): void {
        this.routeSub = this.route.params.subscribe(params => {
            this.callUuid = params['callUuid'];
            if (this.callUuid) {
                this.loadConversation();
            } else {
                this.error = 'No call ID provided';
                this.loading = false;
            }
        });
    }

    ngOnDestroy(): void {
        this.routeSub?.unsubscribe();
    }

    /**
     * Load conversation from service
     */
    loadConversation(): void {
        this.loading = true;
        this.error = null;

        this.conversationService.getByCallUuid(this.callUuid).subscribe({
            next: (conversation) => {
                this.conversation = conversation;
                this.loading = false;

                if (conversation.status === 'failed') {
                    this.error = conversation.error || 'Failed to load transcript';
                }

                // Scroll to bottom after view updates
                setTimeout(() => this.scrollToBottom(), 100);
            },
            error: (err) => {
                console.error('Error loading conversation:', err);
                this.error = err.message || 'Failed to load conversation';
                this.loading = false;
            }
        });
    }

    /**
     * Navigate back to calls page
     */
    goBack(): void {
        this.router.navigate(['/app/calls']);
    }

    /**
     * Refresh conversation data
     */
    refresh(): void {
        this.loadConversation();
    }

    /**
     * Format timestamp (seconds) to MM:SS display
     */
    formatTimestamp(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format call duration for header display
     */
    formatDuration(seconds: number): string {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) {
            return `${secs}s`;
        }
        return `${mins}m ${secs}s`;
    }

    /**
     * Format call date for header display
     */
    formatCallDate(date: Date): string {
        if (!date) return '';
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return this.translate.instant('DATE.TODAY') + ' ' + this.formatTime(d);
        }
        if (d.toDateString() === yesterday.toDateString()) {
            return this.translate.instant('DATE.YESTERDAY') + ' ' + this.formatTime(d);
        }
        return d.toLocaleDateString() + ' ' + this.formatTime(d);
    }

    /**
     * Format time portion of date
     */
    private formatTime(date: Date): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Get CSS class for message based on speaker
     */
    getMessageClass(message: ConversationMessage): string {
        switch (message.speaker) {
            case 'agent':
                return 'message-agent';
            case 'caller':
                return 'message-caller';
            case 'system':
                return 'message-system';
            default:
                return 'message-caller';
        }
    }

    /**
     * Get direction icon name
     */
    getDirectionIcon(): string {
        if (!this.conversation?.metadata) return 'call';
        switch (this.conversation.metadata.direction) {
            case 'incoming':
                return 'call-received';
            case 'outgoing':
                return 'call-made';
            case 'missed':
                return 'call-missed';
            default:
                return 'call';
        }
    }

    /**
     * Get status badge color
     */
    getStatusColor(): string {
        if (!this.conversation) return 'medium';
        switch (this.conversation.status) {
            case 'completed':
                return 'success';
            case 'processing':
                return 'warning';
            case 'pending':
                return 'medium';
            case 'failed':
                return 'danger';
            case 'unavailable':
                return 'medium';
            default:
                return 'medium';
        }
    }

    /**
     * Check if transcript is available
     */
    get hasTranscript(): boolean {
        return this.conversation?.status === 'completed' &&
               this.conversation?.messages?.length > 0;
    }

    /**
     * Check if transcript is still processing
     */
    get isProcessing(): boolean {
        return this.conversation?.status === 'processing' ||
               this.conversation?.status === 'pending';
    }

    /**
     * Scroll messages container to bottom
     */
    private scrollToBottom(): void {
        if (this.messagesContainer?.nativeElement) {
            const container = this.messagesContainer.nativeElement;
            container.scrollTop = container.scrollHeight;
        }
    }

    /**
     * Track messages by UUID for ngFor performance
     */
    trackByMessageId(index: number, message: ConversationMessage): string {
        return message.uuid;
    }
}
