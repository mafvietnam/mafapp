import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Shared AES-256-GCM encryption service.
 * Keyed by GARMIN_ENCRYPTION_KEY env var (32-byte hex — 64 chars).
 * Also reused as HMAC key for Strava OAuth state signing (dual-purpose AES + HMAC). KISS.
 */
@Injectable()
export class GarminEncryptionService implements OnModuleInit {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const keyHex = config.get<string>('GARMIN_ENCRYPTION_KEY', '');
    this.key = Buffer.from(keyHex, 'hex');
  }

  onModuleInit() {
    if (this.key.length !== 32) {
      console.warn(
        'GARMIN_ENCRYPTION_KEY not set or invalid — encryption disabled',
      );
    }
  }

  /** Check if encryption is available */
  get isConfigured(): boolean {
    return this.key.length === 32;
  }

  /**
   * Raw key bytes — used for HMAC operations (e.g. OAuth state signing).
   * @internal — do not expose via public APIs; only for trusted service consumers.
   */
  get hmacKey(): Buffer {
    return this.key;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedStr: string): string {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted data — expected iv:tag:ciphertext');
    }
    const [ivHex, authTagHex, ciphertext] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
