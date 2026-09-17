import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
}

/**
 * One mobile-native toaster for the whole app (wraps Ionic ToastController).
 * Mirrors the portal's ngx-toastr API (success/error/info) so call sites read
 * the same, but renders as a native Ionic toast — no extra web-only dependency.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private static readonly COLOR: { [k in ToastType]: string } = {
    success: 'success',
    error: 'danger',
    info: 'primary',
    warning: 'warning'
  };

  constructor(private toastCtrl: ToastController) {}

  success(message: string, title?: string) { return this.show({ message, title, type: 'success' }); }
  error(message: string, title?: string)   { return this.show({ message, title, type: 'error', duration: 6000 }); }
  info(message: string, title?: string)    { return this.show({ message, title, type: 'info' }); }
  warning(message: string, title?: string) { return this.show({ message, title, type: 'warning' }); }

  async show(opts: ToastOptions) {
    const toast = await this.toastCtrl.create({
      header: opts.title,
      message: opts.message,
      color: ToastService.COLOR[opts.type || 'info'],
      duration: opts.duration ?? 3000,
      position: opts.position || 'bottom',
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
    return toast;
  }
}
