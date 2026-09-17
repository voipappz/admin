
import { Component, OnDestroy } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

import { UserData } from '../../core/providers/user-data';
import { AuthenticationService } from "../../core/providers/authentication/auth";

import { UserOptions } from '../../interfaces/user-options';
import { MenuController, LoadingController } from '@ionic/angular';
import { Events } from '../../core/providers/events';

type LoginStep = 'login' | 'otp' | 'forgot-email' | 'forgot-otp' | 'forgot-reset';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds before a new OTP can be requested

@Component({
    selector: 'page-login',
    templateUrl: 'login.html',
    styleUrls: ['./login.scss'],
    standalone: false
})
export class LoginPage implements OnDestroy {
  login: UserOptions = { email: '', password: '' };
  customer_data;

  readonly otpLength = OTP_LENGTH;

  // Multi-step state machine: credentials -> otp, and the 3-step reset flow.
  step: LoginStep = 'login';
  errorMessage = '';
  successMessage = '';

  // OTP (shared between login-otp and forgot-otp — only one is active at a time).
  // Bound to <ion-input-otp> which handles focus/paste/auto-advance natively.
  otpCode = '';
  tempToken = '';
  resendSeconds = 0;
  private resendTimer: any = null;

  // Forgot password
  forgotEmail = '';
  forgotTempToken = '';
  forgotResetToken = '';
  newPassword = '';
  confirmPassword = '';

  constructor(
    public userData: UserData,
    public router: Router,
    public menuCtrl: MenuController,
    private authService: AuthenticationService,
    private events: Events,
    private loadingCtrl: LoadingController
  ) { }

  ionViewWillEnter() {
    this.menuCtrl.enable(false);
    this.resetState();
    this.customer_data = this.userData.getCustomerData();
  }

  ngOnDestroy() {
    this.clearResendTimer();
  }

  // --- derived view state ----------------------------------------------------
  get isOtpStep(): boolean { return this.step === 'otp' || this.step === 'forgot-otp'; }
  get otpComplete(): boolean { return (this.otpCode || '').length === OTP_LENGTH; }
  get otpEmail(): string { return this.step === 'forgot-otp' ? this.forgotEmail : this.login.email; }

  private resetState() {
    this.step = 'login';
    this.login = { email: '', password: '' };
    this.otpCode = '';
    this.tempToken = '';
    this.forgotEmail = '';
    this.forgotTempToken = '';
    this.forgotResetToken = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.clearResendTimer();
  }

  private async withLoading<T>(work: () => Promise<T>): Promise<T> {
    const loading = await this.loadingCtrl.create({ message: '' });
    await loading.present();
    try {
      return await work();
    } finally {
      loading.dismiss();
    }
  }

  private extractError(err: any): string {
    const body = err?.error || err;
    return body?.message || body?.error || body?.id || 'Something went wrong. Please try again.';
  }

  // --- OTP handling (ion-input-otp) ------------------------------------------
  private enterOtpStep(step: LoginStep) {
    this.otpCode = '';
    this.step = step;
    this.startResendTimer();
  }

  // ionComplete fires once all digits are entered (typed or pasted).
  onOtpComplete(ev: any) {
    this.otpCode = (ev?.detail?.value ?? this.otpCode) + '';
    this.submitActiveOtp();
  }

  submitActiveOtp() {
    if (this.step === 'otp') { this.onVerifyOtp(); }
    else if (this.step === 'forgot-otp') { this.onForgotOtp(); }
  }

  // --- resend ----------------------------------------------------------------
  private clearResendTimer() {
    if (this.resendTimer) { clearInterval(this.resendTimer); this.resendTimer = null; }
    this.resendSeconds = 0;
  }

  private startResendTimer(sec = RESEND_COOLDOWN) {
    this.clearResendTimer();
    this.resendSeconds = sec;
    this.resendTimer = setInterval(() => {
      this.resendSeconds--;
      if (this.resendSeconds <= 0) { this.clearResendTimer(); }
    }, 1000);
  }

  async resendOtp() {
    if (this.resendSeconds > 0) { return; }
    this.errorMessage = '';
    this.successMessage = '';
    this.otpCode = '';
    await this.withLoading(async () => {
      try {
        if (this.step === 'otp') {
          const res: any = await this.authService.requestLoginOtp(this.login).toPromise();
          if (res?.temp_token) { this.tempToken = res.temp_token; }
        } else if (this.step === 'forgot-otp') {
          const res: any = await this.authService.forgotPassword(this.forgotEmail).toPromise();
          if (res?.temp_token) { this.forgotTempToken = res.temp_token; }
        }
        this.successMessage = 'A new code has been sent.';
        this.startResendTimer();
      } catch (err) {
        this.errorMessage = this.extractError(err);
      }
    });
  }

  // --- Step 1: credentials ---------------------------------------------------
  async onLogin(form: NgForm) {
    this.errorMessage = '';
    await this.withLoading(async () => {
      try {
        const res: any = await this.authService.requestLoginOtp(this.login).toPromise();
        if (res && res.token) {
          this.finishLogin();
        } else if (res && res.otp_sent && res.temp_token) {
          this.tempToken = res.temp_token;
          this.enterOtpStep('otp');
        } else {
          this.errorMessage = 'Unexpected response. Please try again.';
        }
      } catch (err) {
        this.errorMessage = this.extractError(err);
      }
    });
  }

  // --- Step 2: OTP verification ----------------------------------------------
  async onVerifyOtp() {
    if (!this.otpComplete) {
      this.errorMessage = 'Please enter the 6-digit code';
      return;
    }
    this.errorMessage = '';
    await this.withLoading(async () => {
      try {
        await this.authService.verifyOtp(this.tempToken, this.otpCode, this.login).toPromise();
        this.finishLogin();
      } catch (err) {
        this.errorMessage = this.extractError(err);
        this.otpCode = '';
      }
    });
  }

  private finishLogin() {
    this.events.publish('app-login');
    this.resetState();
    this.router.navigateByUrl('app/actions');
  }

  // --- Forgot password flow --------------------------------------------------
  openForgot() {
    this.errorMessage = '';
    this.successMessage = '';
    this.forgotEmail = this.login.email || '';
    this.step = 'forgot-email';
  }

  async onForgotEmail() {
    if (!this.forgotEmail) {
      this.errorMessage = 'Email is required';
      return;
    }
    this.errorMessage = '';
    await this.withLoading(async () => {
      try {
        const res: any = await this.authService.forgotPassword(this.forgotEmail).toPromise();
        this.forgotTempToken = (res && res.temp_token) || '';
        this.enterOtpStep('forgot-otp');
      } catch (err) {
        this.errorMessage = this.extractError(err);
      }
    });
  }

  async onForgotOtp() {
    if (!this.otpComplete) {
      this.errorMessage = 'Please enter the 6-digit code';
      return;
    }
    this.errorMessage = '';
    await this.withLoading(async () => {
      try {
        const res: any = await this.authService.forgotPasswordVerify(this.forgotTempToken, this.otpCode).toPromise();
        this.forgotResetToken = res && res.reset_token;
        this.newPassword = '';
        this.confirmPassword = '';
        this.clearResendTimer();
        this.step = 'forgot-reset';
      } catch (err) {
        this.errorMessage = this.extractError(err);
        this.otpCode = '';
      }
    });
  }

  async onForgotReset() {
    if (!this.newPassword || this.newPassword.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }
    this.errorMessage = '';
    await this.withLoading(async () => {
      try {
        await this.authService.forgotPasswordReset(this.forgotResetToken, this.newPassword).toPromise();
        this.successMessage = 'Password reset successfully! You can now sign in.';
        setTimeout(() => this.backToLogin(), 2500);
      } catch (err) {
        this.errorMessage = this.extractError(err);
      }
    });
  }

  backToLogin() {
    const email = this.login.email;
    this.resetState();
    this.login.email = email;
  }
}
