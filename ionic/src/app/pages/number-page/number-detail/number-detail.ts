import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { NumberService } from '../../../core/_base/layout/services/number.service';
import { NumberEntity } from '../../../core/_base/layout/models/number.model';
import { NumberEditPage } from '../number-edit/number-edit';

@Component({
    selector: 'page-number-detail',
    templateUrl: 'number-detail.html',
    styleUrls: ['./number-detail.scss'],
    standalone: false
})
export class NumberDetailPage implements OnInit, OnDestroy, OnChanges {
    // Input for embedded usage (without routing)
    @Input() numberUuid: string = '';
    @Input() embedded: boolean = false;
    @Output() onEdit = new EventEmitter<NumberEntity>();

    numberEntity: NumberEntity | null = null;
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
        private numberService: NumberService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        // Get UUID from route if not provided via Input
        if (!this.numberUuid) {
            this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
        } else {
            this.uuid = this.numberUuid;
        }
        this.loadNumber();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Reload when numberUuid input changes
        if (changes['numberUuid'] && !changes['numberUuid'].firstChange) {
            this.uuid = this.numberUuid;
            this.loadNumber();
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    ionViewWillEnter() {
        if (this.uuid) {
            this.loadNumber();
        }
    }

    loadNumber() {
        if (!this.uuid) return;

        this.loading = true;
        this.error = null;

        this.subscription = this.numberService.getOne(this.uuid).subscribe({
            next: (numberEntity) => {
                this.numberEntity = numberEntity;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading Number:', err);
                this.error = 'Failed to load Number';
                this.loading = false;
            }
        });
    }

    // ==================
    // Edit/Delete
    // ==================

    async editNumber() {
        const modal = await this.modalCtrl.create({
            component: NumberEditPage,
            componentProps: {
                isNew: false,
                isModal: true,
                numberEntity: this.numberEntity
            }
        });

        await modal.present();

        const { data, role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadNumber();
            this.onEdit.emit(data);
        }
    }

    async deleteNumber() {
        const alert = await this.alertCtrl.create({
            header: this.translate.instant('NUMBER.ACTIONS.DELETE_CONFIRM_TITLE'),
            message: this.translate.instant('NUMBER.ACTIONS.DELETE_CONFIRM_MESSAGE', { number: this.numberEntity?.number }),
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
        if (!this.numberEntity?.uuid) return;

        this.numberService.delete(this.numberEntity.uuid).subscribe({
            next: () => {
                this.router.navigate(['/app/numbers']);
            },
            error: (err) => {
                console.error('Error deleting Number:', err);
            }
        });
    }

    goBack() {
        this.navCtrl.back();
    }
}
