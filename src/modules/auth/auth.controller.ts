import {
  Controller,
  Get,
  UseGuards,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { PasswordRequestDto } from './dto/pass-request.dto';
import { PasswordResetDto } from './dto/pass-reset.dto';

/**
 * Controlador de autenticación: expone endpoints para registro, recuperación
 * de contraseña y verificación de tokens/correo.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint de demostración para verificar el token JWT de Firebase.
   * Solo permite el acceso si el token es válido y está presente.
   * @Guard UseGuards(AuthGuard('firebase-jwt')) protege la ruta.
   * @returns Los datos del usuario (UID, email) verificados por Firebase.
   */
  @Get('verify-token')
  async verifyToken(@Headers('authorization') authorization: string) {
    return this.authService.verifyToken(authorization);
  }

  /**
   * Creación en Firebase -> Creación en MongoDB (con Rollback)
   * @param registerUserDto Datos del usuario (email, password, username, fullName, phone)
   * @returns Datos básicos del usuario registrado.
   */
  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return await this.authService.registerUser(registerUserDto);
  }

  /**
   * Solicita un código de recuperación de contraseña.
   * @param dto Objeto que contiene el email del usuario.
   */
  @Post('password/request')
  async requestPasswordReset(@Body() dto: PasswordRequestDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  /**
   * Resetea la contraseña usando el código enviado al email.
   * @param dto Objeto que contiene email, código y nueva contraseña.
   */
  @Post('password/reset')
  async resetPassword(@Body() dto: PasswordResetDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Verificación de correo electrónico (pendiente de implementación).
   */
  @Post('verify-email')
  async verifyEmail(@Body('email') email: string) {
    if (!email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }
    return this.authService.verifyEmail(email);
  }
}
