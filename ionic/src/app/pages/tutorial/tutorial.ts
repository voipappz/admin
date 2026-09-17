import { Component, ChangeDetectorRef, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';

import { MenuController } from '@ionic/angular';

import { Storage } from '@ionic/storage-angular';
import { register } from 'swiper/element/bundle';

// Register Swiper custom elements
register();

@Component({
    selector: 'page-tutorial',
    templateUrl: 'tutorial.html',
    styleUrls: ['./tutorial.scss'],
    standalone: false
})
export class TutorialPage implements AfterViewInit {
  showSkip = true;
  private swiperEl: any;

  constructor(
    public menu: MenuController,
    public router: Router,
    public storage: Storage,
    private cd: ChangeDetectorRef
  ) {}

  ngAfterViewInit() {
    this.swiperEl = document.querySelector('swiper-container');
    if (this.swiperEl) {
      this.swiperEl.addEventListener('slidechange', () => {
        this.onSlideChangeStart();
      });
    }
  }

  startApp() {
    this.router
      .navigateByUrl('/app/tabs/schedule', { replaceUrl: true })
      .then(() => this.storage.set('ion_did_tutorial', true));
  }

  onSlideChangeStart() {
    if (this.swiperEl && this.swiperEl.swiper) {
      this.showSkip = !this.swiperEl.swiper.isEnd;
      this.cd.detectChanges();
    }
  }

  ionViewWillEnter() {
    this.storage.get('ion_did_tutorial').then(res => {
      if (res === true) {
        this.router.navigateByUrl('/app/tabs/schedule', { replaceUrl: true });
      }
    });

    this.menu.enable(false);
  }

  ionViewDidLeave() {
    // enable the root left menu when leaving the tutorial page
    this.menu.enable(true);
  }
}
