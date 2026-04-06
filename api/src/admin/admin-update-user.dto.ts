import { IsOptional, IsIn } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsIn(['USER', 'COACH', 'ADMIN'])
  role?: string;
}
