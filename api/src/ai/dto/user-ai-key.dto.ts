import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { AiProvider } from '@prisma/client';

/** PUT /ai/key body — sets/replaces the caller's BYOK key. */
export class UserAiKeyDto {
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @IsString()
  @MinLength(10, { message: 'key is too short to be a valid API key' })
  @MaxLength(300)
  key!: string;
}
