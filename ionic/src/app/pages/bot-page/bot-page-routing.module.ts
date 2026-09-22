import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BotPage } from './bot-page';
import { BotEditPage } from './bot-edit/bot-edit';

const routes: Routes = [
    {
        path: '',
        component: BotPage
    },
    {
        // In-page (routed) bot edit/create — ':uuid' of 'new' creates.
        path: ':uuid',
        component: BotEditPage
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class BotPageRoutingModule {}
