import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { GarminEncryptionService } from '../garmin/garmin-encryption.service.js';

/** Keys that store secrets — always encrypted at rest */
const SECRET_KEYS = new Set([
  'garmin.clientSecret',
  'garmin.encryptionKey',
]);

/** All known setting keys and their defaults */
const DEFAULTS: Record<string, string> = {
  'garmin.enabled': 'false',
  'garmin.clientId': '',
  'garmin.clientSecret': '',
  'garmin.callbackUrl': 'https://api.maf.run/garmin/oauth/callback',
};

@Injectable()
export class AdminSettingsService {
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
  }

  /** Get Garmin settings with secrets masked for frontend display */
  async getGarminSettings() {
    const settings = await this.getByPrefix('garmin');
    return {
      enabled: settings['garmin.enabled'] === 'true',
      clientId: settings['garmin.clientId'] || '',
      clientSecret: this.mask(settings['garmin.clientSecret'] || ''),
      callbackUrl: settings['garmin.callbackUrl'] || DEFAULTS['garmin.callbackUrl'],
      hasClientSecret: !!(settings['garmin.clientSecret']),
    };
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
