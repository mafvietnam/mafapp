import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import type { UpdateProfileDto } from './profile.dto.js';

const HEALTH_CONSENT_REQUIRED_MSG =
  'Cần đồng ý trước khi lưu thông tin sàng lọc sức khỏe.';
const HEALTH_CLEARANCE_REQUIRED_MSG =
  'Bạn có tình trạng sức khỏe cần lưu ý. Hãy tham khảo bác sĩ trước khi tăng khối lượng tập vượt mức Sức khỏe (HEALTH). (Chương 6)';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * RED TEAM FIX #8: table/column-absent guard — soft-fails to null during the
   * DB-first migration rollout gap instead of a 500 (mirrors checkin.service.ts).
   * Never logs profile content — only userId + error message (FIX #11).
   */
  async getProfile(userId: string) {
    try {
      return await this.prisma.userProfile.findUnique({ where: { userId } });
    } catch (err: unknown) {
      this.logger.error(
        `Profile fetch failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  /**
   * Full-replace PUT semantics (matches every other field on UpdateProfileDto):
   * the incoming `healthConditions`/`healthConsent`/`healthClearanceConfirmed`
   * ARE this write's authoritative state, not an incremental patch. Consent and
   * clearance timestamps are stamped once (first `true`) and preserved across
   * subsequent writes that keep sending `true` — never re-derived from a bare
   * client-supplied timestamp (FIX #10, #11).
   */
  async upsertProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.getProfile(userId);
    const healthConditions = dto.healthConditions ?? [];
    const consentGiven = dto.healthConsent === true;
    const clearanceConfirmed = dto.healthClearanceConfirmed === true;

    // RED TEAM FIX #11 — consent gate: screening data is only ever persisted
    // together with consent. No consent, no store (not silently stripped —
    // an explicit, auditable rejection).
    if (healthConditions.length > 0 && !consentGiven) {
      throw new BadRequestException(HEALTH_CONSENT_REQUIRED_MSG);
    }

    // RED TEAM FIX #10 — server-enforced commitment gate: any flag + not
    // cleared THIS write => elevated commitment (beyond HEALTH) rejected.
    // HEALTH commitment itself is always allowed regardless of clearance.
    if (
      healthConditions.length > 0 &&
      !clearanceConfirmed &&
      dto.commitment !== 'HEALTH'
    ) {
      throw new BadRequestException(HEALTH_CLEARANCE_REQUIRED_MSG);
    }

    const healthConsentAt = consentGiven
      ? (existing?.healthConsentAt ?? new Date())
      : null;
    const clearedAt = clearanceConfirmed
      ? (existing?.clearedAt ?? new Date())
      : null;
    const clearedBy = clearanceConfirmed
      ? (existing?.clearedBy ?? 'self-attested')
      : null;
    // Withdrawing consent purges any previously-stored conditions (erasure —
    // FIX #11); otherwise persist exactly the whitelisted codes sent (lossless
    // round-trip — FIX #9, no strip-on-read).
    const persistedHealthConditions = consentGiven ? healthConditions : [];
    const healthScreenedAt =
      dto.healthConditions !== undefined || dto.healthConsent !== undefined
        ? new Date()
        : (existing?.healthScreenedAt ?? null);

    const data = {
      age: dto.age,
      height: dto.height,
      weight: dto.weight,
      experience: dto.experience,
      commitment: dto.commitment,
      isRecovering: dto.isRecovering,
      isMedicatedOrInjured: dto.isMedicatedOrInjured,
      isMedicalClearanceConfirmed: dto.isMedicalClearanceConfirmed,
      previousMonthPace: dto.previousMonthPace ?? null,
      isProbation: dto.isProbation ?? false,
      probationStartDate: dto.probationStartDate
        ? new Date(dto.probationStartDate)
        : null,
      lastLongRunDuration: dto.lastLongRunDuration ?? null,
      lastLongRunHeartRate: dto.lastLongRunHeartRate ?? null,
      lastLongRunFeeling: dto.lastLongRunFeeling ?? null,
      healthConditions: persistedHealthConditions,
      healthScreenedAt,
      healthConsentAt,
      clearedAt,
      clearedBy,
    };

    try {
      return await this.prisma.userProfile.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    } catch (err: unknown) {
      // RED TEAM FIX #11: never log profile content (esp. health conditions) —
      // only userId + error message.
      this.logger.error(
        `Profile upsert failed for user ${userId}: ${this.errMessage(err)}`,
      );
      throw err;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
