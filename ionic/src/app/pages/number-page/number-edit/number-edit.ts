import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NumberService } from '../../../core/_base/layout/services/number.service';
import { NumberEntity } from '../../../core/_base/layout/models/number.model';
import { UserData } from '../../../core/providers/user-data';

@Component({
    selector: 'page-number-edit',
    templateUrl: 'number-edit.html',
    styleUrls: ['./number-edit.scss'],
    standalone: false
})
export class NumberEditPage implements OnInit {
    @Input() isNew = true;
    @Input() isModal = false;
    @Input() numberEntity: NumberEntity | null = null;

    // Form data
    formData: NumberEntity = {
        number: '',
        environment_uuid: ''
    };

    saving = false;
    formValid = false;

    constructor(
        private modalCtrl: ModalController,
        private navCtrl: NavController,
        private route: ActivatedRoute,
        private numberService: NumberService,
        private translate: TranslateService,
        private userData: UserData
    ) {}

    ngOnInit() {
        const routedUuid = !this.isModal ? this.route.snapshot.paramMap.get('uuid') : null;

        if (this.numberEntity && !this.isNew) {
            // Modal edit mode - populate form with existing data
            this.formData = {
                ...this.numberEntity,
                environment_uuid: this.numberEntity.environment?.uuid || this.numberEntity.environment_uuid || ''
            };
        } else if (routedUuid && routedUuid !== 'new') {
            // Routed (in-page) edit mode - load by :uuid
            this.isNew = false;
            this.numberService.getOne(routedUuid).subscribe({
                next: (n: any) => {
                    this.numberEntity = n;
                    this.formData = { ...n, environment_uuid: n.environment?.uuid || n.environment_uuid || '' };
                    this.validateForm();
                },
                error: (err) => console.error('Error loading number:', err)
            });
        } else {
            // Create mode - get environment_uuid from user data
            this.isNew = true;
            const user = this.userData.getUserData();
            if (user?.environment?.uuid) {
                this.formData.environment_uuid = user.environment.uuid;
            }
        }

        this.validateForm();
    }

    validateForm() {
        this.formValid = !!this.formData.number?.trim();
    }

    onNumberChange() {
        this.validateForm();
    }

    async save() {
        if (!this.formValid) {
            return;
        }

        this.saving = true;

        try {
            let result: any;
            const payload = {
                number: this.formData.number,
                environment_uuid: this.formData.environment_uuid
            };

            if (this.isNew) {
                result = await this.numberService.create(payload).toPromise();
            } else {
                result = await this.numberService.update(this.numberEntity!.uuid!, payload).toPromise();
            }

            const savedData = { ...this.formData, ...result };

            if (this.isModal) {
                this.modalCtrl.dismiss(savedData, 'save');
            } else {
                this.navCtrl.back();
            }
        } catch (error) {
            console.error('Error saving number:', error);
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
