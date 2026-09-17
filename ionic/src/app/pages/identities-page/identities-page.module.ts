import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { IdentitiesPage } from './identities-page';
import { PartialsModule } from '../../partials/partials.module';
import { IdentitiesPageRoutingModule } from './identities-page-routing.module';
import { IdentitiesService } from '../../core/_base/layout/services/identities.service';
import { DidService } from '../../core/_base/layout';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    PartialsModule,
    TranslateModule.forChild(),
    IdentitiesPageRoutingModule
  ],
  declarations: [
    IdentitiesPage,
  ],
  providers:[IdentitiesService,DidService]
})
export class IdentitiesPageModule { }
