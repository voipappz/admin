import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { LoginPage } from './login';
import { LoginPageRoutingModule } from './login-routing.module';
import { AuthenticationService } from "../../core/providers/authentication/auth";
import { PartialsModule } from '../../partials/partials.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LoginPageRoutingModule,
    PartialsModule,
    TranslateModule.forChild(),
  ],
  declarations: [
    LoginPage,
  ],
  providers:[AuthenticationService]
})
export class LoginModule { }
