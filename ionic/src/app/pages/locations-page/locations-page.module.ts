import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UntypedFormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { LocationsPage } from './locations-page';
import { PartialsModule } from '../../partials/partials.module';
import { LocationsPageRoutingModule } from './locations-page-routing.module';
import { LocationsService } from '../../core/_base/layout/services/locations.service';
import { TimeConditionService } from '../../core/_base/layout/services/time-condition.service';
import { ExtensionService, IvrService, NumberService } from '../../core/_base/layout';
import { AddLocationPage } from './add-location/add-location'

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,ReactiveFormsModule,
    PartialsModule,
    TranslateModule.forChild(),
    LocationsPageRoutingModule
  ],
  declarations: [
    LocationsPage,
    AddLocationPage
  ],
  providers:[LocationsService,TimeConditionService,NumberService,ExtensionService,IvrService,UntypedFormBuilder]
})
export class LocationsPageModule { }
