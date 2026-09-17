import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TimeConditionService, LocationsService } from '../../../core/_base/layout';
import { UserData } from '../../../core/providers/user-data';

@Component({
    selector: 'page-time-condition-detail',
    templateUrl: 'time-condition-detail.html',
    styleUrls: ['./time-condition-detail.scss'],
    standalone: false
})
export class TimeConditionDetailPage implements OnInit, OnDestroy, OnChanges {
    // Input for embedded usage (without routing)
    @Input() timeConditionUuid: string = '';
    @Input() embedded: boolean = false;

    timeCondition: any = null;
    loading = true;
    error: string | null = null;
    locations: any[] = [];

    private subscription: Subscription | null = null;
    private uuid: string = '';

    week_day_array = ['', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private navCtrl: NavController,
        private modalCtrl: ModalController,
        private alertCtrl: AlertController,
        private timeConditionService: TimeConditionService,
        private locationsSvc: LocationsService,
        private userData: UserData,
        private translate: TranslateService
    ) {}

    ngOnInit() {
        // Get UUID from route if not provided via Input
        if (!this.timeConditionUuid) {
            this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
        } else {
            this.uuid = this.timeConditionUuid;
        }
        this.loadLocations();
        this.loadData();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Reload when timeConditionUuid input changes
        if (changes['timeConditionUuid'] && !changes['timeConditionUuid'].firstChange) {
            this.uuid = this.timeConditionUuid;
            this.loadTimeCondition();
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    ionViewWillEnter() {
        if (this.uuid) {
            this.loadTimeCondition();
        }
    }

    private loadLocations() {
        this.locations = this.locationsSvc.getLocations();
    }

    loadData() {
        this.loadTimeCondition();
    }

    loadTimeCondition() {
        if (!this.uuid) {
            this.error = this.translate.instant('TIME_CONDITION.ERRORS.NO_UUID');
            this.loading = false;
            return;
        }

        this.loading = true;
        this.error = null;

        this.subscription = this.timeConditionService.getByUuid(this.uuid).subscribe({
            next: (data) => {
                // Get type from meta, default to 'always'
                data.type = data.meta?.type || (data.resources?.length > 0 ? 'selected_hours' : 'always');
                this.timeCondition = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading time condition:', err);
                this.error = this.translate.instant('TIME_CONDITION.ERRORS.LOAD_FAILED');
                this.loading = false;
            }
        });
    }

    /**
     * Open edit modal (following IVR edit pattern - fetch fresh data first)
     */
    async editTimeCondition() {
        // Old approach - router navigation:
        // this.router.navigate(['/app/time-condition', this.uuid]);

        // Old approach - pass local data:
        // const modal = await this.modalCtrl.create({
        //     component: TimeConditionPage,
        //     componentProps: { isNew: false, isModal: true, callCondition: this.timeCondition }
        // });

        // New approach - fetch fresh data from server first (like IVR edit)
        this.timeConditionService.getByUuid(this.uuid).subscribe({
            next: async (callCondition) => {
                const { TimeConditionPage } = await import('../time-condition-page');
                const modal = await this.modalCtrl.create({
                    component: TimeConditionPage,
                    componentProps: {
                        isNew: false,
                        isModal: true,
                        callCondition: callCondition
                    }
                });
                await modal.present();

                const { role } = await modal.onWillDismiss();
                if (role === 'save') {
                    // Reload data after save
                    this.loadTimeCondition();
                }
            },
            error: (err) => {
                console.error('Error loading time condition for edit:', err);
            }
        });
    }

    /**
     * Go back to previous page
     */
    goBack() {
        this.navCtrl.back();
    }

    // ==================
    // Helper Methods
    // ==================

    getTypeLabel(): string {
        if (!this.timeCondition?.type) return '';
        return this.translate.instant('TIME_CONDITION.TYPES.' + this.timeCondition.type.toUpperCase() + '.TITLE');
    }

    getFallbackBridgeLabel(): string {
        if (!this.timeCondition?.fallback_bridge_type || !this.timeCondition?.fallback_bridge_uuid) {
            return this.translate.instant('BUTTONS.NOT_SET');
        }

        // Try to find in locations
        const location = this.locations.find(
            loc => loc.type === this.timeCondition.fallback_bridge_type &&
                   loc.type_uuid === this.timeCondition.fallback_bridge_uuid
        );

        if (location) {
            return location.name;
        }

        const typeLabel = this.translate.instant('TIME_CONDITION.BRIDGE.BRIDGE_TYPES.' + this.timeCondition.fallback_bridge_type);
        return typeLabel;
    }

    getFallbackBridgeIcon(): string {
        if (!this.timeCondition?.fallback_bridge_type || !this.timeCondition?.fallback_bridge_uuid) {
            return 'help-circle-outline';
        }

        // Try to find in user's locations
        const location = this.locations.find(
            loc => loc.type === this.timeCondition.fallback_bridge_type &&
                   loc.type_uuid === this.timeCondition.fallback_bridge_uuid
        );

        if (location?.meta?.icon) {
            return location.meta.icon;
        }

        // Fallback: icon based on bridge type
        const iconMap: { [key: string]: string } = {
            'extension': 'call-outline',
            'number': 'phone-portrait-outline',
            'ivr': 'keypad-outline',
            'queue': 'people-outline',
            'call_condition': 'time-outline',
            'time_condition': 'time-outline'
        };
        return iconMap[this.timeCondition.fallback_bridge_type] || 'location-outline';
    }

    getResourcesCount(): number {
        return this.timeCondition?.resources?.length || 0;
    }

    getDayLabel(weekDay: string): string {
        if (!weekDay) return '';
        const dayIndex = parseInt(weekDay.split('-')[0]);
        const dayName = this.week_day_array[dayIndex];
        if (!dayName) return '';
        return this.translate.instant('TIME_CONDITION.TYPES.OPTIONS.' + dayName);
    }

    getTimeRange(resource: any): string {
        return resource?.time || '';
    }

    getResourceBridgeLabel(resource: any): string {
        if (!resource?.bridge_type || !resource?.bridge_uuid) {
            return this.translate.instant('TIME_CONDITION.BRIDGE.FALLBACK_TITLE');
        }

        const location = this.locations.find(
            loc => loc.type === resource.bridge_type && loc.type_uuid === resource.bridge_uuid
        );

        if (location) {
            return location.name;
        }

        // Old approach - show bridge_type translation:
        // return this.translate.instant('TIME_CONDITION.BRIDGE.BRIDGE_TYPES.' + resource.bridge_type);

        // New approach - return empty if no location found (fallback handled elsewhere)
        return '';
    }

    getResourceBridgeIcon(resource: any): string {
        if (!resource?.bridge_type || !resource?.bridge_uuid) {
            return 'location-outline';
        }

        // Try to find in user's locations
        const location = this.locations.find(
            loc => loc.type === resource.bridge_type && loc.type_uuid === resource.bridge_uuid
        );

        if (location?.meta?.icon) {
            return location.meta.icon;
        }

        // Fallback: icon based on bridge type
        const iconMap: { [key: string]: string } = {
            'extension': 'call-outline',
            'number': 'phone-portrait-outline',
            'ivr': 'keypad-outline',
            'queue': 'people-outline',
            'call_condition': 'time-outline',
            'time_condition': 'time-outline'
        };
        return iconMap[resource.bridge_type] || 'location-outline';
    }
}
