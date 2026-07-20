import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user$ = new BehaviorSubject<User | null>(null);
  readonly user$: Observable<User | null> = this._user$.asObservable();

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {
    if (!this.supabase.isConfigured || !this.supabase.client) {
      // Running without Supabase — stay as guest
      return;
    }

    // Restore session on app load
    this.supabase.client.auth.getSession().then(({ data }) => {
      this._user$.next(data.session?.user ?? null);
    });

    // Listen for auth state changes (login, logout, token refresh)
    this.supabase.client.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        this._user$.next(session?.user ?? null);
        if (event === 'SIGNED_OUT') {
          this.router.navigate(['/login']);
        }
      }
    );
  }

  get currentUser(): User | null {
    return this._user$.value;
  }

  isLoggedIn(): boolean {
    return !!this._user$.value;
  }

  /** Sign in with email + password */
  async signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
    if (!this.supabase.client) return { error: 'Supabase not configured.' };
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  /** Sign up with email + password */
  async signUpWithEmail(email: string, password: string): Promise<{ error: string | null }> {
    if (!this.supabase.client) return { error: 'Supabase not configured.' };
    const { error } = await this.supabase.client.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  /** Sign in with Google OAuth */
  async signInWithGoogle(): Promise<{ error: string | null }> {
    if (!this.supabase.client) return { error: 'Supabase not configured.' };
    const { error } = await this.supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    return { error: error?.message ?? null };
  }

  /** Sign out */
  async signOut(): Promise<void> {
    if (!this.supabase.client) return;
    await this.supabase.client.auth.signOut();
  }

  /** Get display name from user metadata or email */
  getDisplayName(): string {
    const user = this._user$.value;
    if (!user) return '';
    return user.user_metadata?.['full_name'] ?? user.email ?? '';
  }

  /** Get user initials for avatar */
  getInitials(): string {
    const name = this.getDisplayName();
    if (!name) return '?';
    const parts = name.split(/[\s@]/);
    return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }
}
