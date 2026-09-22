import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NumberService } from '../../../core/_base/layout/services/number.service';
import { BotService } from '../../../core/_base/layout/services/bot.service';
import { NumberEntity } from '../../../core/_base/layout/models/number.model';
import { Bot } from '../../../core/_base/layout/models/bot.model';

/**
 * Create/edit a number on the connectix box (`/api/admin/numbers`).
 *
 * A number is the digits, a note, and — the part that matters — which bot picks
 * up. The bot is required by the local resource, so the form is invalid without
 * one. The mothership's environment_uuid has no local meaning and is not sent.
 */
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
        notes: '',
        enabled: true,
        bot_id: ''
    };

    /** Bots to choose from, loaded from /api/admin/bots. */
    bots: Bot[] = [];
    botsLoaded = false;

    saving = false;
    formValid = false;
    saveError: string | null = null;

    constructor(
        private modalCtrl: ModalController,
        private navCtrl: NavController,
        private route: ActivatedRoute,
        private numberService: NumberService,
        private botService: BotService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        this.loadBots();

        const routedUuid = !this.isModal ? this.route.snapshot.paramMap.get('uuid') : null;

        if (this.numberEntity && !this.isNew) {
            // Modal edit mode — populate from the row we were handed.
            this.formData = this.toForm(this.numberEntity);
        } else if (routedUuid && routedUuid !== 'new') {
            // Routed (in-page) edit mode — load by :uuid.
            this.isNew = false;
            this.numberService.getOne(routedUuid).subscribe({
                next: (n) => {
                    if (!n) { return; }
                    this.numberEntity = n;
                    this.formData = this.toForm(n);
                    this.validateForm();
                },
                error: (err) => console.error('Error loading number:', err)
            });
        } else {
            this.isNew = true;
        }

        this.validateForm();
    }

    private toForm(entity: NumberEntity): NumberEntity {
        return {
            number: entity.number || '',
            notes: entity.notes || '',
            enabled: entity.enabled !== false,
            bot_id: entity.bot_id || entity.bot_uuid || (entity.bot ? entity.bot.id : '') || ''
        };
    }

    private loadBots() {
        this.botService.getAll().subscribe({
            next: (bots) => {
                this.bots = bots || [];
                this.botsLoaded = true;
                this.validateForm();
            },
            error: (err) => {
                // AdminService already degrades; belt and braces so the form still opens.
                console.warn('Could not load bots:', err);
                this.bots = [];
                this.botsLoaded = true;
            }
        });
    }

    validateForm() {
        this.formValid = !!(this.formData.number && this.formData.number.trim()) && !!this.formData.bot_id;
    }

    onNumberChange() {
        this.validateForm();
    }

    onBotChange(event: any) {
        this.formData.bot_id = (event && event.detail && event.detail.value) || '';
        this.validateForm();
    }

    async save() {
        if (!this.formValid) {
            return;
        }

        this.saving = true;
        this.saveError = null;

        const payload: Partial<NumberEntity> = {
            number: (this.formData.number || '').trim(),
            notes: this.formData.notes || '',
            enabled: this.formData.enabled !== false,
            bot_id: this.formData.bot_id
        };

        try {
            let result: any;
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
        } catch (error: any) {
            console.error('Error saving number:', error);
            this.saveError = (error && error.error && error.error.error) || this.translate.instant('NUMBER.EDIT.SAVE_FAILED');
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
