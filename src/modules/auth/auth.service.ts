import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  Logger,
  HttpException,
  HttpStatus,
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private firebaseAdmin: FirebaseAdminService,
    private userService: UsersService,
    private emailService: EmailService,
  ) {}

  /**
   * --- FUNCIÓN PRINCIPAL DE REGISTRO ---
   * Crea un usuario en Firebase Auth y luego en MongoDB, implementando un
   * mecanismo de ROLLBACK si la inserción en MongoDB falla.
   */
  async registerUser(dto: RegisterUserDto): Promise<UserRecord> {
    // Validar cada campo del dto: email, password, username, fullName, phone
    const dtoInstance = plainToInstance(RegisterUserDto, dto);

    try {
      // validateOrReject soporta validadores async (ej. IsUsernameAvailable) si useContainer fue configurado
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

    // Pre-check de username para fail-fast (no evita condiciones de carrera; sigue manejando 11000)
    if (dtoInstance.username) {
      const isTaken = await this.userService.isUsernameTaken(
        dtoInstance.username,
      );
      if (isTaken) {
        throw new ConflictException('El nombre de usuario ya está en uso.');
      }
    }

    let firebaseUser: UserRecord | null = null;

    // --- 1. Crear usuario en Firebase Auth ---
    try {
      firebaseUser = await this.firebaseAdmin.auth.createUser({
        email: dto.email,
        password: dto.password,
        displayName: dto.fullName,
      });
      this.logger.log(
        `Usuario temporal creado en Firebase UID: ${firebaseUser.uid}`,
      );
    } catch (error) {
      this.logger.error(`Firebase Auth falló al crear: ${error.message}`);
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException(
          'El correo electrónico ya está registrado en Firebase.',
        );
      }
      throw new InternalServerErrorException(
        'Error al crear usuario en Firebase.',
      );
    }

    if (!firebaseUser) {
      throw new InternalServerErrorException(
        'Firebase no devolvió un usuario.',
      );
    }

    // --- 2. Crear perfil en MongoDB ---
    try {
      // Llamamos a la función para crear el perfil en la base de datos
      await this.userService.createProfile(
        firebaseUser.uid,
        firebaseUser.email ?? '',
        dto,
      );

      this.logger.log(`Registro completo para UID: ${firebaseUser.uid}`);
      return firebaseUser;
    } catch (mongoError) {
      // --- 3. ROLLBACK ---
      this.logger.error(
        `MongoDB falló. Iniciando rollback para Firebase UID: ${firebaseUser.uid}`,
        mongoError.stack,
      );

      try {
        await this.firebaseAdmin.auth.deleteUser(firebaseUser.uid);
        this.logger.warn(
          `ROLLBACK EXITOSO: Usuario ${firebaseUser.uid} eliminado de Firebase Auth.`,
        );
      } catch (rollbackError) {
        this.logger.error(
          `FALLO DE ROLLBACK CATASTRÓFICO: No se pudo eliminar el usuario huérfano ${firebaseUser.uid}.`,
          rollbackError.stack,
        );
      }

      if (mongoError instanceof HttpException) {
        throw mongoError;
      }
      throw new InternalServerErrorException(
        `Error de base de datos durante el registro: ${mongoError.message}`,
      );
    }
  }

  /**
   * Solicita un código de recuperación: genera código y envía email.
   */
  async requestPasswordReset(email: string) {
    const user = await this.userService.generatePasswordReset(email);
    await this.emailService.sendUserRecovery(user);
    return { success: true, message: 'Código de recuperación enviado.' };
  }

  /**
   * Resetea la contraseña verificando código y expiración.
   */
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
    confirmNewPassword: string,
  ) {
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
      this.logger.error(
        `Error actualizando contraseña en Firebase: ${e.message}`,
      );
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
}
