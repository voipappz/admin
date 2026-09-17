import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ExtensionService } from '../../../core/_base/layout/services/extension.service';
import { Extension } from '../../../core/_base/layout/models/extension.model';
import { ExtensionEditPage } from '../extension-edit/extension-edit';

@Component({
    selector: 'page-extension-detail',
    templateUrl: 'extension-detail.html',
    styleUrls: ['./extension-detail.scss'],
    standalone: false
})
export class ExtensionDetailPage implements OnInit, OnDestroy, OnChanges {
    // Input for embedded usage (without routing)
    @Input() extensionUuid: string = '';
    @Input() embedded: boolean = false;
    @Output() onEdit = new EventEmitter<Extension>();

    extension: Extension | null = null;
    loading = true;
    error: string | null = null;

    private subscription: Subscription | null = null;
    private uuid: string = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private navCtrl: NavController,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private extensionService: ExtensionService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        // Get UUID from route if not provided via Input
        if (!this.extensionUuid) {
            this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
        } else {
            this.uuid = this.extensionUuid;
        }
        this.loadExtension();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Reload when extensionUuid input changes
        if (changes['extensionUuid'] && !changes['extensionUuid'].firstChange) {
            this.uuid = this.extensionUuid;
            this.loadExtension();
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    ionViewWillEnter() {
        if (this.uuid) {
            this.loadExtension();
        }
    }

    loadExtension() {
        if (!this.uuid) return;

        this.loading = true;
        this.error = null;

        this.subscription = this.extensionService.getOne(this.uuid).subscribe({
            next: (extension) => {
                this.extension = extension;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading Extension:', err);
                this.error = 'Failed to load Extension';
                this.loading = false;
            }
        });
    }

    // ==================
    // Edit/Delete
    // ==================

    async editExtension() {
        const modal = await this.modalCtrl.create({
            component: ExtensionEditPage,
            componentProps: {
                isNew: false,
                isModal: true,
                extension: this.extension
            }
        });

        await modal.present();

        const { data, role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadExtension();
            this.onEdit.emit(data);
        }
    }

    async deleteExtension() {
        const alert = await this.alertCtrl.create({
            header: this.translate.instant('EXTENSION.ACTIONS.DELETE_CONFIRM_TITLE'),
            message: this.translate.instant('EXTENSION.ACTIONS.DELETE_CONFIRM_MESSAGE', { name: this.extension?.name }),
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
        if (!this.extension?.uuid) return;

        this.extensionService.delete(this.extension.uuid).subscribe({
            next: () => {
                this.router.navigate(['/app/extensions']);
            },
            error: (err) => {
                console.error('Error deleting Extension:', err);
            }
        });
    }

    goBack() {
        this.navCtrl.back();
    }
}
