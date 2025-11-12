import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Length,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO (Data Transfer Object) para validar el payload de registro.
 */
export class RegisterUserDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  confirmPassword: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 30, {
    message: 'El nombre de usuario debe tener entre 3 y 30 caracteres.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  username: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;
}
