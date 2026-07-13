import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Req,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { StravaUploadService } from './strava-upload.service.js';
import { MulterExceptionFilter } from './multer-exception.filter.js';
import {
  InvalidTracklogError,
  UnsupportedTracklogError,
} from './tracklog/tracklog-types.js';

const MAX_FILES = 8; // RT-H3: lower than 20 to bound memory/parse cost
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadResultItem {
  filename: string;
  ok: boolean;
  id?: string;
  duplicate?: boolean;
  error?: string;
}

/** Manual tracklog upload — bypasses the 10-athlete OAuth slot cap. Kept separate from
 *  StravaController to stay <200 LOC. Throttled + Multer-limited + per-file isolated. */
@Controller('strava')
@UseFilters(MulterExceptionFilter)
export class StravaUploadController {
  private readonly logger = new Logger(StravaUploadController.name);

  constructor(private readonly uploadService: StravaUploadService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES, fields: 4, parts: 16 },
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = (req.user as { id: string }).id;
    if (!files?.length) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    // Sequential — never Promise.all a set of synchronous XML parses (event-loop DoS, RT-H3).
    const results: UploadResultItem[] = [];
    for (const file of files) {
      results.push(await this.processOne(userId, file));
    }
    const imported = results.filter((r) => r.ok).length;
    return { results, imported, failed: results.length - imported };
  }

  /** Parse+ingest one file; failures are isolated to that file (never fail the batch). */
  private async processOne(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UploadResultItem> {
    const name = file.originalname;
    const lower = name.toLowerCase();
    if (!lower.endsWith('.gpx') && !lower.endsWith('.tcx')) {
      return { filename: name, ok: false, error: 'Chỉ hỗ trợ file .gpx hoặc .tcx' };
    }
    try {
      const { id, duplicate } = await this.uploadService.ingest(
        userId,
        file.buffer,
        name,
      );
      return { filename: name, ok: true, id, duplicate };
    } catch (err: unknown) {
      // Only surface known, safe messages — never echo raw file content / internals.
      const safe =
        err instanceof InvalidTracklogError ||
        err instanceof UnsupportedTracklogError;
      const message = safe ? (err as Error).message : 'Không thể xử lý file';
      this.logger.warn(`Upload failed ${name}: ${(err as Error)?.message ?? err}`);
      return { filename: name, ok: false, error: message };
    }
  }
}
