import { IsOptional, IsIn, IsBoolean } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsIn(['USER', 'COACH', 'ADMIN'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
