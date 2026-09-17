import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IvrPage } from './ivr-page';

const routes: Routes = [
    {
        path: '',
        component: IvrPage
    },
    {
        path: ':uuid',
        loadChildren: () => import('./ivr-detail/ivr-detail.module').then(m => m.IvrDetailModule)
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class IvrPageRoutingModule {}
