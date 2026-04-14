/**
 * HTTP client for Soluciones Legales Ya legal marketplace backend.
 *
 * PRIVILEGE BOUNDARY: This client never transmits or requests message content,
 * matter details, or other privileged information. All such content flows
 * directly between the user's browser and Soluciones via short-lived
 * authenticated URLs (see open_composer tool).
 *
 * Handles token refresh automatically on 401.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_BASE_URL = 'https://solucioneslegalesya.com';
const CONFIG_PATH = join(homedir(), '.legal', 'config.json');
const CLIENT_VERSION = '0.1.0';

export class ApiClient {
  constructor(token, baseUrl) {
    this.token = token || process.env.LEGAL_API_KEY || null;
    this.baseUrl = baseUrl || process.env.LEGAL_API_URL || DEFAULT_BASE_URL;
    this._refreshing = null;
  }

  async request(method, path, { body, query, requireAuth = false, isRetry = false } = {}) {
    const url = new URL(`${this.baseUrl}/api/mcp${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client': 'legal-mcp',
      'X-Client-Version': CLIENT_VERSION,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else if (requireAuth) {
      const err = new Error(
        'Authentication required. Run `npx legal install` to sign in.'
      );
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }

    // Retry up to 3 times on 5xx with exponential backoff
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(30_000),
        });
      } catch (e) {
        lastErr = e;
        if (attempt < 2) {
          await sleep(250 * Math.pow(2, attempt));
          continue;
        }
        throw e;
      }

      // Auto-refresh on 401, retry once
      if (res.status === 401 && !isRetry && this.token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request(method, path, { body, query, requireAuth, isRetry: true });
        }
      }

      if (res.status >= 500 && attempt < 2) {
        await sleep(250 * Math.pow(2, attempt));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(
          `API ${method} ${path} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
        );
        err.status = res.status;
        err.body = text;
        throw err;
      }

      // 204 No Content
      if (res.status === 204) return null;

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return res.json();
      }
      return res.text();
    }
    throw lastErr || new Error('Request failed after retries');
  }

  async refreshToken() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = this._doRefresh();
    try {
      return await this._refreshing;
    } finally {
      this._refreshing = null;
    }
  }

  async _doRefresh() {
    try {
      if (!existsSync(CONFIG_PATH)) return false;
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      if (!config.refreshToken) return false;

      const res = await fetch(`${this.baseUrl}/api/mcp/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client': 'legal-mcp',
          'X-Client-Version': CLIENT_VERSION,
        },
        body: JSON.stringify({ refreshToken: config.refreshToken }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (!data.accessToken) return false;

      this.token = data.accessToken;

      config.accessToken = data.accessToken;
      if (data.refreshToken) config.refreshToken = data.refreshToken;
      config.tokenRefreshedAt = new Date().toISOString();
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });

      return true;
    } catch {
      return false;
    }
  }

  // ---- Discovery (no auth required) ----

  searchProviders(params) {
    return this.request('GET', '/providers', { query: params });
  }

  getProvider(providerId) {
    return this.request('GET', `/providers/${encodeURIComponent(providerId)}`);
  }

  searchListings(params) {
    return this.request('GET', '/listings', { query: params });
  }

  getListing(listingId) {
    return this.request('GET', `/listings/${encodeURIComponent(listingId)}`);
  }

  getJurisdiction(country, params) {
    return this.request('GET', `/jurisdictions/${encodeURIComponent(country)}`, { query: params });
  }

  getDisclosures(country, practiceArea) {
    return this.request('GET', '/disclosures', {
      query: { country, practice_area: practiceArea },
    });
  }

  // ---- Engagements (auth required) ----
  // None of these accept or return privileged content (message bodies,
  // matter descriptions, intake data). See /api/mcp spec.

  createEngagement({ listingId, locale }) {
    return this.request('POST', '/engagements', {
      body: { listing_id: listingId, locale },
      requireAuth: true,
    });
  }

  listEngagements() {
    return this.request('GET', '/engagements', { requireAuth: true });
  }

  getEngagement(engagementId) {
    return this.request('GET', `/engagements/${encodeURIComponent(engagementId)}`, {
      requireAuth: true,
    });
  }

  createAccessUrl(engagementId, purpose = 'composer') {
    return this.request('POST', `/engagements/${encodeURIComponent(engagementId)}/access-url`, {
      body: { purpose },
      requireAuth: true,
    });
  }

  engagementAction(engagementId, action, reason) {
    return this.request('POST', `/engagements/${encodeURIComponent(engagementId)}/actions`, {
      body: { action, reason },
      requireAuth: true,
    });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
