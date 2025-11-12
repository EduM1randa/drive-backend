import {
  Controller,
  Get,
  UseGuards,
  Req,
  Post,
  Body,
  ValidationPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../firebase/firebase-jwt.strategy';
import { Request } from 'express';
import { RegisterUserDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { PasswordRequestDto } from './dto/pass-request.dto';
import { PasswordResetDto } from './dto/pass-reset.dto';

// Define una interfaz para el Request modificado que incluye el usuario autenticado
interface CustomRequest extends Request {
  user: AuthUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint de demostración para verificar el token JWT de Firebase.
   * Solo permite el acceso si el token es válido y está presente.
   * * @Guard UseGuards(AuthGuard('firebase-jwt')) protege la ruta.
   * @returns Los datos del usuario (UID, email) verificados por Firebase.
   */
  @Get('verify-token')
  @UseGuards(AuthGuard('firebase-jwt'))
  async verifyToken(@Req() req: CustomRequest) {
    return {
      success: true,
      message: 'Token de Firebase verificado con éxito.',
      user: {
        uid: req.user.uid,
        email: req.user.email,
      },
    };
  }

  /**
   * NUEVO: Endpoint de Registro de Usuario
   * Realiza: Creación en Firebase -> Creación en MongoDB (con Rollback)
   * * @param registerUserDto Datos del usuario (email, password, username, fullName, phone)
   * @returns Datos básicos del usuario registrado.
   */
  @Post('register')
  async register(@Body(new ValidationPipe()) registerUserDto: RegisterUserDto) {
    try {
      const userRecord = await this.authService.registerUser(registerUserDto);

      return {
        success: true,
        message: 'Usuario registrado con éxito en Firebase y MongoDB.',
        data: {
          uid: userRecord.uid,
          email: userRecord.email,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Fallo interno durante el proceso de registro.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Solicita un código de recuperación de contraseña.
   * @param dto Objeto que contiene el email del usuario.
   */
  @Post('password/request')
  async requestPasswordReset(
    @Body(new ValidationPipe()) dto: PasswordRequestDto,
  ) {
    return this.authService.requestPasswordReset(dto.email);
  }

  /**
   * Resetea la contraseña usando el código enviado al email.
   * @param dto Objeto que contiene email, código y nueva contraseña.
   */
  @Post('password/reset')
  async resetPassword(@Body(new ValidationPipe()) dto: PasswordResetDto) {
    return this.authService.resetPassword(
      dto.email,
      dto.code,
      dto.newPassword,
      dto.confirmNewPassword,
    );
  }
}
