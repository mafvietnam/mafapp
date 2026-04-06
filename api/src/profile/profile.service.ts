import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import type { UpdateProfileDto } from './profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  async upsertProfile(userId: string, dto: UpdateProfileDto) {
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
    };

    return this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}
