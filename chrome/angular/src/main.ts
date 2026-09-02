// FIRST: installs a `chrome` stand-in when there isn't one, so `ng serve` can
// bootstrap. Inside the packed extension it does nothing. Must be imported
// before anything reads `chrome` — the query below is the first such read.
import './app/providers/chrome-shim';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { TAB_ID } from './app/providers/tab-id.provider';

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (environment.production) {
    enableProdMode();
  }

  const tab = [...tabs].pop();
  const { id: tabId } = tab;

  // provides the current Tab ID so you can send messages to the content page
  platformBrowserDynamic([{ provide: TAB_ID, useValue: tabId }])
    .bootstrapModule(AppModule)
    .catch(error => console.error(error));
});
