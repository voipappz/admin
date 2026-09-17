import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SettingsComponent } from '../../partials/settings/settings.component';
import { SchedulePage } from '../schedule/schedule';
import { TabsPage } from './tabs-page';
// import { SchedulePage } from '../schedule/schedule';
// import { ChatRoomListPage } from '../chat-room-list/chat-room-list';


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
        path: 'dashboard',
        children: [
          {
            path: '',
            loadChildren: () => import('../dashboard/dashboard.module').then(m => m.DashboardModule)
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
        path: 'identities',
        children: [
          {
            path: '',
            loadChildren: () => import('../identities-page/identities-page.module').then(m => m.IdentitiesPageModule)
          }
        ]
      },
      {
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
        path: 'notifications',
        children: [
          {
            path: '',
            loadChildren: () => import('../notifications-page/notifications-page.module').then(m => m.NotificationsPageModule)
          }
        ]
      },
      {
        path: 'syslog',
        children: [
          {
            path: '',
            loadChildren: () => import('../syslog-page/syslog-page.module').then(m => m.SyslogPageModule)
          }
        ]
      },
      {
        path: 'conference',
        children: [
          {
            path: '',
            loadChildren: () => import('../conference-page/conference-page.module').then(m => m.ConferencePageModule)
          }
        ]
      },
      {
        path: 'reports',
        children: [
          {
            path: '',
            loadChildren: () => import('../reports-page/reports-page.module').then(m => m.ReportsPageModule)
          }
        ]
      },
      {
        path: 'reports/:uuid',
        loadChildren: () => import('../reports-page/report-run/report-run.module').then(m => m.ReportRunPageModule)
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
      },
      // {
      //   path: 'schedule',
      //   children: [
      //     {
      //       path: '',
      //       component: SchedulePage,
      //     },
      //     {
      //       path: 'session/:sessionId',
      //       loadChildren: () => import('../session-detail/session-detail.module').then(m => m.SessionDetailModule)
      //     }
      //   ]
      // },
      // {
      //   path: 'contacts',
      //   children: [
      //     {
      //       path: '',
      //       loadChildren: () => import('../contact-list/contact-list.module').then(m => m.ContactListModule)
      //     },
      //     {
      //       path: 'session/:sessionId',
      //       loadChildren: () => import('../session-detail/session-detail.module').then(m => m.SessionDetailModule)
      //     },
      //     {
      //       path: 'contact-details/:contactId',
      //       loadChildren: () => import('../contact-detail/contact-detail.module').then(m => m.ContactDetailModule)
      //     }
      //   ]
      // },
      // {
      //   path: 'chat',
      //   children: [
      //     {
      //       path: '',
      //       component: ChatRoomListPage,
      //     },
      //     {
      //       path: 'room/:roomId',
      //       loadChildren: () => import('../chat-room/chat-room.module').then(m => m.ChatRoomModule)
      //     }
      //   ]
      // },
      // {
      //   path: 'map',
      //   children: [
      //     {
      //       path: '',
      //       loadChildren: () => import('../map/map.module').then(m => m.MapModule)
      //     }
      //   ]
      // },
      // {
      //   path: 'about',
      //   children: [
      //     {
      //       path: '',
      //       loadChildren: () => import('../about/about.module').then(m => m.AboutModule)
      //     }
      //   ]
      // },
      // {
      //   path: '',
      //   redirectTo: '/app/tabs/contacts',
      //   pathMatch: 'full'
      // }
      
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule { }

