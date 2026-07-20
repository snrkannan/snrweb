import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type AuthMode = 'login' | 'signup';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  mode: AuthMode = 'login';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  loading = false;
  showPassword = false;

  /** URL to redirect to after successful login */
  private returnUrl = '/about';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Capture the return URL from query params (set by AuthGuard)
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/about';

    // Already logged in — go straight to the destination
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  toggleMode(): void {
    this.mode = this.mode === 'login' ? 'signup' : 'login';
    this.errorMessage = '';
    this.successMessage = '';
    this.password = '';
    this.confirmPassword = '';
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter your email and password.';
      return;
    }

    if (this.mode === 'signup' && this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }

    this.loading = true;

    try {
      if (this.mode === 'login') {
        const { error } = await this.auth.signInWithEmail(this.email, this.password);
        if (error) {
          this.errorMessage = error;
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      } else {
        const { error } = await this.auth.signUpWithEmail(this.email, this.password);
        if (error) {
          this.errorMessage = error;
        } else {
          this.successMessage = 'Account created! Check your email to confirm, then sign in.';
          this.mode = 'login';
        }
      }
    } finally {
      this.loading = false;
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading = true;
    const { error } = await this.auth.signInWithGoogle();
    if (error) {
      this.errorMessage = error;
      this.loading = false;
    }
    // On success, Supabase redirects the browser — no further action needed
  }
}
