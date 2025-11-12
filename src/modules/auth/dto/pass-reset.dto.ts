import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class PasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  code: string;

  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @IsNotEmpty()
  @MinLength(8)
  confirmNewPassword: string;
}
