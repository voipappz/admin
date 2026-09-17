import { Component } from '@angular/core';
import { NotificationService } from '../../core/_base/layout/services/notification.service';

@Component({
  selector: 'page-notifications',
  templateUrl: 'notifications-page.html',
  styleUrls: ['./notifications-page.scss'],
  standalone: false
})
export class NotificationsPage {
  notifications: any[] = [];
  loading = true;

  constructor(private notificationService: NotificationService) {}

  ionViewWillEnter() {
    this.load();
  }

  load(event?: any) {
    if (!event) { this.loading = true; }
    this.notificationService.getAll().subscribe({
      next: (data: any) => {
        this.notifications = Array.isArray(data) ? data : (data?.data || []);
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.notifications = [];
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  // ---- display helpers (defensive about server field names) ----
  title(n: any): string { return n?.subject || n?.title || n?.name || n?.msg || n?.message || 'Notification'; }
  body(n: any): string {
    const t = this.title(n);
    const b = n?.message || n?.msg || n?.body || n?.description || '';
    return b === t ? '' : b;
  }
  isUnread(n: any): boolean { return !(n?.read_at || n?.read || n?.seen); }
  time(n: any): any { return n?.created_at || n?.date || n?.updated_at || null; }
  private level(n: any): string { return ((n?.level || n?.type || 'info') + '').toLowerCase(); }
  iconFor(n: any): string {
    switch (this.level(n)) {
      case 'error': case 'exception': return 'alert-circle';
      case 'warning': case 'warn': return 'warning';
      case 'success': return 'checkmark-circle';
      default: return 'information-circle';
    }
  }
  colorFor(n: any): string {
    switch (this.level(n)) {
      case 'error': case 'exception': return 'danger';
      case 'warning': case 'warn': return 'warning';
      case 'success': return 'success';
      default: return 'primary';
    }
  }
  get unreadCount(): number { return (this.notifications || []).filter(n => this.isUnread(n)).length; }

  // Tap a notification -> mark it read (optimistic, then sync).
  open(n: any) {
    if (this.isUnread(n)) {
      n.read_at = new Date().toISOString();
      const uuid = n.uuid || n.id;
      if (uuid) { this.notificationService.markRead(uuid).subscribe({ next: () => {}, error: () => {} }); }
    }
  }

  markAll() {
    if (this.unreadCount === 0) { return; }
    this.notifications = this.notifications.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }));
    this.notificationService.markAllRead().subscribe({ next: () => this.load(), error: () => {} });
  }
}
