import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  HttpException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserRecord } from 'firebase-admin/auth';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { RegisterUserDto } from './dto/register.dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject, ValidationError } from 'class-validator';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { PasswordResetDto } from './dto/pass-reset.dto';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
/**
 * Servicio de autenticación que orquesta la creación de usuarios en
 * Firebase Auth y su persistencia en MongoDB (perfil de usuario).
 * Contiene métodos para registro, recuperación de contraseña y verificación.
 */
export class AuthService {
  constructor(
    private firebaseAdmin: FirebaseAdminService,
    private userService: UsersService,
    private emailService: EmailService,
  ) {}

  /**
   * Crea un usuario en Firebase Auth y luego en MongoDB, implementando un
   * mecanismo de ROLLBACK si la inserción en MongoDB falla.
   */
  async registerUser(
    dto: RegisterUserDto,
  ): Promise<{ uid: string; email?: string | null }> {
    const dtoInstance = plainToInstance(RegisterUserDto, dto);

    try {
      await validateOrReject(dtoInstance as object);
    } catch (errors) {
      const errs = (errors as ValidationError[])
        .map((err) => (err.constraints ? Object.values(err.constraints) : []))
        .flat();
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errs,
      });
    }

    if (dtoInstance.username) {
      const isTaken = await this.userService.isUsernameTaken(
        dtoInstance.username,
      );
      if (isTaken) {
        throw new ConflictException({
          message: 'El nombre de usuario ya está en uso.',
          errorCode: 'username_taken',
        });
      }
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        message: 'Las contraseñas no coinciden.',
        errorCode: 'password_mismatch',
      });
    }

    let firebaseUser: UserRecord | null = null;

    try {
      firebaseUser = await this.firebaseAdmin.auth.createUser({
        email: dto.email,
        password: dto.password,
        displayName: dto.fullName,
      });
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException({
          message: 'El correo electrónico ya está registrado.',
          errorCode: 'email_exists',
        });
      }
      throw new InternalServerErrorException({
        message: 'Error al crear usuario.',
      });
    }

    if (!firebaseUser) {
      throw new InternalServerErrorException('Error al crear usuario..');
    }

    try {
      await this.userService.createProfile(
        firebaseUser.uid,
        firebaseUser.email ?? '',
        dto,
      );

      return { uid: firebaseUser.uid, email: firebaseUser.email ?? null };
    } catch (mongoError) {
      try {
        await this.firebaseAdmin.auth.deleteUser(firebaseUser.uid);
      } catch (rollbackError) {}

      if (mongoError instanceof HttpException) {
        throw mongoError;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear perfil, contacte con soporte.',
      });
    }
  }

  /**
   * Solicita un código de recuperación: genera código y envía email.
   */
  async requestPasswordReset(email: string) {
    const publicResponse = {
      success: true,
      message:
        'Si el correo está registrado, se ha enviado un código de recuperación.',
    };
    try {
      const user = await this.userService.generatePasswordReset(email);
      if (user) await this.emailService.sendUserRecovery(user);
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al procesar la solicitud de recuperación de contraseña.',
      );
    }

    return publicResponse;
  }

  /**
   * Resetea la contraseña verificando código y expiración.
   */
  async resetPassword(dto: PasswordResetDto) {
    const { email, code, newPassword, confirmNewPassword } = dto;
    const user = await this.userService.findProfileByEmail(email);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.resetPasswordCode || `${user.resetPasswordCode}` !== `${code}`) {
      throw new BadRequestException('Código inválido.');
    }

    const expiresAt = user.resetPasswordExpires
      ? new Date(user.resetPasswordExpires).getTime()
      : 0;
    if (expiresAt < Date.now()) {
      throw new BadRequestException('El código ha expirado.');
    }

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException(
        'La nueva contraseña y su confirmación no coinciden.',
      );
    }

    try {
      await this.firebaseAdmin.auth.updateUser(user.firebaseUid, {
        password: newPassword,
      });
    } catch (e) {
      throw new InternalServerErrorException(
        'No se pudo actualizar la contraseña.',
      );
    }

    await this.userService.updateProfileByFirebaseUid(user.firebaseUid, {
      resetPasswordCode: null,
      resetPasswordExpires: null,
    });

    return { success: true, message: 'Contraseña reseteada con éxito.' };
  }

  /**
  /**
   * Verifica el correo electronico del usuario con la funcion de firebase.
   * Genera un enlace de verificación usando el Admin SDK para el email proporcionado.
   */
  async verifyEmail(email: string) {
    try {
      const link =
        await this.firebaseAdmin.auth.generateEmailVerificationLink(email);
      await this.emailService.sendEmailVerification(email, link);
      return {
        success: true,
        message: 'Correo de verificación enviado con éxito.',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'No se pudo generar el enlace de verificación.',
      );
    }
  }

  /**
   * Verifica un idToken (Bearer) con Firebase y devuelve información del usuario.
   */
  async verifyToken(authorization: string) {
    if (!authorization) {
      throw new UnauthorizedException('No token provided');
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    const idToken = match[1];

    try {
      const decoded = await this.firebaseAdmin.auth.verifyIdToken(idToken);
      const userRecord = await this.firebaseAdmin.auth.getUser(decoded.uid);

      return {
        success: true,
        data: {
          uid: decoded.uid,
          email: decoded.email,
          emailVerified: userRecord.emailVerified,
          phoneNumber: userRecord.phoneNumber ?? null,
          name: userRecord.displayName ?? null,
        },
      };
    } catch (err: any) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
