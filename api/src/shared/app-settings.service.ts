import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';

/** Keys that store secrets — always encrypted at rest */
const SECRET_KEYS = new Set([
  'garmin.clientSecret',
  'garmin.encryptionKey',
  'strava.clientSecret',
  'strava.webhookVerifyToken',
  'ai.openRouterKey',
]);

/** All known setting keys and their defaults */
const DEFAULTS: Record<string, string> = {
  'garmin.enabled': 'false',
  'garmin.clientId': '',
  'garmin.clientSecret': '',
  'garmin.callbackUrl': 'https://api.maf.run/garmin/oauth/callback',
  'strava.enabled': 'false',
  'strava.clientId': '',
  'strava.clientSecret': '',
  'strava.webhookVerifyToken': '',
  'strava.maxAthletes': '10',
  'strava.webhookSubscriptionId': '',
  // Phase 5 — ships OFF (zero behavior change from Phase 4's default-disabled coaching AI
  // until an admin explicitly opts in via PUT /admin/ai/settings).
  'ai.enabled': 'false',
  'ai.openRouterKey': '',
  // Cheap OpenRouter model id — admin-configurable; see getAiRuntimeConfig().
  'ai.defaultModel': 'google/gemini-2.0-flash-001',
  'ai.defaultMonthlyQuota': '30',
};

export interface StravaRuntimeConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  webhookVerifyToken: string;
  /** Max concurrent Strava authorizations the app is allowed to hold. 0 = pause new connections. */
  maxAthletes: number;
  /** Trusted Strava push-subscription id — gates the destructive athlete-deauth webhook branch. Empty until first (re)subscribe. */
  webhookSubscriptionId: string;
}

export interface AiRuntimeConfig {
  /** Master switch for the SYSTEM tier only — BYOK keys work regardless (see AiProviderService). */
  enabled: boolean;
  openRouterKey: string;
  defaultModel: string;
  /** Free system-tier generations per user per calendar month (server ICT). */
  defaultMonthlyQuota: number;
}

@Injectable()
export class AppSettingsService {
  /** 30-second TTL cache for Strava runtime config — invalidated on setMany writes to strava.* keys */
  private stravaCfgCache: {
    data: StravaRuntimeConfig;
    expiresAt: number;
  } | null = null;

  /** 30-second TTL cache for AI runtime config — invalidated on setMany writes to ai.* keys */
  private aiCfgCache: {
    data: AiRuntimeConfig;
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: GarminEncryptionService,
  ) {}

  /** Get all settings for a given prefix (e.g. "garmin") */
  async getByPrefix(prefix: string): Promise<Record<string, string>> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { startsWith: `${prefix}.` } },
    });

    const result: Record<string, string> = {};

    // Start with defaults
    for (const [key, def] of Object.entries(DEFAULTS)) {
      if (key.startsWith(`${prefix}.`)) {
        result[key] = def;
      }
    }

    // Override with stored values (decrypt secrets)
    for (const row of rows) {
      result[row.key] = SECRET_KEYS.has(row.key)
        ? this.safeDecrypt(row.value)
        : row.value;
    }

    return result;
  }

  /** Get a single setting value */
  async get(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (!row) return DEFAULTS[key] ?? null;
    return SECRET_KEYS.has(key) ? this.safeDecrypt(row.value) : row.value;
  }

  /** Set multiple settings at once (encrypts secrets automatically) */
  async setMany(settings: Record<string, string>): Promise<void> {
    const ops = Object.entries(settings).map(([key, value]) => {
      const stored = SECRET_KEYS.has(key)
        ? this.encryption.encrypt(value)
        : value;
      return this.prisma.appSetting.upsert({
        where: { key },
        update: { value: stored },
        create: { key, value: stored },
      });
    });
    await this.prisma.$transaction(ops);

    // Invalidate Strava runtime config cache if any strava.* key was written
    if (Object.keys(settings).some((k) => k.startsWith('strava.'))) {
      this.stravaCfgCache = null;
    }
    // Invalidate AI runtime config cache if any ai.* key was written
    if (Object.keys(settings).some((k) => k.startsWith('ai.'))) {
      this.aiCfgCache = null;
    }
  }

  /** Get Garmin settings with secrets masked for frontend display */
  async getGarminSettings() {
    const settings = await this.getByPrefix('garmin');
    return {
      enabled: settings['garmin.enabled'] === 'true',
      clientId: settings['garmin.clientId'] || '',
      clientSecret: this.mask(settings['garmin.clientSecret'] || ''),
      callbackUrl:
        settings['garmin.callbackUrl'] || DEFAULTS['garmin.callbackUrl'],
      hasClientSecret: !!settings['garmin.clientSecret'],
    };
  }

  /** Get Strava settings with secrets masked for frontend display */
  async getStravaSettings() {
    const s = await this.getByPrefix('strava');
    return {
      enabled: s['strava.enabled'] === 'true',
      clientId: s['strava.clientId'] || '',
      clientSecret: this.mask(s['strava.clientSecret'] || ''),
      hasClientSecret: !!s['strava.clientSecret'],
      hasWebhookVerifyToken: !!s['strava.webhookVerifyToken'],
      webhookCallbackUrl: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/strava/webhook`,
    };
  }

  /**
   * Raw decrypted Strava config for runtime service consumers (auth, webhook, token).
   * Falls back to env vars when DB has no value.
   * Cached with 30s TTL — admin save propagates within 30s, not instantly.
   * @internal — not exposed via public API endpoints; use getStravaSettings() for masked responses.
   */
  async getStravaRuntimeConfig(): Promise<StravaRuntimeConfig> {
    const now = Date.now();
    if (this.stravaCfgCache && this.stravaCfgCache.expiresAt > now) {
      return this.stravaCfgCache.data;
    }

    const s = await this.getByPrefix('strava');
    // 0 is a valid cap (pause new connections) — only fall back to the default 10 on NaN/negative.
    const parsedMax = parseInt(s['strava.maxAthletes'] ?? '', 10);
    const data: StravaRuntimeConfig = {
      enabled: s['strava.enabled'] === 'true',
      clientId: s['strava.clientId'] || process.env.STRAVA_CLIENT_ID || '',
      clientSecret:
        s['strava.clientSecret'] || process.env.STRAVA_CLIENT_SECRET || '',
      webhookVerifyToken:
        s['strava.webhookVerifyToken'] ||
        process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ||
        '',
      maxAthletes:
        Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : 10,
      webhookSubscriptionId: s['strava.webhookSubscriptionId'] || '',
    };

    this.stravaCfgCache = { data, expiresAt: now + 30_000 };
    return data;
  }

  /** Get AI settings with secrets masked for frontend display (admin AI settings page) */
  async getAiSettings() {
    const s = await this.getByPrefix('ai');
    const parsedQuota = parseInt(s['ai.defaultMonthlyQuota'] ?? '', 10);
    return {
      enabled: s['ai.enabled'] === 'true',
      openRouterKey: this.mask(s['ai.openRouterKey'] || ''),
      hasOpenRouterKey: !!s['ai.openRouterKey'],
      defaultModel: s['ai.defaultModel'] || DEFAULTS['ai.defaultModel'],
      defaultMonthlyQuota:
        Number.isFinite(parsedQuota) && parsedQuota >= 0
          ? parsedQuota
          : Number(DEFAULTS['ai.defaultMonthlyQuota']),
    };
  }

  /**
   * Raw decrypted AI config for runtime service consumers (AiProviderService).
   * Cached with 30s TTL — admin save propagates within 30s, not instantly.
   * @internal — not exposed via public API endpoints; use getAiSettings() for masked responses.
   */
  async getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
    const now = Date.now();
    if (this.aiCfgCache && this.aiCfgCache.expiresAt > now) {
      return this.aiCfgCache.data;
    }

    const s = await this.getByPrefix('ai');
    const parsedQuota = parseInt(s['ai.defaultMonthlyQuota'] ?? '', 10);
    const data: AiRuntimeConfig = {
      enabled: s['ai.enabled'] === 'true',
      openRouterKey: s['ai.openRouterKey'] || '',
      defaultModel: s['ai.defaultModel'] || DEFAULTS['ai.defaultModel'],
      defaultMonthlyQuota:
        Number.isFinite(parsedQuota) && parsedQuota >= 0
          ? parsedQuota
          : Number(DEFAULTS['ai.defaultMonthlyQuota']),
    };

    this.aiCfgCache = { data, expiresAt: now + 30_000 };
    return data;
  }

  /** Mask a secret for display: show first 4 and last 4 chars */
  private mask(value: string): string {
    if (!value || value.length < 10) return value ? '••••••••' : '';
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  }

  /** Decrypt, return empty string if fails (e.g. key changed) */
  private safeDecrypt(encrypted: string): string {
    try {
      return this.encryption.decrypt(encrypted);
    } catch {
      return '';
    }
  }
}
