import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class StravaSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^\d+$/, { message: 'clientId must be numeric' })
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookVerifyToken?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
