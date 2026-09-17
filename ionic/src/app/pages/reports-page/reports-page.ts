import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ReportService } from '../../core/_base/layout/services/report.service';

@Component({
  selector: 'page-reports',
  templateUrl: 'reports-page.html',
  styleUrls: ['./reports-page.scss'],
  standalone: false
})
export class ReportsPage {
  reports: any[] = [];
  loading = true;
  errored = false;

  constructor(private reportSvc: ReportService, private router: Router) {}

  ionViewWillEnter() {
    this.load();
  }

  load(event?: any) {
    if (!event) { this.loading = true; }
    this.errored = false;
    this.reportSvc.get().then((res: any) => {
      this.reports = Array.isArray(res) ? res : (res?.data || res?.reports || []);
      this.loading = false;
      event?.target?.complete();
    }).catch(() => {
      this.errored = true;
      this.loading = false;
      this.reports = [];
      event?.target?.complete();
    });
  }

  open(report: any) {
    if (!report?.uuid) { return; }
    // Pass the name through router state so the run page can show it instantly.
    this.router.navigate(['/app/reports', report.uuid], { state: { name: report.name } });
  }

  typeColor(report: any): string {
    switch ((report?.type || '') + '') {
      case 'bar': case 'column': return 'primary';
      case 'line': return 'tertiary';
      case 'pie': return 'secondary';
      case 'table': return 'medium';
      default: return 'medium';
    }
  }
}
