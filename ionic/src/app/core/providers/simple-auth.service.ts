import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

const TOKEN_KEY = 'authce9d77b308c149d5992a80073637e4d5';

/**
 * Simple AuthService replacement for ng2-ui-auth
 * Compatible with Angular 21
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private http: HttpClient) {}

  /**
   * Make login request to server
   */
  login(credentials: any, url: string): Observable<any> {
    return this.http.post(url, credentials);
  }

  /**
   * Set auth token in localStorage
   */
  setToken(token: string): void {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  /**
   * Get auth token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Remove auth token (logout)
   */
  logout(): Observable<void> {
    localStorage.removeItem(TOKEN_KEY);
    return of(undefined);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Signup - placeholder
   */
  signup(user: any): Observable<any> {
    return of(null);
  }

  /**
   * Authenticate with provider - placeholder
   */
  authenticate(provider: string): Observable<any> {
    return of(null);
  }
}
