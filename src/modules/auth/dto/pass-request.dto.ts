import { IsEmail, IsNotEmpty } from 'class-validator';

export class PasswordRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
