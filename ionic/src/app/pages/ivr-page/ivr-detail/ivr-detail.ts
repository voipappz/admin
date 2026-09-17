import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { IvrService } from '../../../core/_base/layout/services/ivr.service';
import { Ivr, IvrEntry, IVR_KEYPAD_KEYS } from '../../../core/_base/layout/models/ivr.model';
import { IvrEditPage } from '../ivr-edit/ivr-edit';

@Component({
    selector: 'page-ivr-detail',
    templateUrl: 'ivr-detail.html',
    styleUrls: ['./ivr-detail.scss'],
    standalone: false
})
export class IvrDetailPage implements OnInit, OnDestroy, OnChanges {
    // Input for embedded usage (without routing)
    @Input() ivrUuid: string = '';
    @Input() embedded: boolean = false;

    ivr: Ivr | null = null;
    loading = true;
    error: string | null = null;

    // Audio playback
    isPlaying = false;
    audioProgress = 0;
    audioDuration = 0;
    currentTime = 0;
    waveformBars = new Array(30).fill(0); // 30 bars for waveform visualization
    private audio: HTMLAudioElement | null = null;

    // Keypad layout for display
    keypadLayout = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['*', '0', '#']
    ];

    // Data for resolving names
    announcements: any[] = [];
    bridgeData: { [key: string]: any[] } = {};

    private subscription: Subscription | null = null;
    private uuid: string = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private navCtrl: NavController,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private ivrService: IvrService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        // Get UUID from route if not provided via Input
        if (!this.ivrUuid) {
            this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
        } else {
            this.uuid = this.ivrUuid;
        }
        this.loadData();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Reload when ivrUuid input changes
        if (changes['ivrUuid'] && !changes['ivrUuid'].firstChange) {
            this.uuid = this.ivrUuid;
            this.loadIvr();
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.stopAudio();
    }

    private stopAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
            this.isPlaying = false;
            this.audioProgress = 0;
            this.currentTime = 0;
        }
    }

    playAnnouncement() {
        if (this.isPlaying) {
            this.stopAudio();
            return;
        }

        const url = this.ivr?.announcement;
        if (!url) return;

        this.audio = new Audio(url);

        this.audio.onloadedmetadata = () => {
            this.audioDuration = this.audio?.duration || 0;
        };

        this.audio.ontimeupdate = () => {
            if (this.audio) {
                this.currentTime = this.audio.currentTime;
                this.audioProgress = (this.audio.currentTime / this.audio.duration) * 100;
            }
        };

        this.audio.onended = () => {
            this.isPlaying = false;
            this.audioProgress = 0;
            this.currentTime = 0;
        };

        this.audio.onerror = () => {
            this.isPlaying = false;
            console.error('Error playing announcement');
        };

        this.audio.play();
        this.isPlaying = true;
    }

    formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    seekAudio(event: MouseEvent) {
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = clickX / rect.width;

        if (this.audio && this.audioDuration) {
            this.audio.currentTime = percentage * this.audioDuration;
            this.currentTime = this.audio.currentTime;
            this.audioProgress = percentage * 100;

            // Start playing if not already
            if (!this.isPlaying) {
                this.audio.play();
                this.isPlaying = true;
            }
        } else if (this.ivr?.announcement) {
            // If audio not loaded yet, load it and seek
            this.playAnnouncement();
            // Wait for metadata to load then seek
            if (this.audio) {
                this.audio.onloadedmetadata = () => {
                    if (this.audio) {
                        this.audioDuration = this.audio.duration;
                        this.audio.currentTime = percentage * this.audioDuration;
                    }
                };
            }
        }
    }

    ionViewWillEnter() {
        if (this.uuid) {
            this.loadIvr();
        }
    }

    loadData() {
        // Load supporting data first
        this.ivrService.getAnnouncements().subscribe(data => {
            this.announcements = data;
        });

        this.ivrService.getBridgeTypes().subscribe(types => {
            types.forEach(type => {
                this.ivrService.getBridgeData(type).subscribe(data => {
                    this.bridgeData[type] = data;
                });
            });
        });

        // Load IVR
        this.loadIvr();
    }

    loadIvr() {
        this.loading = true;
        this.error = null;

        this.subscription = this.ivrService.getIvr(this.uuid).subscribe({
            next: (ivr) => {
                // Parse response to convert entries object to array
                this.ivr = this.ivrService.parseIvrResponse(ivr);
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading IVR:', err);
                this.error = 'Failed to load IVR';
                this.loading = false;
            }
        });
    }

    /**
     * Open edit modal
     */
    async editIvr() {
        const modal = await this.modalCtrl.create({
            component: IvrEditPage,
            componentProps: {
                isNew: false,
                ivr: this.ivr
            }
        });

        await modal.present();

        const { data, role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadIvr();
        }
    }

    /**
     * Delete IVR with confirmation
     */
    async deleteIvr() {
        const alert = await this.alertCtrl.create({
            header: this.translate.instant('IVR.ACTIONS.DELETE_CONFIRM_TITLE'),
            message: this.translate.instant('IVR.ACTIONS.DELETE_CONFIRM_MESSAGE', { name: this.ivr?.name }),
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
        if (!this.ivr?.uuid) return;

        this.ivrService.deleteIvr(this.ivr.uuid).subscribe({
            next: () => {
                this.router.navigate(['/app/ivr']);
            },
            error: (err) => {
                console.error('Error deleting IVR:', err);
            }
        });
    }

    /**
     * Go back to previous page
     */
    goBack() {
        this.navCtrl.back();
    }

    // ==================
    // Helper Methods
    // ==================

    getAnnouncementName(): string {
        if (!this.ivr?.announcement_uuid) return this.translate.instant('BUTTONS.NOT_SET');
        const ann = this.announcements.find(a => a.uuid === this.ivr?.announcement_uuid);
        return ann?.name || 'Unknown';
    }

    getEntryForKey(key: string): IvrEntry | undefined {
        return this.ivr?.entries?.find(e => e.entry === key);
    }

    isKeyConfigured(key: string): boolean {
        return !!this.getEntryForKey(key);
    }

    getKeyDestinationLabel(key: string): string {
        const entry = this.getEntryForKey(key);
        if (!entry) return '';
        return entry.name || this.getDestinationName(entry.bridge_type, entry.bridge_uuid);
    }

    getDestinationName(type: string, uuid: string): string {
        if (!type || !uuid) return this.translate.instant('BUTTONS.NOT_SET');
        const items = this.bridgeData[type] || [];
        const item = items.find(i => i.uuid === uuid);
        return item?.name || 'Unknown';
    }

    getBridgeTypeLabel(type: string): string {
        if (!type) return '';
        const translationKey = `IVR.BRIDGE_TYPES.${type}`;
        const translated = this.translate.instant(translationKey);
        return translated !== translationKey ? translated : type;
    }

    getTimeoutDestinationLabel(): string {
        if (!this.ivr?.timeout_bridge_type || !this.ivr?.timeout_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }
        const typeName = this.getBridgeTypeLabel(this.ivr.timeout_bridge_type);
        const destName = this.getDestinationName(this.ivr.timeout_bridge_type, this.ivr.timeout_bridge_uuid);
        return `${typeName}: ${destName}`;
    }

    getInvalidDestinationLabel(): string {
        if (!this.ivr?.invalid_bridge_type || !this.ivr?.invalid_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }
        const typeName = this.getBridgeTypeLabel(this.ivr.invalid_bridge_type);
        const destName = this.getDestinationName(this.ivr.invalid_bridge_type, this.ivr.invalid_bridge_uuid);
        return `${typeName}: ${destName}`;
    }

    getConfiguredEntriesCount(): number {
        return this.ivr?.entries?.length || 0;
    }
}
