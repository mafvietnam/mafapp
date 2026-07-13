import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';

/**
 * Maps Multer limit errors (which are NOT HttpExceptions → otherwise surface as 500) to clean 4xx.
 * Note: a size/count violation aborts the WHOLE multipart request (batch-level), not one file.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(err: MulterError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    const status = tooBig ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST;
    const message = tooBig
      ? 'File vượt quá giới hạn 5MB'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Quá nhiều file (tối đa 8)'
        : 'Tải lên không hợp lệ';
    this.logger.warn(`Multer rejected upload: ${err.code}`);
    res.status(status).json({ statusCode: status, message });
  }
}
