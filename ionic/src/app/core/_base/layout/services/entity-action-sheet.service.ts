import { Injectable } from '@angular/core';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

export interface EntityActionSheetConfig {
    header: string;
    items: any[];
    displayField?: string;
    valueField?: string;
    createModalComponent?: any;
    createModalProps?: any;
    addButtonLabel?: string;
}

export interface EntityActionSheetResult {
    action: 'select' | 'create' | 'cancel';
    item?: any;
    uuid?: string;
    name?: string;
}

@Injectable({
    providedIn: 'root'
})
export class EntityActionSheetService {

    constructor(
        private actionSheetCtrl: ActionSheetController,
        private modalCtrl: ModalController,
        private translate: TranslateService
    ) {}

    /**
     * Open action sheet with items and optional create button
     */
    async open(config: EntityActionSheetConfig): Promise<EntityActionSheetResult> {
        const displayField = config.displayField || 'name';
        const valueField = config.valueField || 'uuid';

        return new Promise(async (resolve) => {
            const buttons: any[] = [];

            // Add "+ Create New" option if create modal provided
            if (config.createModalComponent) {
                buttons.push({
                    text: `＋ ${config.addButtonLabel || this.translate.instant('COMMON.ADD_NEW')}`,
                    cssClass: 'entity-action-sheet-create',
                    handler: async () => {
                        const result = await this.handleCreate(config);
                        resolve(result);
                        return true; // Dismiss action sheet
                    }
                });
            }

            // Add items
            config.items.forEach(item => {
                buttons.push({
                    text: item[displayField],
                    handler: () => {
                        resolve({
                            action: 'select',
                            item,
                            uuid: item[valueField],
                            name: item[displayField]
                        });
                        return true;
                    }
                });
            });

            // Add cancel
            buttons.push({
                text: this.translate.instant('BUTTONS.CANCEL'),
                role: 'cancel',
                handler: () => {
                    resolve({ action: 'cancel' });
                    return true;
                }
            });

            const actionSheet = await this.actionSheetCtrl.create({
                header: config.header,
                buttons,
                cssClass: 'entity-action-sheet'
            });

            await actionSheet.present();
        });
    }

    /**
     * Open create modal and return result
     */
    private async handleCreate(config: EntityActionSheetConfig): Promise<EntityActionSheetResult> {
        console.log('handleCreate called with:', config.createModalComponent, config.createModalProps);

        try {
            const modal = await this.modalCtrl.create({
                component: config.createModalComponent,
                componentProps: config.createModalProps || {}
            });

            console.log('Modal created:', modal);
            await modal.present();
            console.log('Modal presented');

            const { data, role } = await modal.onWillDismiss();

            if (role === 'save' && data) {
                const displayField = config.displayField || 'name';
                const valueField = config.valueField || 'uuid';
                return {
                    action: 'create',
                    item: data,
                    uuid: data[valueField],
                    name: data[displayField]
                };
            }

            // User cancelled create modal - reopen action sheet
            return this.open(config);
        } catch (error) {
            console.error('Error opening create modal:', error);
            return { action: 'cancel' };
        }
    }
}
