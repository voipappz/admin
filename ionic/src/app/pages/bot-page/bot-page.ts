import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { BotService } from '../../core/_base/layout/services/bot.service';
import { Bot } from '../../core/_base/layout/models/bot.model';
import { BotEditPage } from './bot-edit/bot-edit';

/**
 * Bots on the connectix box (`/api/admin/bots`) — the thing that answers a
 * number. List + create/edit; no graph, no canvas: a bot is a prompt, a
 * greeting, and a list of keyword rules.
 */
@Component({
    selector: 'page-bot',
    templateUrl: 'bot-page.html',
    styleUrls: ['./bot-page.scss'],
    standalone: false
})
export class BotPage implements OnInit, OnDestroy {
    bots: Bot[] = [];
    dataAvailable = false;
    loading = true;
    error: string | null = null;

    private subscription: Subscription | null = null;

    constructor(
        private botService: BotService,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        this.loadBots();
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    ionViewWillEnter() {
        this.loadBots();
    }

    loadBots() {
        this.loading = true;
        this.error = null;

        // AdminService degrades an absent local API to [] — the page shows its
        // empty state instead of an error.
        this.subscription = this.botService.getAll().subscribe({
            next: (bots) => {
                this.bots = bots || [];
                this.dataAvailable = true;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading bots:', err);
                this.error = this.translate.instant('BOT.LIST.LOAD_FAILED');
                this.loading = false;
            }
        });
    }

    async createBot() {
        const modal = await this.modalCtrl.create({
            component: BotEditPage,
            componentProps: { isNew: true, isModal: true }
        });
        await modal.present();

        const { role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadBots();
        }
    }

    async editBot(bot: Bot) {
        const modal = await this.modalCtrl.create({
            component: BotEditPage,
            componentProps: { isNew: false, isModal: true, bot }
        });
        await modal.present();

        const { role } = await modal.onWillDismiss();
        if (role === 'save') {
            this.loadBots();
        }
    }

    /** Optimistic enable/disable straight from the list. */
    toggleEnabled(bot: Bot, event: Event) {
        event.stopPropagation();
        const next = !bot.enabled;
        bot.enabled = next;

        this.botService.update(bot.uuid!, { enabled: next }).subscribe({
            next: () => { /* already reflected */ },
            error: (err) => {
                console.error('Error toggling bot:', err);
                bot.enabled = !next;
            }
        });
    }

    async deleteBot(bot: Bot, slidingItem: any) {
        const alert = await this.alertCtrl.create({
            header: this.translate.instant('BOT.ACTIONS.DELETE_CONFIRM_TITLE'),
            message: this.translate.instant('BOT.ACTIONS.DELETE_CONFIRM_MESSAGE', { name: bot.name }),
            buttons: [
                {
                    text: this.translate.instant('BUTTONS.CANCEL'),
                    role: 'cancel',
                    handler: () => { if (slidingItem) { slidingItem.close(); } }
                },
                {
                    text: this.translate.instant('BUTTONS.DELETE'),
                    role: 'destructive',
                    handler: () => { this.confirmDelete(bot); }
                }
            ]
        });

        await alert.present();
    }

    private confirmDelete(bot: Bot) {
        this.botService.delete(bot.uuid!).subscribe({
            next: () => {
                this.bots = this.bots.filter(b => b.uuid !== bot.uuid);
            },
            error: (err) => console.error('Error deleting bot:', err)
        });
    }

    trackByUuid(index: number, bot: Bot): string {
        return bot.uuid || index.toString();
    }
}
