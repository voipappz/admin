import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ExtensionService } from '../../../core/_base/layout/services/extension.service';
import { Extension } from '../../../core/_base/layout/models/extension.model';

@Component({
    selector: 'page-extension-edit',
    templateUrl: 'extension-edit.html',
    styleUrls: ['./extension-edit.scss'],
    standalone: false
})
export class ExtensionEditPage implements OnInit {
    @Input() isNew = true;
    @Input() isModal = false;
    @Input() extension: Extension | null = null;

    // Form data
    formData: Extension = {
        name: '',
        enabled: true,
        notes: ''
    };

    saving = false;
    formValid = false;

    constructor(
        private modalCtrl: ModalController,
        private navCtrl: NavController,
        private route: ActivatedRoute,
        private extensionService: ExtensionService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        if (this.extension && !this.isNew) {
            // Modal edit mode - populate form with the passed-in data
            this.formData = { ...this.extension };
        } else if (!this.isModal) {
            // Routed (in-page) mode. :uuid = 'new' -> create, otherwise edit/load.
            const uuid = this.route.snapshot.paramMap.get('uuid');
            if (uuid && uuid !== 'new') {
                this.isNew = false;
                this.extensionService.getOne(uuid).subscribe({
                    next: (ext: any) => { this.extension = ext; this.formData = { ...ext }; this.validateForm(); },
                    error: (err) => console.error('Error loading extension:', err)
                });
            } else {
                this.isNew = true;
            }
        }

        this.validateForm();
    }

    validateForm() {
        this.formValid = !!this.formData.name?.trim();
    }

    onNameChange() {
        this.validateForm();
    }

    async save() {
        if (!this.formValid) {
            return;
        }

        this.saving = true;

        try {
            let result: any;
            if (this.isNew) {
                result = await this.extensionService.create(this.formData).toPromise();
            } else {
                result = await this.extensionService.update(this.extension!.uuid!, this.formData).toPromise();
            }

            const savedData = { ...this.formData, ...result };

            if (this.isModal) {
                this.modalCtrl.dismiss(savedData, 'save');
            } else {
                // Routed mode — go back to the previous page (e.g. Actions).
                this.navCtrl.back();
            }
        } catch (error) {
            console.error('Error saving extension:', error);
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
