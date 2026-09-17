import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ActionSheetController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { QueueService } from '../../../core/_base/layout/services/queue.service';
import { Queue, QueueAgent } from '../../../core/_base/layout/models/queue.model';
import { AnnouncementCreateModal } from '../../../partials/announcement-create/announcement-create.modal';
import { EntityActionSheetService } from '../../../core/_base/layout/services/entity-action-sheet.service';
import { IvrEditPage } from '../../ivr-page/ivr-edit/ivr-edit';
import { TimeConditionPage } from '../../time-condition-page/time-condition-page';
import { ExtensionEditPage } from '../../extension-page/extension-edit/extension-edit';
import { NumberEditPage } from '../../number-page/number-edit/number-edit';

@Component({
    selector: 'page-queue-edit',
    templateUrl: 'queue-edit.html',
    styleUrls: ['./queue-edit.scss'],
    standalone: false
})
export class QueueEditPage implements OnInit {
    @Input() isNew = true;
    @Input() isModal = false;
    @Input() queue: Queue | null = null;

    // Step wizard state
    currentStep = 1;
    totalSteps = 4;

    // Form data
    formData: Queue = {
        name: '',
        enabled: true,
        strategy: '',
        intro_announcement_uuid: '',
        hold_announcement_uuid: '',
        max_wait_time: 300,
        max_wait_time_bridge_type: '',
        max_wait_time_bridge_uuid: '',
        agents: []
    };

    // Data for dropdowns
    strategies: string[] = [];
    announcements: any[] = [];
    bridgeTypes: string[] = [];
    bridgeData: { [key: string]: any[] } = {};
    allAgents: QueueAgent[] = [];

    // Agent selection
    agentSearchQuery = '';
    filteredAgents: QueueAgent[] = [];

    // Step validation
    stepValid: { [step: number]: boolean } = {
        1: false,  // name required
        2: true,   // announcements optional
        3: true,   // fallback optional
        4: true    // agents optional
    };

    saving = false;

    // Make modal component available to template
    AnnouncementCreateModal = AnnouncementCreateModal;

    // Bridge type → create modal mapping (same as IVR edit)
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
        private navCtrl: NavController,
        private route: ActivatedRoute,
        private queueService: QueueService,
        private translate: TranslateService,
        private entityActionSheet: EntityActionSheetService
    ) {}

    ngOnInit() {
        this.loadDropdownData();

        const routedUuid = !this.isModal ? this.route.snapshot.paramMap.get('uuid') : null;

        if (this.queue && !this.isNew) {
            // Modal edit mode - populate from the passed-in queue.
            this.formData = this.parseQueueForEdit(this.queue);
        } else if (routedUuid && routedUuid !== 'new') {
            // Routed (in-page) edit mode - load by :uuid.
            this.isNew = false;
            this.queueService.get(routedUuid).subscribe({
                next: (q: any) => { this.queue = q; this.formData = this.parseQueueForEdit(q); this.validateCurrentStep(); },
                error: (err) => console.error('Error loading queue:', err)
            });
        } else {
            this.isNew = true;
        }

        this.validateCurrentStep();
    }

    /**
     * Parse queue from server response for editing
     * Server returns objects for announcements, we need UUIDs for the form
     */
    private parseQueueForEdit(queue: Queue): Queue {
        return {
            ...queue,
            // Extract UUID from announcement objects if present
            intro_announcement_uuid: queue.intro_announcement?.uuid || queue.intro_announcement_uuid || '',
            hold_announcement_uuid: queue.hold_announcement?.uuid || queue.hold_announcement_uuid || ''
        };
    }

    loadDropdownData() {
        // Load strategies
        this.queueService.getStrategies().subscribe(data => {
            this.strategies = data || [];
        });

        // Load announcements
        this.queueService.getAnnouncements().subscribe(data => {
            this.announcements = data || [];
        });

        // Load bridge types
        this.queueService.getBridgeTypes().subscribe(types => {
            this.bridgeTypes = types || [];
            // Pre-load bridge data for each type
            types?.forEach(type => {
                this.queueService.getBridgeData(type).subscribe(data => {
                    this.bridgeData[type] = data || [];
                });
            });
        });

        // Load agents
        this.queueService.getAgents().subscribe(data => {
            this.allAgents = data || [];
            this.filteredAgents = [...this.allAgents];
        });
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
        if (step <= this.currentStep) {
            this.currentStep = step;
        }
    }

    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                this.stepValid[1] = !!this.formData.name?.trim() && !!this.formData.strategy;
                break;
            case 2:
                this.stepValid[2] = true; // Optional
                break;
            case 3:
                this.stepValid[3] = true; // Optional
                break;
            case 4:
                this.stepValid[4] = true; // Optional
                break;
        }
    }

    // ==================
    // Step 1: Basic Info
    // ==================

    onNameChange() {
        this.validateCurrentStep();
    }

    onStrategyChange() {
        this.validateCurrentStep();
    }

    getStrategyLabel(strategy: string): string {
        if (!strategy) return '';
        const translationKey = `QUEUE.STRATEGIES.${strategy}`;
        const translated = this.translate.instant(translationKey);
        // If translation exists, use it; otherwise humanize the strategy name
        return translated !== translationKey
            ? translated
            : strategy.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // ==================
    // Step 2: Announcements
    // ==================

    async selectIntroAnnouncement() {
        const result = await this.entityActionSheet.open({
            header: this.translate.instant('QUEUE.FIELDS.INTRO_ANNOUNCEMENT'),
            items: this.announcements,
            createModalComponent: AnnouncementCreateModal,
            addButtonLabel: this.translate.instant('COMMON.ADD_NEW')
        });

        if (result.action === 'select' || result.action === 'create') {
            this.formData.intro_announcement_uuid = result.uuid || '';
            if (result.action === 'create' && result.item) {
                this.announcements = [...this.announcements, result.item];
            }
        }
    }

    async selectHoldAnnouncement() {
        const result = await this.entityActionSheet.open({
            header: this.translate.instant('QUEUE.FIELDS.HOLD_ANNOUNCEMENT'),
            items: this.announcements,
            createModalComponent: AnnouncementCreateModal,
            addButtonLabel: this.translate.instant('COMMON.ADD_NEW')
        });

        if (result.action === 'select' || result.action === 'create') {
            this.formData.hold_announcement_uuid = result.uuid || '';
            if (result.action === 'create' && result.item) {
                this.announcements = [...this.announcements, result.item];
            }
        }
    }

    getAnnouncementName(uuid: string): string {
        const ann = this.announcements.find(a => a.uuid === uuid);
        return ann?.name || this.translate.instant('BUTTONS.NOT_SET');
    }

    // ==================
    // Step 3: Fallback
    // ==================

    async selectFallbackDestination() {
        // First select bridge type
        const buttons: any[] = this.bridgeTypes.map(type => ({
            text: this.getBridgeTypeLabel(type),
            handler: () => {
                this.selectFallbackItem(type);
            }
        }));

        buttons.push({
            text: this.translate.instant('BUTTONS.CANCEL'),
            role: 'cancel'
        });

        const actionSheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('QUEUE.FIELDS.FALLBACK_DESTINATION'),
            buttons
        });

        await actionSheet.present();
    }

    private async selectFallbackItem(bridgeType: string) {
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
                this.formData.max_wait_time_bridge_type = bridgeType;
                this.formData.max_wait_time_bridge_uuid = result.uuid;
            }
            if (result.action === 'create' && result.item) {
                if (!this.bridgeData[bridgeType]) {
                    this.bridgeData[bridgeType] = [];
                }
                this.bridgeData[bridgeType] = [...this.bridgeData[bridgeType], result.item];
            }
        }
    }

    getFallbackDestinationLabel(): string {
        if (!this.formData.max_wait_time_bridge_type || !this.formData.max_wait_time_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }
        const typeName = this.getBridgeTypeLabel(this.formData.max_wait_time_bridge_type);
        const items = this.bridgeData[this.formData.max_wait_time_bridge_type] || [];
        const item = items.find(i => i.uuid === this.formData.max_wait_time_bridge_uuid);
        const itemName = item?.name || '';
        if (!itemName) return typeName;
        return `${typeName}: ${itemName}`;
    }

    getBridgeTypeLabel(type: string): string {
        const translationKey = `IVR.BRIDGE_TYPES.${type}`;
        const translated = this.translate.instant(translationKey);
        return translated !== translationKey ? translated : type;
    }

    // ==================
    // Step 4: Agents
    // ==================

    onAgentSearchChange() {
        const query = this.agentSearchQuery.toLowerCase().trim();
        if (!query) {
            this.filteredAgents = [...this.allAgents];
        } else {
            this.filteredAgents = this.allAgents.filter(agent =>
                (agent.fullname?.toLowerCase().includes(query)) ||
                (agent.username?.toLowerCase().includes(query)) ||
                (agent.email?.toLowerCase().includes(query))
            );
        }
    }

    isAgentSelected(uuid: string): boolean {
        return this.formData.agents?.includes(uuid) || false;
    }

    toggleAgent(uuid: string) {
        if (!this.formData.agents) {
            this.formData.agents = [];
        }

        const index = this.formData.agents.indexOf(uuid);
        if (index >= 0) {
            this.formData.agents.splice(index, 1);
        } else {
            this.formData.agents.push(uuid);
        }
    }

    selectAllAgents() {
        this.formData.agents = this.filteredAgents.map(a => a.uuid);
    }

    deselectAllAgents() {
        this.formData.agents = [];
    }

    getSelectedAgentsCount(): number {
        return this.formData.agents?.length || 0;
    }

    getAgentDisplayName(agent: QueueAgent): string {
        return agent.fullname || agent.username || agent.email || agent.uuid;
    }

    // ==================
    // Save & Cancel
    // ==================

    async save() {
        if (!this.stepValid[1]) {
            return;
        }

        this.saving = true;

        try {
            let result: any;
            if (this.isNew) {
                result = await this.queueService.create(this.formData).toPromise();
            } else {
                result = await this.queueService.update(this.queue!.uuid!, this.formData).toPromise();
            }

            const savedData = { ...this.formData, ...result };

            if (this.isModal) {
                this.modalCtrl.dismiss(savedData, 'save');
            } else {
                this.navCtrl.back();
            }
        } catch (error) {
            console.error('Error saving queue:', error);
            this.saving = false;
        }
    }

    dismiss() {
        if (this.isModal) {
            this.modalCtrl.dismiss(null, 'cancel');
        } else {
            this.navCtrl.back();
        }
    }
}
