import '@angular/compiler';

import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// Register ionicons to avoid "Failed to fetch" errors when serving from remote hosts
import { addIcons } from 'ionicons';
import {
  chevronBackOutline, checkmarkOutline, videocamOutline, call, backspace,
  arrowBackOutline, idCardOutline, compassOutline, logOutOutline, settingsOutline,
  closeOutline, keypadOutline, callOutline, search, options, shareSocial,
  logoVimeo, logoInstagram, logoTwitter, logoFacebook, arrowForward, logoGithub,
  alertCircleOutline, closeCircleOutline, home, briefcaseOutline, cog,
  starOutline, star, share, cloudDownload, searchOutline, optionsOutline,
  banOutline, informationCircleOutline, downloadOutline, ellipsisVerticalOutline,
  micCircleOutline, addOutline, trashOutline, moon, notifications, calendar,
  chatbubblesOutline, location, speedometerOutline, appsOutline, languageOutline,
  // Additional common icons
  close, add, remove, chevronForwardOutline, chevronDownOutline, chevronUpOutline,
  menuOutline, personOutline, mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
  refreshOutline, syncOutline, createOutline, pencilOutline, saveOutline,
  timeOutline, calendarOutline, helpCircleOutline, warningOutline
} from 'ionicons/icons';

addIcons({
  'chevron-back-outline': chevronBackOutline,
  'checkmark-outline': checkmarkOutline,
  'videocam-outline': videocamOutline,
  'call': call,
  'backspace': backspace,
  'arrow-back-outline': arrowBackOutline,
  'id-card-outline': idCardOutline,
  'compass-outline': compassOutline,
  'log-out-outline': logOutOutline,
  'settings-outline': settingsOutline,
  'close-outline': closeOutline,
  'keypad-outline': keypadOutline,
  'call-outline': callOutline,
  'search': search,
  'options': options,
  'share-social': shareSocial,
  'logo-vimeo': logoVimeo,
  'logo-instagram': logoInstagram,
  'logo-twitter': logoTwitter,
  'logo-facebook': logoFacebook,
  'arrow-forward': arrowForward,
  'logo-github': logoGithub,
  'alert-circle-outline': alertCircleOutline,
  'close-circle-outline': closeCircleOutline,
  'home': home,
  'briefcase-outline': briefcaseOutline,
  'cog': cog,
  'star-outline': starOutline,
  'star': star,
  'share': share,
  'cloud-download': cloudDownload,
  'search-outline': searchOutline,
  'options-outline': optionsOutline,
  'ban-outline': banOutline,
  'information-circle-outline': informationCircleOutline,
  'download-outline': downloadOutline,
  'ellipsis-vertical-outline': ellipsisVerticalOutline,
  'mic-circle-outline': micCircleOutline,
  'add-outline': addOutline,
  'trash-outline': trashOutline,
  'moon': moon,
  'notifications': notifications,
  'calendar': calendar,
  'chatbubbles-outline': chatbubblesOutline,
  'location': location,
  'speedometer-outline': speedometerOutline,
  'apps-outline': appsOutline,
  'language-outline': languageOutline,
  // Additional common icons
  'close': close,
  'add': add,
  'remove': remove,
  'chevron-forward-outline': chevronForwardOutline,
  'chevron-down-outline': chevronDownOutline,
  'chevron-up-outline': chevronUpOutline,
  'menu-outline': menuOutline,
  'person-outline': personOutline,
  'mail-outline': mailOutline,
  'lock-closed-outline': lockClosedOutline,
  'eye-outline': eyeOutline,
  'eye-off-outline': eyeOffOutline,
  'refresh-outline': refreshOutline,
  'sync-outline': syncOutline,
  'create-outline': createOutline,
  'pencil-outline': pencilOutline,
  'save-outline': saveOutline,
  'time-outline': timeOutline,
  'calendar-outline': calendarOutline,
  'help-circle-outline': helpCircleOutline,
  'warning-outline': warningOutline
});

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], })
  .catch(err => console.log(err));
