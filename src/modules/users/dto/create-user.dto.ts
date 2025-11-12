import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateUserDto {
  /**
   * Firebase UID del usuario — identificador principal.
   */
  @IsNotEmpty()
  @IsString()
  firebaseUid: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
