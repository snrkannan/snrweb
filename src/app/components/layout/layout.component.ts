import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
  /** True when the current route is the standalone login page */
  readonly isLoginPage$: Observable<boolean>;

  constructor(private router: Router) {
    this.isLoginPage$ = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e: any) => e.urlAfterRedirects === '/login' || e.urlAfterRedirects.startsWith('/login?')),
      startWith(
        this.router.url === '/login' || this.router.url.startsWith('/login?')
      )
    );
  }
}
