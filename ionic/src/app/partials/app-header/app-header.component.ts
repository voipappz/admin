import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonPopover, MenuController, PopoverController, AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Events } from '../../core/providers/events';
import { UserData } from '../../core/providers/user-data';
import { AclService } from '../../core/providers/acl.service';
import { TranslationService } from '../../core/_base/layout/services/translation.service';
import { NotificationService } from '../../core/_base/layout/services/notification.service';
import { IdentitiesPage } from '../../pages/identities-page/identities-page';
import { LocationsPage } from '../../pages/locations-page/locations-page';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
  standalone: false
})
export class AppHeaderComponent {
  @Input() title: string = '';
  @Input() showSearch: boolean = false;
  @Input() searchPlaceholder: string = '';
  @Input() searchDebounce: number = 150;
  @Output() search = new EventEmitter<string>();
  @ViewChild('userMenuPopover') userMenuPopover: IonPopover;

  darkMode: boolean = false;
  notifications: any[] = [];
  unreadNotifications: number = 0;

  constructor(
    private events: Events,
    private menu: MenuController,
    private userData: UserData,
    private aclSvc: AclService,
    private popoverCtrl: PopoverController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private notificationService: NotificationService,
    private translationService: TranslationService,
    private translate: TranslateService,
    private router: Router
  ) {
    this.loadNotifications();
    // Mirror the single app-wide dark state for the toggle icon.
    this.darkMode = document.body.classList.contains('dark-theme');
    this.events.subscribe('app:dark', (val: any) => { this.darkMode = !!val; });
  }

  onSearch(ev: any) {
    this.search.emit((ev?.detail?.value ?? '') + '');
  }

  canGo(key: string): boolean {
    return this.aclSvc.canGoToPage(key);
  }

  logout() {
    this.events.publish('app-logout');
  }

  async openUserMenu(event: Event) {
    this.userMenuPopover.event = event;
    await this.userMenuPopover.present();
  }

  async togglePhoneMenu() {
    console.log('[Phone] Toggle phone menu clicked');
    try {
      await this.menu.enable(true, 'phone-sidebar');
      await this.menu.toggle('phone-sidebar');
      console.log('[Phone] Menu toggled successfully');
    } catch (error) {
      console.error('[Phone] Error toggling menu:', error);
      await this.menu.open('phone-sidebar');
    }
  }

  // Drive the single app-wide dark mode (owned by AppComponent). The icon is
  // kept in sync via the 'app:dark' event so the header and phone panel always
  // agree.
  toggleDarkMode() {
    this.events.publish('app:toggle-dark');
  }

  getUserInitial(): string {
    try {
      const user = this.userData.getUserInfo('') as any;
      if (user && user.name) {
        return user.name[0].toUpperCase();
      }
      if (user && user.username) {
        return user.username[0].toUpperCase();
      }
      return 'U';
    } catch (err) {
      return 'U';
    }
  }

  getUserName(): string {
    const user = this.userData.getUserData() || {};
    if (user.first_name) {
      return `${user.first_name} ${user.last_name || ''}`.trim();
    }
    return user.username || this.translate.instant('COMMON.USER');
  }

  getUserEmail(): string {
    const user = this.userData.getUserData() || {};
    return user.email || '';
  }

  getCurrentLanguage(): string {
    return this.translationService.getSelectedLanguage() || 'en';
  }

  async openIdentities() {
    const modal = await this.modalCtrl.create({
      component: IdentitiesPage
    });
    await modal.present();
  }

  async openLocations() {
    const modal = await this.modalCtrl.create({
      component: LocationsPage
    });
    await modal.present();
  }

  openIvr() {
    this.router.navigate(['/app/ivr']);
  }

  openSupport() {
    this.router.navigate(['/support']);
  }

  openTour() {
    this.router.navigate(['/tutorial']);
  }

  openSyslog() {
    this.userMenuPopover?.dismiss();
    this.router.navigate(['/app/syslog']);
  }

  openConference() {
    this.userMenuPopover?.dismiss();
    this.router.navigate(['/app/conference']);
  }

  openReports() {
    this.userMenuPopover?.dismiss();
    this.router.navigate(['/app/reports']);
  }

  toggleLanguage() {
    const currentLang = this.getCurrentLanguage();
    const newLang = currentLang === 'he' ? 'en' : 'he';
    this.userData.setUserData(newLang, 'language');
    this.translationService.setLanguage(newLang);
  }

  loadNotifications() {
    this.notificationService.getAll().subscribe(
      (data: any) => {
        this.notifications = data || [];
        this.unreadNotifications = this.notifications.filter((n: any) => !n.read).length;
      },
      (error) => {
        console.log('Notifications not available:', error);
        this.notifications = [];
        this.unreadNotifications = 0;
      }
    );
  }

  // Open the full notifications list (in-page navigation, with a back button).
  showNotifications(event?: any) {
    this.router.navigate(['/app/notifications']);
  }
}
