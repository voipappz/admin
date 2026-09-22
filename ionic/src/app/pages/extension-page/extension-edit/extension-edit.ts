import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ExtensionService } from '../../../core/_base/layout/services/extension.service';
import { Extension } from '../../../core/_base/layout/models/extension.model';

/**
 * Create/edit a SIP extension on the connectix box (`/api/admin/users`) — a
 * connectix "user" IS an extension: username (9001), display name, password,
 * and whether the box registers it.
 *
 * The password never comes back from the server (write-only), so the field
 * starts blank on an edit and is only sent when the operator types a new one.
 */
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
        username: '',
        display_name: '',
        password: '',
        enabled: true,
        'register?': true
    };

    saving = false;
    formValid = false;
    saveError: string | null = null;

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
            this.formData = this.toForm(this.extension);
        } else if (!this.isModal) {
            // Routed (in-page) mode. :uuid = 'new' -> create, otherwise edit/load.
            const uuid = this.route.snapshot.paramMap.get('uuid');
            if (uuid && uuid !== 'new') {
                this.isNew = false;
                this.extensionService.getOne(uuid).subscribe({
                    next: (ext) => {
                        if (!ext) { return; }
                        this.extension = ext;
                        this.formData = this.toForm(ext);
                        this.validateForm();
                    },
                    error: (err) => console.error('Error loading extension:', err)
                });
            } else {
                this.isNew = true;
            }
        }

        this.validateForm();
    }

    private toForm(ext: Extension): Extension {
        return {
            username: ext.username || '',
            display_name: ext.display_name || '',
            // Never prefilled: the server always returns null for it.
            password: '',
            enabled: ext.enabled !== false,
            'register?': ext['register?'] !== false
        };
    }

    validateForm() {
        const username = (this.formData.username || '').trim();
        // A new extension needs a password; an existing one keeps the stored one
        // unless the operator types a replacement.
        this.formValid = !!username && (!this.isNew || !!this.formData.password);
    }

    onNameChange() {
        this.validateForm();
    }

    async save() {
        if (!this.formValid) {
            return;
        }

        this.saving = true;
        this.saveError = null;

        const payload: Partial<Extension> = {
            username: (this.formData.username || '').trim(),
            display_name: this.formData.display_name || '',
            enabled: this.formData.enabled !== false,
            'register?': this.formData['register?'] !== false,
            password: this.formData.password || ''
        };

        try {
            let result: any;
            if (this.isNew) {
                result = await this.extensionService.create(payload).toPromise();
            } else {
                result = await this.extensionService.update(this.extension!.uuid!, payload).toPromise();
            }

            const savedData = { ...this.formData, ...result };

            if (this.isModal) {
                this.modalCtrl.dismiss(savedData, 'save');
            } else {
                // Routed mode — go back to the previous page (e.g. Actions).
                this.navCtrl.back();
            }
        } catch (error: any) {
            console.error('Error saving extension:', error);
            this.saveError = (error && error.error && error.error.error) || this.translate.instant('EXTENSION.EDIT.SAVE_FAILED');
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
