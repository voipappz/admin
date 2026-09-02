import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuardService } from './auth/auth.guard';
import { LoginComponent } from './modules/popup/pages/login/login.component';
import { MainComponent } from './modules/popup/pages/main/main.component';

const routes: Routes = [
  // The bare URL. The packed extension always opens `index.html?#/main`, so
  // nothing ever hit `#/` and it rendered a blank page — which is what you get
  // when you open the app in a normal browser (`make chrome-serve`) and the
  // reason this exists. The guard bounces to `login` when there is no session,
  // so this is the front door in both modes.
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'main'
  },
  {
    path: 'main',
    pathMatch: 'full',
    component:MainComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'login',
    pathMatch: 'full',
    component:LoginComponent
  }
  // {
  //   path: 'tab',
  //   pathMatch: 'full',
  //   loadChildren: () => import('./modules/tab/tab.module').then(m => m.TabModule)
  // },
  // {
  //   path: 'options',
  //   pathMatch: 'full',
  //   loadChildren: () => import('./modules/options/options.module').then(m => m.OptionsModule)
  // }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true, relativeLinkResolution: 'legacy' })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
