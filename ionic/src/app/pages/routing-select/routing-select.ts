import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DidService } from '../../core/_base/layout/services/did.service';
import { IvrService } from '../../core/_base/layout/services/ivr.service';

// In-page (routed) replacement for the action-sheet routing pickers:
//   Step 1 — choose a destination type (ivr/queue/extension/number/condition)
//   Step 2 — choose the specific destination
// then PATCH /api/dids/{uuid} and go back. No modals.
@Component({
  selector: 'page-routing-select',
  templateUrl: 'routing-select.html',
  styleUrls: ['./routing-select.scss'],
  standalone: false,
  providers: [DidService, IvrService]
})
export class RoutingSelectPage {
  didUuid = '';
  loading = true;
  saving = false;

  types: string[] = [];
  selectedType: string | null = null;
  destinations: any[] = [];
  searchTerm = '';

  // Types with an in-page (routed) create form. Extend as more are converted.
  private routedCreate: { [type: string]: string } = {
    extension: '/app/extension',
    number: '/app/number',
    queue: '/app/queue'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
    private translate: TranslateService,
    private didService: DidService,
    private ivrService: IvrService
  ) {}

  ionViewWillEnter() {
    if (!this.didUuid) {
      this.didUuid = this.route.snapshot.paramMap.get('didUuid') || '';
    }
    if (this.selectedType) {
      // Returning (e.g. from the create form) — refresh the destination list so
      // a just-created destination shows up to pick.
      this.pickType(this.selectedType);
    } else {
      this.searchTerm = '';
      this.loadTypes();
    }
  }

  canCreate(): boolean {
    return !!this.selectedType && !!this.routedCreate[this.selectedType];
  }

  // Best mobile/PWA practice: a full-screen push form (back button), not a
  // popup. After saving, nav-back returns here and the list refreshes.
  goCreate() {
    if (!this.selectedType) { return; }
    const base = this.routedCreate[this.selectedType];
    if (base) { this.router.navigate([base, 'new']); }
  }

  loadTypes() {
    this.loading = true;
    this.ivrService.getBridgeTypes().subscribe({
      next: (t: any) => { this.types = t || []; this.loading = false; },
      error: () => { this.types = []; this.loading = false; }
    });
  }

  pickType(type: string) {
    this.selectedType = type;
    this.searchTerm = '';
    this.loading = true;
    this.ivrService.getBridgeData(type).subscribe({
      next: (d: any) => { this.destinations = d || []; this.loading = false; },
      error: () => { this.destinations = []; this.loading = false; }
    });
  }

  // Back: step 2 -> step 1, step 1 -> leave the page.
  back() {
    if (this.selectedType) {
      this.selectedType = null;
      this.destinations = [];
      this.searchTerm = '';
    } else {
      this.navCtrl.back();
    }
  }

  async pickDestination(dest: any) {
    if (!this.selectedType || !dest?.uuid || !this.didUuid) { return; }
    this.saving = true;
    try {
      await this.didService.update(this.didUuid, {
        bridge_type: this.selectedType,
        bridge_uuid: dest.uuid
      });
      this.navCtrl.back();
    } catch (err) {
      console.error('Error saving routing:', err);
      this.saving = false;
    }
  }

  onSearch(ev: any) {
    this.searchTerm = ((ev?.detail?.value ?? '') + '').toLowerCase().trim();
  }

  get filteredDestinations(): any[] {
    if (!this.searchTerm) { return this.destinations; }
    return this.destinations.filter((d) =>
      ((d.name || '') + '').toLowerCase().includes(this.searchTerm) ||
      ((d.number || '') + '').toLowerCase().includes(this.searchTerm)
    );
  }

  typeLabel(type: string): string {
    const key = `IVR.BRIDGE_TYPES.${type}`;
    const t = this.translate.instant(key);
    return t !== key ? t : type;
  }

  iconForType(type: string): string {
    switch (type) {
      case 'ivr': return 'keypad-outline';
      case 'queue': return 'people-outline';
      case 'extension': return 'call-outline';
      case 'number': return 'phone-portrait-outline';
      case 'call_condition':
      case 'time_condition': return 'time-outline';
      case 'announcement': return 'megaphone-outline';
      default: return 'git-branch-outline';
    }
  }
}
