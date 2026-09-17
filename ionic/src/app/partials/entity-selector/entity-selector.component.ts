import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ModalController } from '@ionic/angular';

// Special value to trigger create modal
const CREATE_NEW_VALUE = '__CREATE_NEW__';

@Component({
    selector: 'app-entity-selector',
    templateUrl: './entity-selector.component.html',
    styleUrls: ['./entity-selector.component.scss'],
    standalone: false
})
export class EntitySelectorComponent implements OnChanges {
    // Selection binding
    @Input() selectedUuid: string = '';
    @Input() items: any[] = [];

    // Display configuration
    @Input() label: string = 'Select';
    @Input() placeholder: string = '';
    @Input() displayField: string = 'name';
    @Input() valueField: string = 'uuid';

    // Behavior configuration
    @Input() required: boolean = false;
    @Input() disabled: boolean = false;
    @Input() showAddButton: boolean = true;

    // Create modal configuration
    @Input() createModalComponent: any;
    @Input() createModalProps: any = {};
    @Input() addButtonLabel: string = 'Add new';

    // Events
    @Output() selectionChange = new EventEmitter<string>();
    @Output() entityCreated = new EventEmitter<any>();

    // Internal state
    internalSelectedUuid: string = '';

    // Expose to template
    readonly CREATE_NEW_VALUE = CREATE_NEW_VALUE;

    constructor(private modalCtrl: ModalController) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['selectedUuid']) {
            this.internalSelectedUuid = this.selectedUuid;
        }
    }

    async onSelectionChange(): Promise<void> {
        if (this.internalSelectedUuid === CREATE_NEW_VALUE) {
            // Reset to previous value and open create modal
            this.internalSelectedUuid = this.selectedUuid;
            await this.openCreateModal();
        } else {
            this.selectionChange.emit(this.internalSelectedUuid);
        }
    }

    async openCreateModal(): Promise<void> {
        if (!this.createModalComponent) {
            console.warn('EntitySelector: No createModalComponent provided');
            return;
        }

        const modal = await this.modalCtrl.create({
            component: this.createModalComponent,
            componentProps: this.createModalProps
        });

        await modal.present();

        const { data, role } = await modal.onWillDismiss();
        if (role === 'save' && data) {
            this.entityCreated.emit(data);
            // Auto-select the newly created entity
            if (data[this.valueField]) {
                this.internalSelectedUuid = data[this.valueField];
                this.selectionChange.emit(this.internalSelectedUuid);
            }
        }
    }

    /**
     * Get display value for an item
     */
    getDisplayValue(item: any): string {
        if (!item) return '';
        return item[this.displayField] || '';
    }

    /**
     * Get value field for an item
     */
    getValue(item: any): any {
        if (!item) return '';
        return item[this.valueField] || '';
    }

    /**
     * Track function for ngFor
     */
    trackByValue(index: number, item: any): any {
        return item ? item[this.valueField] : index;
    }
}
