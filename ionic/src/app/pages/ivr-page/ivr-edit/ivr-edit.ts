import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ActionSheetController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { IvrService } from '../../../core/_base/layout/services/ivr.service';
import { Ivr, IvrEntry, IVR_KEYPAD_KEYS } from '../../../core/_base/layout/models/ivr.model';
import { AnnouncementCreateModal } from '../../../partials/announcement-create/announcement-create.modal';
import { Announcement } from '../../../core/_base/layout/models/announcement.model';
import { EntityActionSheetService } from '../../../core/_base/layout/services/entity-action-sheet.service';
import { TimeConditionPage } from '../../time-condition-page/time-condition-page';
import { QueueEditPage } from '../../queue-page/queue-edit/queue-edit';
import { ExtensionEditPage } from '../../extension-page/extension-edit/extension-edit';
import { NumberEditPage } from '../../number-page/number-edit/number-edit';

@Component({
    selector: 'page-ivr-edit',
    templateUrl: 'ivr-edit.html',
    styleUrls: ['./ivr-edit.scss'],
    standalone: false
})
export class IvrEditPage implements OnInit {
    @Input() isNew = true;
    @Input() ivr: Ivr | null = null;

    // Step wizard state
    currentStep = 1;
    totalSteps = 4;

    // Form data
    formData: Ivr = {
        name: '',
        enabled: true,
        profile: { direct_dial: 'false' },
        announcement_uuid: '',
        entries: [],
        timeout: 5,
        timeout_bridge_type: '',
        timeout_bridge_uuid: '',
        invalid: 3,
        invalid_bridge_type: '',
        invalid_bridge_uuid: '',
        notes: ''
    };

    // Data for dropdowns
    announcements: any[] = [];
    bridgeTypes: string[] = [];
    bridgeData: { [key: string]: any[] } = {};

    // Keypad keys
    keypadKeys = IVR_KEYPAD_KEYS;
    keypadLayout = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['*', '0', '#']
    ];

    // Validation
    stepValid: { [step: number]: boolean } = {
        1: false,
        2: false,
        3: true,  // Menu options are optional
        4: true   // Fallback has defaults
    };

    saving = false;

    // Make modal component available to template
    AnnouncementCreateModal = AnnouncementCreateModal;

    // Audio playback
    isPlaying = false;
    audioProgress = 0;
    audioDuration = 0;
    currentTime = 0;
    waveformBars = new Array(30).fill(0);
    private audio: HTMLAudioElement | null = null;
    private currentAnnouncementUrl: string = '';

    // Bridge type → create modal mapping (keys must match API bridge types - lowercase)
    private createModals: { [type: string]: { component: any, props?: any } } = {
        'announcement': { component: AnnouncementCreateModal },
        'ivr': { component: IvrEditPage, props: { isNew: true } },
        'call_condition': { component: TimeConditionPage, props: { isNew: true, isModal: true } },
        'queue': { component: QueueEditPage, props: { isNew: true, isModal: true } },
        'extension': { component: ExtensionEditPage, props: { isNew: true, isModal: true } },
        'number': { component: NumberEditPage, props: { isNew: true, isModal: true } }
    };

    constructor(
        private modalCtrl: ModalController,
        private actionSheetCtrl: ActionSheetController,
        private ivrService: IvrService,
        private translate: TranslateService,
        private entityActionSheet: EntityActionSheetService
    ) {}

    ngOnInit() {
        this.loadDropdownData();

        if (this.ivr && !this.isNew) {
            // Edit mode - populate form with existing data
            // Parse response to convert entries object to array if needed
            this.formData = this.ivrService.parseIvrResponse({ ...this.ivr });
            // Ensure profile exists
            if (!this.formData.profile) {
                this.formData.profile = { direct_dial: 'false' };
            }
            // Store the original announcement URL
            if (this.ivr.announcement) {
                this.currentAnnouncementUrl = this.ivr.announcement;
            }
        }

        this.validateCurrentStep();
    }

    loadDropdownData() {
        // Load announcements
        this.ivrService.getAnnouncements().subscribe(data => {
            this.announcements = data;
            this.enrichAnnouncementsWithIvrUrl();
        });

        // Load bridge types
        this.ivrService.getBridgeTypes().subscribe(types => {
            this.bridgeTypes = types;
            // Pre-load bridge data for each type
            types.forEach(type => {
                this.ivrService.getBridgeData(type).subscribe(data => {
                    this.bridgeData[type] = data;
                });
            });
        });
    }

    /**
     * Enrich announcement in the list with URL from IVR object (if missing)
     * This allows preview to work for the current IVR's announcement
     */
    private enrichAnnouncementsWithIvrUrl() {
        if (!this.ivr?.announcement_uuid || !this.ivr?.announcement) return;

        const ann = this.announcements.find(a => a.uuid === this.ivr!.announcement_uuid);
        if (ann && !ann.url && !ann.file_url && !ann.file) {
            ann.url = this.ivr.announcement;
        }
    }

    // ==================
    // Step Navigation
    // ==================

    nextStep() {
        if (this.currentStep < this.totalSteps && this.stepValid[this.currentStep]) {
            this.currentStep++;
            this.validateCurrentStep();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    goToStep(step: number) {
        // Can only go to previous steps or current step
        if (step <= this.currentStep) {
            this.currentStep = step;
        }
    }

    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                this.stepValid[1] = !!this.formData.name?.trim();
                break;
            case 2:
                this.stepValid[2] = !!this.formData.announcement_uuid;
                break;
            case 3:
                this.stepValid[3] = true; // Optional
                break;
            case 4:
                this.stepValid[4] = true; // Has defaults
                break;
        }
    }

    // ==================
    // Step 1: Basic Info
    // ==================

    onNameChange() {
        this.validateCurrentStep();
    }

    // ==================
    // Step 2: Greeting
    // ==================

    onAnnouncementChange() {
        // Stop and reset audio when selection changes
        this.stopAudio();
        this.audioDuration = 0;

        // Get URL from the announcements list (may be enriched with IVR's URL)
        const ann = this.announcements.find(a => a.uuid === this.formData.announcement_uuid);
        this.currentAnnouncementUrl = ann?.url || ann?.file_url || ann?.file || '';

        this.validateCurrentStep();
    }

    /**
     * Handle announcement selection from EntitySelector
     */
    onAnnouncementUuidChange(uuid: string) {
        this.formData.announcement_uuid = uuid;
        this.onAnnouncementChange();
    }

    /**
     * Handle new announcement created from EntitySelector
     */
    onAnnouncementCreated(announcement: Announcement) {
        // Add to local list with URL for preview
        const announcementWithUrl = {
            ...announcement,
            url: announcement.url || announcement.path || announcement.file_url
        };
        this.announcements.push(announcementWithUrl);

        // Auto-select and trigger preview update
        this.formData.announcement_uuid = announcement.uuid || '';
        this.currentAnnouncementUrl = announcementWithUrl.url || '';
        this.validateCurrentStep();
    }

    getAnnouncementName(): string {
        const ann = this.announcements.find(a => a.uuid === this.formData.announcement_uuid);
        return ann?.name || '';
    }

    private stopAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        this.isPlaying = false;
        this.audioProgress = 0;
        this.currentTime = 0;
    }

    playAnnouncement() {
        if (this.isPlaying) {
            this.stopAudio();
            return;
        }

        // Use stored URL, or try to get it from announcements list
        let url = this.currentAnnouncementUrl;
        if (!url && this.formData.announcement_uuid) {
            const ann = this.announcements.find(a => a.uuid === this.formData.announcement_uuid);
            if (ann) {
                url = ann.url || ann.file_url || ann.file || ann.path || ann.recording_url || ann.audio_url || '';
                this.currentAnnouncementUrl = url;
            }
        }
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
        } else if (this.formData.announcement_uuid) {
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

    formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================
    // Step 3: Menu Options (Keypad)
    // ==================

    onDirectDialChange(event: any) {
        if (!this.formData.profile) {
            this.formData.profile = {};
        }
        this.formData.profile.direct_dial = event.detail.checked ? 'true' : 'false';
    }

    getEntryForKey(key: string): IvrEntry | undefined {
        return this.formData.entries?.find(e => e.entry === key);
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
        const items = this.bridgeData[type] || [];
        const item = items.find(i => i.uuid === uuid);
        return item?.name || '';
    }

    async configureKey(key: string) {
        const entry = this.getEntryForKey(key);
        const buttons: any[] = [];

        // Add bridge type options
        this.bridgeTypes.forEach(type => {
            buttons.push({
                text: this.getBridgeTypeLabel(type),
                handler: () => {
                    this.selectDestinationForKey(key, type);
                }
            });
        });

        // Add clear option if configured
        if (entry) {
            buttons.push({
                text: this.translate.instant('BUTTONS.CLEAR'),
                role: 'destructive',
                handler: () => {
                    this.clearKeyEntry(key);
                }
            });
        }

        buttons.push({
            text: this.translate.instant('BUTTONS.CANCEL'),
            role: 'cancel'
        });

        const actionSheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('IVR.ACTIONS.CONFIGURE_KEY', { key }),
            subHeader: entry
                ? `${this.translate.instant('IVR.ACTIONS.CURRENT')}: ${this.getKeyDestinationLabel(key)}`
                : this.translate.instant('IVR.ACTIONS.SELECT_DESTINATION_TYPE'),
            buttons
        });

        await actionSheet.present();
    }

    async selectDestinationForKey(key: string, bridgeType: string) {
        const items = this.bridgeData[bridgeType] || [];
        const createConfig = this.createModals[bridgeType];

        const result = await this.entityActionSheet.open({
            header: this.translate.instant('IVR.ACTIONS.SELECT', { type: this.getBridgeTypeLabel(bridgeType) }),
            items,
            createModalComponent: createConfig?.component,
            createModalProps: createConfig?.props
        });

        if (result.action === 'select' || result.action === 'create') {
            if (result.uuid) {
                this.setKeyEntry(key, bridgeType, result.uuid);
            }
            // If created, add to bridgeData
            if (result.action === 'create' && result.item) {
                if (!this.bridgeData[bridgeType]) {
                    this.bridgeData[bridgeType] = [];
                }
                this.bridgeData[bridgeType] = [...this.bridgeData[bridgeType], result.item];
            }
        }
    }

    setKeyEntry(key: string, bridgeType: string, bridgeUuid: string) {
        if (!this.formData.entries) {
            this.formData.entries = [];
        }

        const existingIndex = this.formData.entries.findIndex(e => e.entry === key);
        const newEntry: IvrEntry = {
            entry: key,
            name: `Entry ${key}`,
            bridge_type: bridgeType,
            bridge_uuid: bridgeUuid
        };

        if (existingIndex >= 0) {
            this.formData.entries[existingIndex] = newEntry;
        } else {
            this.formData.entries.push(newEntry);
        }
    }

    clearKeyEntry(key: string) {
        if (this.formData.entries) {
            this.formData.entries = this.formData.entries.filter(e => e.entry !== key);
        }
    }

    getBridgeTypeLabel(type: string): string {
        const translationKey = `IVR.BRIDGE_TYPES.${type}`;
        const translated = this.translate.instant(translationKey);
        // Return translated value if found, otherwise return the type as-is
        return translated !== translationKey ? translated : type;
    }

    // ==================
    // Step 4: Fallback
    // ==================

    async selectTimeoutDestination() {
        await this.selectFallbackDestination('timeout');
    }

    async selectInvalidDestination() {
        await this.selectFallbackDestination('invalid');
    }

    private async selectFallbackDestination(field: 'timeout' | 'invalid') {
        const buttons: any[] = this.bridgeTypes.map(type => ({
            text: this.getBridgeTypeLabel(type),
            handler: () => {
                this.selectFallbackItem(field, type);
            }
        }));

        buttons.push({
            text: this.translate.instant('BUTTONS.CANCEL'),
            role: 'cancel'
        });

        const headerKey = field === 'timeout'
            ? 'IVR.ACTIONS.TIMEOUT_DESTINATION'
            : 'IVR.ACTIONS.INVALID_DESTINATION';

        const actionSheet = await this.actionSheetCtrl.create({
            header: this.translate.instant(headerKey),
            buttons
        });

        await actionSheet.present();
    }

    private async selectFallbackItem(field: 'timeout' | 'invalid', bridgeType: string) {
        const items = this.bridgeData[bridgeType] || [];
        const createConfig = this.createModals[bridgeType];

        const result = await this.entityActionSheet.open({
            header: this.translate.instant('IVR.ACTIONS.SELECT', { type: this.getBridgeTypeLabel(bridgeType) }),
            items,
            createModalComponent: createConfig?.component,
            createModalProps: createConfig?.props
        });

        if (result.action === 'select' || result.action === 'create') {
            if (result.uuid) {
                if (field === 'timeout') {
                    this.formData.timeout_bridge_type = bridgeType;
                    this.formData.timeout_bridge_uuid = result.uuid;
                } else {
                    this.formData.invalid_bridge_type = bridgeType;
                    this.formData.invalid_bridge_uuid = result.uuid;
                }
            }
            // If created, add to bridgeData
            if (result.action === 'create' && result.item) {
                if (!this.bridgeData[bridgeType]) {
                    this.bridgeData[bridgeType] = [];
                }
                this.bridgeData[bridgeType] = [...this.bridgeData[bridgeType], result.item];
            }
        }
    }

    getTimeoutDestinationLabel(): string {
        if (!this.formData.timeout_bridge_type || !this.formData.timeout_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }
        return this.getDestinationLabel(this.formData.timeout_bridge_type, this.formData.timeout_bridge_uuid);
    }

    getInvalidDestinationLabel(): string {
        if (!this.formData.invalid_bridge_type || !this.formData.invalid_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }
        return this.getDestinationLabel(this.formData.invalid_bridge_type, this.formData.invalid_bridge_uuid);
    }

    /**
     * Get formatted destination label showing both type and name
     * e.g., "Queue: Support Team" or "IVR: Main Menu"
     */
    getDestinationLabel(type: string, uuid: string): string {
        const typeName = this.getBridgeTypeLabel(type);
        const itemName = this.getDestinationName(type, uuid);
        if (!itemName) return typeName;
        return `${typeName}: ${itemName}`;
    }

    // ==================
    // Save & Cancel
    // ==================

    async save() {
        if (!this.stepValid[1] || !this.stepValid[2]) {
            return;
        }

        this.saving = true;

        try {
            let result: any;
            if (this.isNew) {
                result = await this.ivrService.createIvr(this.formData).toPromise();
            } else {
                result = await this.ivrService.updateIvr(this.ivr!.uuid!, this.formData).toPromise();
            }
            // Return the server response (includes uuid) merged with form data
            const savedData = { ...this.formData, ...result };
            this.modalCtrl.dismiss(savedData, 'save');
        } catch (error) {
            console.error('Error saving IVR:', error);
            this.saving = false;
        }
    }

    dismiss() {
        this.stopAudio();
        this.modalCtrl.dismiss(null, 'cancel');
    }
}
