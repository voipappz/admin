import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ConferenceService } from '../../core/_base/layout/services/conference.service';
import { Events } from '../../core/providers/events';

@Component({
  selector: 'page-conference',
  templateUrl: 'conference-page.html',
  styleUrls: ['./conference-page.scss'],
  standalone: false
})
export class ConferencePage {
  conferences: any[] = [];
  loading = true;
  errored = false;

  constructor(
    private conferenceService: ConferenceService,
    private events: Events,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {}

  ionViewWillEnter() {
    this.load();
  }

  load(event?: any) {
    if (!event) { this.loading = true; }
    this.errored = false;
    this.conferenceService.list().subscribe({
      next: (res: any) => {
        this.conferences = Array.isArray(res) ? res : (res?.data || res?.conferences || []);
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.errored = true;
        this.loading = false;
        this.conferences = [];
        event?.target?.complete();
      }
    });
  }

  // "Join" = dial the conference DID through the existing WebRTC phone.
  // app.component listens for 'phone:dial' and routes it through its normal
  // outgoing-call path (no WebRTC changes here).
  async join(conf: any) {
    const number = this.didNumber(conf);
    if (!number) {
      const t = await this.toastCtrl.create({
        message: this.translate.instant('CONFERENCE.NO_NUMBER'),
        duration: 3000, position: 'bottom', color: 'warning'
      });
      t.present();
      return;
    }
    this.events.publish('phone:dial', number);
    const t = await this.toastCtrl.create({
      message: this.translate.instant('CONFERENCE.JOINING', { name: conf?.name || '' }),
      duration: 2500, position: 'bottom', color: 'success'
    });
    t.present();
  }

  // ---- display helpers ----
  didNumber(conf: any): string {
    const d = conf?.did;
    if (!d) { return ''; }
    if (typeof d === 'string') { return d; }
    return d.number || d.did || d.uuid || '';
  }
  members(conf: any): number { return conf?.members_count_current ?? 0; }
  statusColor(conf: any): string {
    switch ((conf?.status || '') + '') {
      case 'active': case 'running': return 'success';
      case 'scheduled': return 'primary';
      case 'ended': case 'expired': return 'medium';
      default: return 'medium';
    }
  }
}
