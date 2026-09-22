import { Component, Input, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BotService } from '../../../core/_base/layout/services/bot.service';
import { Bot, ScriptRule, parseBotScript, serializeBotScript } from '../../../core/_base/layout/models/bot.model';

/**
 * Create/edit a bot (`/api/admin/bots`).
 *
 * The `script` attribute is plain text — lines of `keyword => reply`, with `#`
 * comments. It is parsed into editable rule rows on open and serialized back on
 * save; comment/blank lines are carried through verbatim so nothing an author
 * wrote is lost by a round-trip through this form.
 */
@Component({
    selector: 'page-bot-edit',
    templateUrl: 'bot-edit.html',
    styleUrls: ['./bot-edit.scss'],
    standalone: false
})
export class BotEditPage implements OnInit {
    @Input() isNew = true;
    @Input() isModal = false;
    @Input() bot: Bot | null = null;

    formData: Bot = {
        name: '',
        model: 'gemini-2.5-flash',
        system_prompt: '',
        greeting: '',
        enabled: true
    };

    /** Editable rules parsed out of `script`. */
    rules: ScriptRule[] = [];
    /** Raw-text escape hatch for the script. */
    showRawScript = false;
    rawScript = '';

    saving = false;
    formValid = false;
    saveError: string | null = null;

    constructor(
        private modalCtrl: ModalController,
        private navCtrl: NavController,
        private route: ActivatedRoute,
        private botService: BotService,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        if (this.bot && !this.isNew) {
            this.applyBot(this.bot);
        } else if (!this.isModal) {
            const uuid = this.route.snapshot.paramMap.get('uuid');
            if (uuid && uuid !== 'new') {
                this.isNew = false;
                this.botService.getOne(uuid).subscribe({
                    next: (bot) => {
                        if (!bot) { return; }
                        this.bot = bot;
                        this.applyBot(bot);
                        this.validateForm();
                    },
                    error: (err) => console.error('Error loading bot:', err)
                });
            }
        }

        this.validateForm();
    }

    private applyBot(bot: Bot) {
        this.formData = {
            name: bot.name || '',
            model: bot.model || '',
            system_prompt: bot.system_prompt || '',
            greeting: bot.greeting || '',
            enabled: bot.enabled !== false
        };
        this.rules = parseBotScript(bot.script);
        this.rawScript = bot.script || '';
    }

    validateForm() {
        this.formValid = !!(this.formData.name && this.formData.name.trim());
    }

    onNameChange() {
        this.validateForm();
    }

    // ==================
    // Script rules
    // ==================

    /** Only the editable (non-comment) rules — comments stay in `rules`. */
    get editableRules(): ScriptRule[] {
        return this.rules.filter(rule => !rule.comment);
    }

    addRule() {
        this.rules.push({ keyword: '', reply: '', comment: false });
    }

    removeRule(rule: ScriptRule) {
        const index = this.rules.indexOf(rule);
        if (index > -1) { this.rules.splice(index, 1); }
    }

    /** Switch between the rule rows and the raw script text, keeping them in sync. */
    toggleRawScript() {
        if (this.showRawScript) {
            this.rules = parseBotScript(this.rawScript);
        } else {
            this.rawScript = serializeBotScript(this.rules);
        }
        this.showRawScript = !this.showRawScript;
    }

    // ==================
    // Save
    // ==================

    async save() {
        if (!this.formValid) {
            return;
        }

        this.saving = true;
        this.saveError = null;

        const payload: Partial<Bot> = {
            name: (this.formData.name || '').trim(),
            model: this.formData.model || '',
            system_prompt: this.formData.system_prompt || '',
            greeting: this.formData.greeting || '',
            enabled: this.formData.enabled !== false,
            script: this.showRawScript ? this.rawScript : serializeBotScript(this.rules)
        };

        try {
            let result: any;
            if (this.isNew) {
                result = await this.botService.create(payload).toPromise();
            } else {
                result = await this.botService.update(this.bot!.uuid!, payload).toPromise();
            }

            const savedData = { ...this.formData, ...result };

            if (this.isModal) {
                this.modalCtrl.dismiss(savedData, 'save');
            } else {
                this.navCtrl.back();
            }
        } catch (error: any) {
            console.error('Error saving bot:', error);
            this.saveError = (error && error.error && error.error.error) || this.translate.instant('BOT.EDIT.SAVE_FAILED');
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
