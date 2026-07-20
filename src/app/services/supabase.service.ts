import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient | null = null;

  /** True only when valid credentials have been supplied in environment.ts */
  readonly isConfigured: boolean;

  constructor() {
    const { url, anonKey } = environment.supabase;
    const configured =
      !!url &&
      !!anonKey &&
      url !== 'YOUR_SUPABASE_URL' &&
      anonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
      (url.startsWith('https://') || url.startsWith('http://'));

    this.isConfigured = configured;

    if (configured) {
      this.client = createClient(url, anonKey);
    } else {
      console.info(
        '[SupabaseService] Supabase credentials not configured — running in offline/local mode. ' +
        'Set environment.supabase.url and environment.supabase.anonKey to enable cloud sync.'
      );
    }
  }
}
