

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../simple-auth.service';
import { HandleRequest } from '../../_base/layout/services/handleRequest.service';
import { catchError, map, tap } from 'rxjs/operators';
import { Events } from '../events';
import { UserData } from '../user-data';
declare var CONFIG: any;

// localStorage key for the trusted-device token (skips OTP for 30 days, mirrors
// the server-side TTL on user_device_trust:* in Redis).
const DEVICE_TOKEN_KEY = 'va_user_device_token';

@Injectable()
export class AuthenticationService {
  constructor(
    private userData: UserData,
    private auth: AuthService,
    private handleRequest: HandleRequest,
    private events: Events,
    private http: HttpClient
  ) {}

  getDeviceToken(): string {
    return localStorage.getItem(DEVICE_TOKEN_KEY) || '';
  }

  private url(path: string): string {
    return CONFIG.API_ENDPOINT + path;
  }

  /**
   * Step 1 — submit credentials. The server either dispatches an OTP
   * ({ otp_sent: true, temp_token }) or, for a trusted device, returns the
   * authenticated session directly ({ user, token, device_token }).
   */
  requestLoginOtp(credentials): Observable<any> {
    const email = encodeURIComponent(credentials.email);
    const password = encodeURIComponent(credentials.password);
    const deviceToken = encodeURIComponent(this.getDeviceToken());
    // The app opts into OTP by sending otp=true; the server only actually
    // requires it when the user's environment profile enables login_otp_enabled.
    const url = this.url(`/auth/user_login?email=${email}&password=${password}&device_token=${deviceToken}&otp=true`);
    return this.http.post(url, null).pipe(
      tap((res: any) => {
        // Trusted device path — no OTP needed, session returned immediately.
        if (res && res.token) {
          this.completeLogin(res);
        }
      }),
      catchError((error) => this.fail(error))
    );
  }

  /**
   * Step 2 — verify the 6-digit OTP code and establish the session.
   */
  verifyOtp(tempToken: string, code: string, credentials): Observable<any> {
    const params = [
      `temp_token=${encodeURIComponent(tempToken)}`,
      `code=${encodeURIComponent(code)}`,
      `email=${encodeURIComponent(credentials.email)}`,
      `password=${encodeURIComponent(credentials.password)}`
    ].join('&');
    const url = this.url(`/auth/user/otp/verify?${params}`);
    return this.http.post(url, null).pipe(
      map((res: any) => {
        this.completeLogin(res);
        return res;
      }),
      catchError((error) => this.fail(error))
    );
  }

  /** Reset Step 1 — request a password-reset OTP for the given email. */
  forgotPassword(email: string): Observable<any> {
    const url = this.url(`/auth/user/forget_password?email=${encodeURIComponent(email)}`);
    return this.http.post(url, null).pipe(catchError((error) => this.fail(error)));
  }

  /** Reset Step 2 — verify the OTP and receive a single-use reset_token. */
  forgotPasswordVerify(tempToken: string, code: string): Observable<any> {
    const params = `temp_token=${encodeURIComponent(tempToken)}&code=${encodeURIComponent(code)}`;
    const url = this.url(`/auth/user/forget_password/verify?${params}`);
    return this.http.post(url, null).pipe(catchError((error) => this.fail(error)));
  }

  /** Reset Step 3 — set the new password using the reset_token. */
  forgotPasswordReset(resetToken: string, newPassword: string): Observable<any> {
    const params = `reset_token=${encodeURIComponent(resetToken)}&new_password=${encodeURIComponent(newPassword)}`;
    const url = this.url(`/auth/user/forget_password/reset?${params}`);
    return this.http.post(url, null).pipe(catchError((error) => this.fail(error)));
  }

  /** Persist tokens + user data after a successful authentication. */
  private completeLogin(res: any): void {
    this.auth.setToken(res.token);
    if (res.device_token) {
      localStorage.setItem(DEVICE_TOKEN_KEY, res.device_token);
    }
    // setUserData triggers the user:reload event downstream.
    this.userData.setUserData(res.user);
  }

  private fail(error: any) {
    const status = error?.status;
    const body = error?.error || error?._body || error?.statusText;
    this.handleRequest.handleErrors(body, status);
    return throwError(() => error);
  }
}
