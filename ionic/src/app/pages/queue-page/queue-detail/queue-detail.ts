import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { QueueService } from '../../../core/_base/layout/services/queue.service';
import { Queue, QueueAgent, QueueTier } from '../../../core/_base/layout/models/queue.model';
import { QueueEditPage } from '../queue-edit/queue-edit';

@Component({
    selector: 'page-queue-detail',
    templateUrl: 'queue-detail.html',
    styleUrls: ['./queue-detail.scss'],
    standalone: false
})
export class QueueDetailPage implements OnInit, OnDestroy, OnChanges {
    // Input for embedded usage (without routing)
    @Input() queueUuid: string = '';
    @Input() embedded: boolean = false;
    @Output() onEdit = new EventEmitter<Queue>();

    queue: Queue | null = null;
    loading = true;
    error: string | null = null;

    // Audio playback
    isPlayingIntro = false;
    isPlayingHold = false;
    introAudioProgress = 0;
    holdAudioProgress = 0;
    introAudioDuration = 0;
    holdAudioDuration = 0;
    introCurrentTime = 0;
    holdCurrentTime = 0;
    waveformBars = new Array(30).fill(0);
    private introAudio: HTMLAudioElement | null = null;
    private holdAudio: HTMLAudioElement | null = null;

    // Data for resolving names
    announcements: any[] = [];
    bridgeData: { [key: string]: any[] } = {};
    allAgents: QueueAgent[] = [];

    private subscription: Subscription | null = null;
    private uuid: string = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private navCtrl: NavController,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private queueService: QueueService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        // Get UUID from route if not provided via Input
        if (!this.queueUuid) {
            this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
        } else {
            this.uuid = this.queueUuid;
        }
        this.loadData();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Reload when queueUuid input changes
        if (changes['queueUuid'] && !changes['queueUuid'].firstChange) {
            this.uuid = this.queueUuid;
            this.loadQueue();
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.stopIntroAudio();
        this.stopHoldAudio();
    }

    ionViewWillEnter() {
        if (this.uuid) {
            this.loadQueue();
        }
    }

    loadData() {
        // Load supporting data
        this.queueService.getAnnouncements().subscribe(data => {
            this.announcements = data || [];
        });

        this.queueService.getBridgeTypes().subscribe(types => {
            types?.forEach(type => {
                this.queueService.getBridgeData(type).subscribe(data => {
                    this.bridgeData[type] = data || [];
                });
            });
        });

        this.queueService.getAgents().subscribe(data => {
            this.allAgents = data || [];
        });

        // Load Queue
        this.loadQueue();
    }

    loadQueue() {
        if (!this.uuid) return;

        this.loading = true;
        this.error = null;

        this.subscription = this.queueService.get(this.uuid).subscribe({
            next: (queue) => {
                this.queue = queue;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading Queue:', err);
                this.error = 'Failed to load Queue';
                this.loading = false;
            }
        });
    }

    // ==================
    // Audio Playback
    // ==================

    private stopIntroAudio() {
        if (this.introAudio) {
            this.introAudio.pause();
            this.introAudio = null;
            this.isPlayingIntro = false;
            this.introAudioProgress = 0;
            this.introCurrentTime = 0;
        }
    }

    private stopHoldAudio() {
        if (this.holdAudio) {
            this.holdAudio.pause();
            this.holdAudio = null;
            this.isPlayingHold = false;
            this.holdAudioProgress = 0;
            this.holdCurrentTime = 0;
        }
    }

    playIntroAnnouncement() {
        if (this.isPlayingIntro) {
            this.stopIntroAudio();
            return;
        }

        const url = this.getIntroAnnouncementUrl();
        if (!url) return;

        this.introAudio = new Audio(url);
        this.setupAudioHandlers(this.introAudio, 'intro');
        this.introAudio.play();
        this.isPlayingIntro = true;
    }

    playHoldAnnouncement() {
        if (this.isPlayingHold) {
            this.stopHoldAudio();
            return;
        }

        const url = this.getHoldAnnouncementUrl();
        if (!url) return;

        this.holdAudio = new Audio(url);
        this.setupAudioHandlers(this.holdAudio, 'hold');
        this.holdAudio.play();
        this.isPlayingHold = true;
    }

    private setupAudioHandlers(audio: HTMLAudioElement, type: 'intro' | 'hold') {
        audio.onloadedmetadata = () => {
            if (type === 'intro') {
                this.introAudioDuration = audio.duration || 0;
            } else {
                this.holdAudioDuration = audio.duration || 0;
            }
        };

        audio.ontimeupdate = () => {
            if (type === 'intro') {
                this.introCurrentTime = audio.currentTime;
                this.introAudioProgress = (audio.currentTime / audio.duration) * 100;
            } else {
                this.holdCurrentTime = audio.currentTime;
                this.holdAudioProgress = (audio.currentTime / audio.duration) * 100;
            }
        };

        audio.onended = () => {
            if (type === 'intro') {
                this.isPlayingIntro = false;
                this.introAudioProgress = 0;
                this.introCurrentTime = 0;
            } else {
                this.isPlayingHold = false;
                this.holdAudioProgress = 0;
                this.holdCurrentTime = 0;
            }
        };

        audio.onerror = () => {
            if (type === 'intro') {
                this.isPlayingIntro = false;
            } else {
                this.isPlayingHold = false;
            }
            console.error('Error playing announcement');
        };
    }

    formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================
    // Edit/Delete
    // ==================

    async editQueue() {
        const modal = await this.modalCtrl.create({
            component: QueueEditPage,
            componentProps: {
                isNew: false,
                isModal: true,
                queue: this.queue
            }
        });

        await modal.present();

        const { data, role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadQueue();
            this.onEdit.emit(data);
        }
    }

    async deleteQueue() {
        const alert = await this.alertCtrl.create({
            header: this.translate.instant('QUEUE.ACTIONS.DELETE_CONFIRM_TITLE'),
            message: this.translate.instant('QUEUE.ACTIONS.DELETE_CONFIRM_MESSAGE', { name: this.queue?.name }),
            buttons: [
                {
                    text: this.translate.instant('BUTTONS.CANCEL'),
                    role: 'cancel'
                },
                {
                    text: this.translate.instant('BUTTONS.DELETE'),
                    role: 'destructive',
                    handler: () => {
                        this.confirmDelete();
                    }
                }
            ]
        });

        await alert.present();
    }

    private confirmDelete() {
        if (!this.queue?.uuid) return;

        this.queueService.delete(this.queue.uuid).subscribe({
            next: () => {
                this.router.navigate(['/app/queues']);
            },
            error: (err) => {
                console.error('Error deleting Queue:', err);
            }
        });
    }

    goBack() {
        this.navCtrl.back();
    }

    // ==================
    // Helper Methods
    // ==================

    getStrategyLabel(strategy: string): string {
        if (!strategy) return this.translate.instant('BUTTONS.NOT_SET');
        const translationKey = `QUEUE.STRATEGIES.${strategy}`;
        const translated = this.translate.instant(translationKey);
        return translated !== translationKey
            ? translated
            : strategy.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Get intro announcement name - supports both object and UUID formats
    getIntroAnnouncementName(): string {
        // Check for full object first (server response)
        if (this.queue?.intro_announcement?.name) {
            return this.queue.intro_announcement.name;
        }
        // Fallback to UUID lookup
        const uuid = this.queue?.intro_announcement_uuid || this.queue?.intro_announcement?.uuid;
        if (!uuid) return this.translate.instant('BUTTONS.NOT_SET');
        const ann = this.announcements.find(a => a.uuid === uuid);
        return ann?.name || 'Unknown';
    }

    // Get intro announcement URL for audio playback
    getIntroAnnouncementUrl(): string {
        if (this.queue?.intro_announcement?.url) {
            return this.queue.intro_announcement.url;
        }
        const uuid = this.queue?.intro_announcement_uuid || this.queue?.intro_announcement?.uuid;
        if (!uuid) return '';
        const ann = this.announcements.find(a => a.uuid === uuid);
        return ann?.url || ann?.file_url || '';
    }

    // Get hold announcement name - supports both object and UUID formats
    getHoldAnnouncementName(): string {
        // Check for full object first (server response)
        if (this.queue?.hold_announcement?.name) {
            return this.queue.hold_announcement.name;
        }
        // Fallback to UUID lookup
        const uuid = this.queue?.hold_announcement_uuid || this.queue?.hold_announcement?.uuid;
        if (!uuid) return this.translate.instant('BUTTONS.NOT_SET');
        const ann = this.announcements.find(a => a.uuid === uuid);
        return ann?.name || 'Unknown';
    }

    // Get hold announcement URL for audio playback
    getHoldAnnouncementUrl(): string {
        if (this.queue?.hold_announcement?.url) {
            return this.queue.hold_announcement.url;
        }
        const uuid = this.queue?.hold_announcement_uuid || this.queue?.hold_announcement?.uuid;
        if (!uuid) return '';
        const ann = this.announcements.find(a => a.uuid === uuid);
        return ann?.url || ann?.file_url || '';
    }

    getBridgeTypeLabel(type: string): string {
        if (!type) return '';
        const translationKey = `IVR.BRIDGE_TYPES.${type}`;
        const translated = this.translate.instant(translationKey);
        return translated !== translationKey ? translated : type;
    }

    getDestinationName(type: string, uuid: string): string {
        if (!type || !uuid) return this.translate.instant('BUTTONS.NOT_SET');
        const items = this.bridgeData[type] || [];
        const item = items.find(i => i.uuid === uuid);
        return item?.name || 'Unknown';
    }

    getFallbackDestinationLabel(): string {
        if (!this.queue?.max_wait_time_bridge_type || !this.queue?.max_wait_time_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }
        const typeName = this.getBridgeTypeLabel(this.queue.max_wait_time_bridge_type);
        const destName = this.getDestinationName(this.queue.max_wait_time_bridge_type, this.queue.max_wait_time_bridge_uuid);
        return `${typeName}: ${destName}`;
    }

    getAgentsCount(): number {
        return this.queue?.agents?.length || 0;
    }

    getAgentName(uuid: string): string {
        const agent = this.allAgents.find(a => a.uuid === uuid);
        return agent?.fullname || agent?.username || agent?.email || uuid;
    }

    getQueueAgents(): QueueAgent[] {
        if (!this.queue?.agents) return [];
        return this.queue.agents
            .map(uuid => this.allAgents.find(a => a.uuid === uuid))
            .filter((a): a is QueueAgent => !!a);
    }

    // Get tier info for an agent
    getAgentTier(agentUuid: string): QueueTier | undefined {
        return this.queue?.tiers?.find(t => t.agent === agentUuid);
    }
}
