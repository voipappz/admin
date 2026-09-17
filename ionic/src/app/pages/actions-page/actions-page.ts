import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';
import { DidService } from '../../core/_base/layout/services/did.service';
import { IvrService } from '../../core/_base/layout/services/ivr.service';
import { QueueService } from '../../core/_base/layout/services/queue.service';
import { ExtensionService } from '../../core/_base/layout/services/extension.service';
import { NumberService } from '../../core/_base/layout/services/number.service';
import { TimeConditionService } from '../../core/_base/layout/services/time-condition.service';
import { EntityActionSheetService } from '../../core/_base/layout/services/entity-action-sheet.service';

@Component({
    selector: 'page-actions',
    templateUrl: 'actions-page.html',
    styleUrls: ['./actions-page.scss'],
    standalone: false,
    providers: [DidService, IvrService, QueueService, TimeConditionService]
})
export class ActionsPage implements OnInit, OnDestroy {
    // Loading state
    loading = true;
    error: string | null = null;

    // Default identity (DID) data
    defaultIdentity: any = null;

    // All of the user's numbers/identities + the header search term.
    identities: any[] = [];
    searchTerm = '';

    // Bridge type determines which content to show: 'ivr' or 'call_condition'
    bridgeType: string = '';
    bridgeUuid: string = '';

    // Bridge routing change state
    savingRouting = false;
    private bridgeTypes: string[] = [];
    private bridgeData: { [key: string]: any[] } = {};
    private createModals: { [type: string]: { component: any, props?: any } } = {};

    private userReloadSub: Subscription | null = null;

    constructor(
        private router: Router,
        private modalCtrl: ModalController,
        private actionSheetCtrl: ActionSheetController,
        private alertCtrl: AlertController,
        private userData: UserData,
        private events: Events,
        private didService: DidService,
        private ivrService: IvrService,
        private queueService: QueueService,
        private extensionService: ExtensionService,
        private numberService: NumberService,
        private timeConditionService: TimeConditionService,
        private translate: TranslateService,
        private entityActionSheet: EntityActionSheetService
    ) {}

    ngOnInit() {
        this.loadDefaultIdentity();

        // Subscribe to user reload events
        this.userReloadSub = this.events.subscribe('user:reload', () => {
            this.loadDefaultIdentity();
        });
    }

    ngOnDestroy() {
        this.userReloadSub?.unsubscribe();
    }

    /**
     * Load the default identity from user data and fetch its details.
     * Always validates that active_id exists in the DIDs list to prevent stale data.
     */
    private loadDefaultIdentity() {
        this.loading = true;
        this.error = null;

        const user = this.userData.getUserData();
        if (!user) {
            this.error = this.translate.instant('ACTIONS.ERRORS.NO_USER');
            this.loading = false;
            return;
        }

        // Get the default_identity from user.meta
        const activeId = user.meta?.default_identity || null;

        // Old approach - kept for reference:
        // let activeId = user.active_id;
        // if (!activeId && user.resources) {
        //     const didResource = user.resources.find(r =>
        //         r.type === 'did' &&
        //         r.meta &&
        //         (r.meta.default_identity === 'true' || r.meta.default_identity === true)
        //     );
        //     if (didResource) {
        //         activeId = didResource.type_uuid;
        //     }
        // }

        // Always fetch DIDs from server and validate activeId exists in the list
        this.didService.get().subscribe({
            next: (dids) => {
                if (!dids || dids.length === 0) {
                    this.error = this.translate.instant('ACTIONS.ERRORS.NO_DEFAULT_IDENTITY');
                    this.loading = false;
                    return;
                }

                // Validate activeId exists in the DIDs list
                let selectedDid = activeId
                    ? dids.find(d => d.uuid === activeId)
                    : null;

                // If activeId not found in list (stale), use first DID as fallback for display only
                // Note: Don't auto-update user resource here to avoid circular reload
                if (!selectedDid) {
                    selectedDid = dids[0];
                }

                this.identities = dids;
                this.defaultIdentity = selectedDid;
                this.bridgeType = selectedDid.bridge_type || '';
                this.bridgeUuid = selectedDid.bridge_uuid || '';
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching DIDs:', err);
                this.error = this.translate.instant('ACTIONS.ERRORS.LOAD_FAILED');
                this.loading = false;
            }
        });
    }

    /**
     * Check if the current mode is IVR
     */
    get isIvrMode(): boolean {
        return this.bridgeType === 'ivr';
    }

    /**
     * Check if the current mode is Time Condition (call_condition)
     */
    get isTimeConditionMode(): boolean {
        return this.bridgeType === 'call_condition' || this.bridgeType === 'time_condition';
    }

    /**
     * Check if the current mode is Queue
     */
    get isQueueMode(): boolean {
        return this.bridgeType === 'queue';
    }

    /**
     * Check if the current mode is Extension
     */
    get isExtensionMode(): boolean {
        return this.bridgeType === 'extension';
    }

    /**
     * Check if the current mode is Number (external number)
     */
    get isNumberMode(): boolean {
        return this.bridgeType === 'number';
    }

    // ---- numbers list + header search ----
    onSearch(term: string) {
        this.searchTerm = (term || '').toLowerCase().trim();
    }

    get filteredIdentities(): any[] {
        if (!this.searchTerm) { return this.identities; }
        return this.identities.filter((d) =>
            ((d.number || d.did_number || '') + '').toLowerCase().includes(this.searchTerm) ||
            ((d.name || '') + '').toLowerCase().includes(this.searchTerm)
        );
    }

    isActiveIdentity(d: any): boolean {
        return !!d && d.uuid === this.defaultIdentity?.uuid;
    }

    selectIdentity(uuid: string) {
        if (!uuid || uuid === this.defaultIdentity?.uuid) { return; }
        this.loading = true;
        // PATCH /api/users/{uuid} {meta:{default_identity}} -> user:reload -> reload.
        this.userData.updateUserResource('default_identity', 'did', uuid);
    }

    bridgeLabelFor(d: any): string {
        return d?.bridge_type
            ? this.getBridgeTypeLabel(d.bridge_type)
            : this.translate.instant('ACTIONS.NO_ROUTING');
    }

    bridgeColorFor(type: string): string {
        switch (type) {
            case 'ivr': return 'tertiary';
            case 'queue': return 'success';
            case 'extension': return 'primary';
            case 'number': return 'warning';
            case 'call_condition':
            case 'time_condition': return 'secondary';
            default: return 'medium';
        }
    }

    /**
     * Get the formatted phone number for display
     */
    getPhoneNumber(): string {
        return this.defaultIdentity?.number || this.defaultIdentity?.did_number || '';
    }

    /**
     * Get the identity name
     */
    getIdentityName(): string {
        return this.defaultIdentity?.name || '';
    }

    /**
     * Refresh data
     */
    refresh(event?: any) {
        this.loadDefaultIdentity();
        // Close the pull-to-refresh spinner once the reload kicks off.
        if (event?.target?.complete) {
            setTimeout(() => event.target.complete(), 600);
        }
    }

    /**
     * Edit the current bridge (IVR, Time Condition, etc.)
     * For IVR: Opens the edit modal directly
     * For Time Condition: Navigates to the detail page
     */
    async editBridge() {
        if (!this.bridgeUuid) return;

        if (this.isIvrMode) {
            // Load IVR data and open edit modal
            this.ivrService.getIvr(this.bridgeUuid).subscribe({
                next: async (ivr) => {
                    const { IvrEditPage } = await import('../ivr-page/ivr-edit/ivr-edit');
                    const modal = await this.modalCtrl.create({
                        component: IvrEditPage,
                        componentProps: {
                            isNew: false,
                            ivr: ivr
                        }
                    });
                    await modal.present();

                    const { role } = await modal.onWillDismiss();
                    if (role === 'save') {
                        this.loadDefaultIdentity();
                    }
                },
                error: (err) => {
                    console.error('Error loading IVR:', err);
                }
            });
        } else if (this.isTimeConditionMode) {
            // Old approach - router navigation:
            // this.router.navigate(['/app/time-condition', this.bridgeUuid]);

            // Old approach - pass only UUID:
            // const modal = await this.modalCtrl.create({
            //     component: TimeConditionPage,
            //     componentProps: { isNew: false, isModal: true, callCondition: { uuid: this.bridgeUuid } }
            // });

            // New approach - fetch fresh data from server first (like IVR edit)
            this.timeConditionService.getByUuid(this.bridgeUuid).subscribe({
                next: async (callCondition) => {
                    const { TimeConditionPage } = await import('../time-condition-page/time-condition-page');
                    const modal = await this.modalCtrl.create({
                        component: TimeConditionPage,
                        componentProps: {
                            isNew: false,
                            isModal: true,
                            callCondition: callCondition
                        }
                    });
                    await modal.present();

                    const { role } = await modal.onWillDismiss();
                    if (role === 'save') {
                        this.loadDefaultIdentity();
                    }
                },
                error: (err) => {
                    console.error('Error loading Time Condition:', err);
                }
            });
        } else if (this.isQueueMode) {
            // In-page (routed) edit — push the queue edit page with a back button.
            this.router.navigate(['/app/queue', this.bridgeUuid]);
        } else if (this.isExtensionMode) {
            // In-page (routed) edit — push the extension edit page with a back button.
            this.router.navigate(['/app/extension', this.bridgeUuid]);
        } else if (this.isNumberMode) {
            // In-page (routed) edit — push the number edit page with a back button.
            this.router.navigate(['/app/number', this.bridgeUuid]);
        }
    }

    /**
     * Two-step flow to change the DID's bridge routing.
     * Step 1: Select bridge type via action sheet
     * Step 2: Select destination via EntityActionSheetService
     * Then confirm and save via PATCH /api/dids/{uuid}
     */
    changeRouting() {
        if (this.savingRouting || !this.defaultIdentity) { return; }
        // In-page routing selector (push view + back) — no action sheets/modals.
        this.router.navigate(['/app/routing', this.defaultIdentity.uuid]);
    }

    /**
     * Step 2: Show destinations for the selected bridge type
     */
    private async selectDestination(bridgeType: string) {
        // Load destination data for this type if not cached
        if (!this.bridgeData[bridgeType]) {
            try {
                this.bridgeData[bridgeType] = await this.ivrService.getBridgeData(bridgeType).toPromise();
            } catch (err) {
                console.error('Error loading bridge data:', err);
                return;
            }
        }

        const items = this.bridgeData[bridgeType] || [];
        const createConfig = this.createModals[bridgeType];

        const result = await this.entityActionSheet.open({
            header: this.translate.instant('IVR.ACTIONS.SELECT', {
                type: this.getBridgeTypeLabel(bridgeType)
            }),
            items,
            createModalComponent: createConfig?.component,
            createModalProps: createConfig?.props
        });

        if (result.action === 'select' || result.action === 'create') {
            if (result.uuid) {
                // Cache newly created items
                if (result.action === 'create' && result.item) {
                    this.bridgeData[bridgeType] = [...(this.bridgeData[bridgeType] || []), result.item];
                }
                await this.confirmAndSaveRouting(bridgeType, result.uuid, result.name || '');
            }
        }
    }

    /**
     * Show confirmation dialog and save routing change
     */
    private async confirmAndSaveRouting(newType: string, newUuid: string, newName: string) {
        const isFirstTimeSetup = !this.bridgeType || !this.bridgeUuid;

        if (!isFirstTimeSetup) {
            const currentTypeName = this.getBridgeTypeLabel(this.bridgeType);
            const currentDestName = this.getCurrentBridgeName();
            const newTypeName = this.getBridgeTypeLabel(newType);

            const alert = await this.alertCtrl.create({
                header: this.translate.instant('ACTIONS.CONFIRM_CHANGE_TITLE'),
                message: this.translate.instant('ACTIONS.CONFIRM_CHANGE_MESSAGE', {
                    currentType: currentTypeName,
                    currentName: currentDestName,
                    newType: newTypeName,
                    newName: newName
                }),
                buttons: [
                    { text: this.translate.instant('BUTTONS.CANCEL'), role: 'cancel' },
                    {
                        text: this.translate.instant('BUTTONS.SAVE'),
                        handler: () => { this.saveRouting(newType, newUuid); }
                    }
                ]
            });
            await alert.present();
        } else {
            await this.saveRouting(newType, newUuid);
        }
    }

    /**
     * Persist the routing change via PATCH /api/dids/{uuid}
     */
    private async saveRouting(bridgeType: string, bridgeUuid: string) {
        this.savingRouting = true;
        try {
            await this.didService.update(this.defaultIdentity.uuid, {
                bridge_type: bridgeType,
                bridge_uuid: bridgeUuid
            });
            this.loadDefaultIdentity();
        } catch (err) {
            console.error('Error saving routing:', err);
            this.error = this.translate.instant('ACTIONS.ROUTING_SAVE_FAILED');
        } finally {
            this.savingRouting = false;
        }
    }

    /**
     * Get translated label for a bridge type
     */
    getBridgeTypeLabel(type: string): string {
        const key = `IVR.BRIDGE_TYPES.${type}`;
        const translated = this.translate.instant(key);
        return translated !== key ? translated : type;
    }

    /**
     * Get display name of the currently configured bridge destination
     */
    private getCurrentBridgeName(): string {
        if (!this.bridgeType || !this.bridgeUuid) return '';
        const items = this.bridgeData[this.bridgeType] || [];
        const item = items.find(i => i.uuid === this.bridgeUuid);
        return item?.name || this.bridgeUuid;
    }

    /**
     * Lazy-load create modal components on first use
     */
    private async ensureCreateModals() {
        if (Object.keys(this.createModals).length > 0) return;

        const [
            { IvrEditPage },
            { QueueEditPage },
            { ExtensionEditPage },
            { NumberEditPage },
            { TimeConditionPage },
            { AnnouncementCreateModal }
        ] = await Promise.all([
            import('../ivr-page/ivr-edit/ivr-edit'),
            import('../queue-page/queue-edit/queue-edit'),
            import('../extension-page/extension-edit/extension-edit'),
            import('../number-page/number-edit/number-edit'),
            import('../time-condition-page/time-condition-page'),
            import('../../partials/announcement-create/announcement-create.modal')
        ]);

        this.createModals = {
            'ivr': { component: IvrEditPage, props: { isNew: true } },
            'queue': { component: QueueEditPage, props: { isNew: true, isModal: true } },
            'extension': { component: ExtensionEditPage, props: { isNew: true, isModal: true } },
            'number': { component: NumberEditPage, props: { isNew: true, isModal: true } },
            'call_condition': { component: TimeConditionPage, props: { isNew: true, isModal: true } },
            'announcement': { component: AnnouncementCreateModal }
        };
    }

    /**
     * Open identity settings as a modal
     */
    async openIdentitySettings() {
        const { IdentitiesPage } = await import('../identities-page/identities-page');
        const modal = await this.modalCtrl.create({
            component: IdentitiesPage
        });
        await modal.present();

        const { role } = await modal.onDidDismiss();
        if (role === 'save') {
            this.loadDefaultIdentity();
        }
    }
}
