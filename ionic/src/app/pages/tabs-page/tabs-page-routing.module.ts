import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs-page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'calls',
        children: [
          {
            path: '',
            loadChildren: () => import('../calls/calls.module').then(m => m.CallsModule)
          }
        ]
      },
      {
        path: 'settings',
        children: [
          {
            path: '',
            loadChildren: () => import('../settings/settings.module').then(m => m.SettingsModule)
          }
        ]
      },
      {
        path: 'time-condition',
        children: [
          {
            path: '',
            loadChildren: () => import('../time-condition-page/time-condition-page.module').then(m => m.TimeConditionPageModule)
          },
          {
            path: ':uuid',
            loadChildren: () => import('../time-condition-page/time-condition-page.module').then(m => m.TimeConditionPageModule)
          }
        ]
      },
      {
        // Locations (destinations) — kept because the time-condition page and
        // the account menu open LocationsPage as a modal. The lazy route also
        // keeps LocationsPageModule in the AOT compilation graph.
        path: 'locations',
        children: [
          {
            path: '',
            loadChildren: () => import('../locations-page/locations-page.module').then(m => m.LocationsPageModule)
          }
        ]
      },
      {
        path: 'ivr',
        children: [
          {
            path: '',
            loadChildren: () => import('../ivr-page/ivr-page.module').then(m => m.IvrPageModule)
          }
        ]
      },
      {
        path: 'actions',
        children: [
          {
            path: '',
            loadChildren: () => import('../actions-page/actions-page.module').then(m => m.ActionsPageModule)
          }
        ]
      },
      {
        // Bots — the connectix box's own /api/admin/bots (list + edit).
        path: 'bots',
        loadChildren: () => import('../bot-page/bot-page.module').then(m => m.BotPageModule)
      },
      {
        // In-page (routed) extension edit — opened from Actions instead of a modal.
        path: 'extension/:uuid',
        loadChildren: () => import('../extension-page/extension-edit/extension-edit-routed.module').then(m => m.ExtensionEditRoutedModule)
      },
      {
        // In-page (routed) number edit/create.
        path: 'number/:uuid',
        loadChildren: () => import('../number-page/number-edit/number-edit-routed.module').then(m => m.NumberEditRoutedModule)
      },
      {
        // In-page (routed) queue edit/create.
        path: 'queue/:uuid',
        loadChildren: () => import('../queue-page/queue-edit/queue-edit-routed.module').then(m => m.QueueEditRoutedModule)
      },
      {
        // In-page (routed) routing selector — replaces the action-sheet pickers.
        path: 'routing/:didUuid',
        loadChildren: () => import('../routing-select/routing-select.module').then(m => m.RoutingSelectModule)
      },
      {
        path: 'conversation/:callUuid',
        loadChildren: () => import('../conversation-page/conversation-page.module').then(m => m.ConversationPageModule)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule { }
