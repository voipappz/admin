import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { DialpadComponent } from './dialpad/dialpad.component';
import { LogoComponent } from './logo/logo.component';

import { FormsModule } from '@angular/forms';
import { SettingsComponent } from './settings/settings.component';
import { TranslateModule } from '@ngx-translate/core';
import { FilterComponent } from './filter/filter.component';
import { DateTimePickerPopoverComponent } from './date-time-picker-popover/date-time-picker-popover.component';
import { AppHeaderComponent } from './app-header/app-header.component';
import { EntitySelectorComponent } from './entity-selector/entity-selector.component';
import { AnnouncementCreateModal } from './announcement-create/announcement-create.modal';
import { RoutingTreeComponent } from './routing-tree/routing-tree.component';

@NgModule({
  exports:[
    DialpadComponent,
    LogoComponent,
    SettingsComponent,
    FilterComponent,
    DateTimePickerPopoverComponent,
    AppHeaderComponent,
    EntitySelectorComponent,
    AnnouncementCreateModal,
    RoutingTreeComponent
  ],
  declarations: [
    DialpadComponent,
    LogoComponent,
    SettingsComponent,
    FilterComponent,
    DateTimePickerPopoverComponent,
    AppHeaderComponent,
    EntitySelectorComponent,
    AnnouncementCreateModal,
    RoutingTreeComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    TranslateModule
  ],
})
export class PartialsModule {}
