import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { IvrService } from '../../core/_base/layout/services/ivr.service';
import { Ivr } from '../../core/_base/layout/models/ivr.model';
import { IvrEditPage } from './ivr-edit/ivr-edit';

@Component({
    selector: 'page-ivr',
    templateUrl: 'ivr-page.html',
    styleUrls: ['./ivr-page.scss'],
    standalone: false
}) 
export class IvrPage implements OnInit, OnDestroy {
    ivrs: Ivr[] = [];
    dataAvailable = false;
    loading = true;
    error: string | null = null;

    private subscription: Subscription | null = null;

    constructor(
        private ivrService: IvrService,
        private router: Router,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        this.loadIvrs();
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    ionViewWillEnter() {
        this.loadIvrs();
    }

    loadIvrs() {
        this.loading = true;
        this.error = null;

        this.subscription = this.ivrService.getIvrs().subscribe({
            next: (ivrs) => {
                this.ivrs = ivrs;
                this.dataAvailable = true;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading IVRs:', err);
                this.error = 'Failed to load IVR menus';
                this.loading = false;
            }
        });
    }

    /**
     * Navigate to IVR detail view
     */
    viewIvr(ivr: Ivr) {
        this.router.navigate(['/app/ivr', ivr.uuid]);
    }

    /**
     * Open modal to create new IVR
     */
    async createIvr() {
        const modal = await this.modalCtrl.create({
            component: IvrEditPage,
            componentProps: {
                isNew: true
            }
        });

        await modal.present();

        const { data, role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadIvrs();
        }
    }

    /**
     * Toggle IVR enabled status
     */
    toggleEnabled(ivr: Ivr, event: Event) {
        event.stopPropagation();
        const newStatus = !ivr.enabled;

        // Optimistic update
        ivr.enabled = newStatus;

        this.ivrService.updateIvr(ivr.uuid!, { enabled: newStatus } as Ivr).subscribe({
            next: () => {
                // Success - status already updated
            },
            error: (err) => {
                console.error('Error toggling IVR status:', err);
                // Revert on error
                ivr.enabled = !newStatus;
            }
        });
    }

    /**
     * Delete IVR with confirmation
     */
    async deleteIvr(ivr: Ivr, slidingItem: any) {
        const alert = await this.alertCtrl.create({
            header: this.translate.instant('IVR.ACTIONS.DELETE_CONFIRM_TITLE'),
            message: this.translate.instant('IVR.ACTIONS.DELETE_CONFIRM_MESSAGE', { name: ivr.name }),
            buttons: [
                {
                    text: this.translate.instant('BUTTONS.CANCEL'),
                    role: 'cancel',
                    handler: () => {
                        slidingItem.close();
                    }
                },
                {
                    text: this.translate.instant('BUTTONS.DELETE'),
                    role: 'destructive',
                    handler: () => {
                        this.confirmDelete(ivr);
                    }
                }
            ]
        });

        await alert.present();
    }

    private confirmDelete(ivr: Ivr) {
        this.ivrService.deleteIvr(ivr.uuid!).subscribe({
            next: () => {
                this.ivrs = this.ivrs.filter(i => i.uuid !== ivr.uuid);
            },
            error: (err) => {
                console.error('Error deleting IVR:', err);
            }
        });
    }

    /**
     * Get count of configured menu entries
     */
    getEntryCount(ivr: Ivr): number {
        return ivr.entries?.length || 0;
    }

    /**
     * Track function for ngFor
     */
    trackByUuid(index: number, ivr: Ivr): string {
        return ivr.uuid || index.toString();
    }
}
