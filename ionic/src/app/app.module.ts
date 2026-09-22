import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule, ErrorHandler, APP_INITIALIZER, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule, Storage } from '@ionic/storage-angular';
import { AuthService } from './core/providers/simple-auth.service';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { FormsModule } from '@angular/forms';

import { AuthenticationService } from "./core/providers/authentication/auth";
import { MyErrorHandler } from "./core/providers/handleError"
import { HandleRequest } from './core/_base/layout/services/handleRequest.service';
import { WebsocketProvider } from "./core/providers/websocket"
import { AuthTokenStatus } from './core/providers/authentication/authTokenStatus';
import { CallService } from './core/_base/layout/services/call.service';
import { PartialsModule } from './partials/partials.module';
import { TranslateModule } from '@ngx-translate/core';
import { PipesModule } from './core/_base/layout/pipes/pipes-module';
import { InterceptService } from './core/_base/crud/intercept.service';
import { PhoneProvider } from './core/providers/phone/phone';
import { WebRTCPhone } from './core/providers/phone/webrtc-phone';
import { WebRTCChannelPhone } from './core/providers/phone/webrtc-channel-phone';
import { ApiPhone } from './core/providers/phone/api-phone';

declare var CONFIG:any;
export function AuthTokenStatusFactory(provider: AuthTokenStatus) {
  return () => provider.load();
}
@NgModule({ declarations: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        FormsModule,
        IonicModule.forRoot(),
        IonicStorageModule.forRoot(),
        ServiceWorkerModule.register('ngsw-worker.js', {
            enabled: environment.production
        }),
        PartialsModule,
        PipesModule,
        TranslateModule.forRoot()], providers: [
        Storage,
        AuthService,
        HandleRequest, AuthTokenStatus,
        AuthenticationService,
        { provide: ErrorHandler, useClass: MyErrorHandler },
        WebsocketProvider,
        CallService,
        PhoneProvider,
        WebRTCPhone,
        WebRTCChannelPhone,
        ApiPhone,
        {
            provide: APP_INITIALIZER,
            useFactory: AuthTokenStatusFactory,
            deps: [AuthTokenStatus],
            multi: true
        },
        InterceptService,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: InterceptService,
            multi: true
        },
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}
