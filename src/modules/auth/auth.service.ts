import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  HttpException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { RegisterUserDto } from './dto/register.dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject, ValidationError } from 'class-validator';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { OtpAuthenticatorService } from './otp-authenticator.service';
import { PasswordResetDto } from './dto/pass-reset.dto';
import { PasswordRequestDto } from './dto/pass-request.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TfaCodeDto } from './dto/tfa-code.dto';
import {
  AuthLoginResponse,
  LoginTfaResponse,
  VerifyTokenResponse,
  PasswordRequestResponse,
  PasswordResetResponse,
  TfaGenerateResponse,
  TfaConfirmResponse,
} from '../../common/types/response.types';
import { extractTokenFromHeader } from '../../common/utils/auth.util';

@Injectable()
/**
 * Servicio de autenticación.
 */
export class AuthService {
  constructor(
    private firebaseAdmin: FirebaseAdminService,
    private userService: UsersService,
    private emailService: EmailService,
    private otpAuthenticatorService: OtpAuthenticatorService,
  ) {}

  /**
   * Genera un secreto TOTP (provisioning URI) para el usuario identificado
   * por `firebaseUid`, persiste el secreto en el perfil (sin habilitar TFA)
   * y retorna la URI para generar el QR en el controlador.
   */
  async generateTfaSecretForUser(
    authorization: string,
  ): Promise<TfaGenerateResponse> {
    const userRecord = await this.decodeFbUserToken(authorization);
    const profile = await this.userService.findOneByUid(userRecord.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado');

    if (profile.isTfaEnabled) {
      throw new BadRequestException('TFA ya está habilitado para este usuario');
    }

    const { uri, secretAuthenticator } =
      await this.otpAuthenticatorService.generateSecretAuthenticator(
        profile.email,
      );

    await this.userService.updateProfileByFirebaseUid(profile.firebaseUid, {
      tfaSecret: secretAuthenticator,
    });

    return { uri, secret: secretAuthenticator };
  }

  /**
   * Verifica el código TOTP (6 dígitos) para el usuario y, si es correcto,
   * habilita 2FA en el perfil.
   *
   * @param firebaseUid UID del usuario en Firebase
   * @param code Código TOTP proporcionado por el usuario
   * @returns `{ success: true, message: 'TFA habilitado' }` en caso de éxito
   * @throws `BadRequestException` si falta el código, no se inició TFA o el
   *   código es inválido.
   */
  async confirmTfaForUser(
    authorization: string,
    dto: TfaCodeDto,
  ): Promise<TfaConfirmResponse> {
    const { code } = dto;
    if (!code) throw new BadRequestException('El código TFA es obligatorio');

    const userRecord = await this.decodeFbUserToken(authorization);

    const profile = await this.userService.findOneByUid(userRecord.uid);
    if (!profile || !profile.tfaSecret) {
      throw new BadRequestException('TFA no iniciado para este usuario');
    }

    const ok = await this.otpAuthenticatorService.verifyCode(
      String(code).trim(),
      profile.tfaSecret,
    );

    if (!ok) throw new BadRequestException('Código TFA inválido');

    await this.userService.updateProfileByFirebaseUid(profile.firebaseUid, {
      isTfaEnabled: true,
    });

    return { success: true, message: 'TFA habilitado' };
  }

  /**
   * Registra un usuario. Crea la cuenta en Firebase Auth y, acto seguido,
   * crea el perfil en MongoDB. Si la persistencia en Mongo falla, realiza
   * rollback borrando el usuario creado en Firebase.
   *
   * @param dto `RegisterUserDto` con los datos de registro.
   * @returns Objeto con `uid` y `email` del usuario creado en Firebase.
   * @throws `BadRequestException` | `ConflictException` | `InternalServerErrorException`
   *   según fallos de validación o errores al crear el usuario/perfil.
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
        message: 'Validación fallida',
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
   * Solicita un código de recuperación para el email indicado y envía un
   * correo con instrucciones si el usuario existe.
   *
   * @param dto Email del usuario que solicita recuperación
   * @returns Mensaje público que no revela si el email existe o no
   * @throws `InternalServerErrorException` si hay un fallo interno
   */
  async requestPasswordReset(
    dto: PasswordRequestDto,
  ): Promise<PasswordRequestResponse> {
    const { email } = dto;
    const publicResponse: PasswordRequestResponse = {
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
   * Resetea la contraseña verificando el código de recuperación y su
   * expiración.
   *
   * @param dto `PasswordResetDto` con `email`, `code`, `newPassword` y
   *   `confirmNewPassword`.
   * @returns Mensaje de éxito tras actualizar la contraseña en Firebase
   * @throws `NotFoundException` | `BadRequestException` | `InternalServerErrorException`
   */
  async resetPassword(dto: PasswordResetDto): Promise<PasswordResetResponse> {
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
   * Genera un enlace de verificación de correo para la dirección indicada
   * y lo envía por email.
   *
   * @param dto Email al que se enviará el enlace de verificación
   * @returns Mensaje de éxito si el enlace fue generado y enviado
   * @throws `BadRequestException` si no se proporciona email,
   *   `InternalServerErrorException` si la generación/envío falla
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<PasswordRequestResponse> {
    const { email } = dto;
    if (!email) {
      throw new BadRequestException('Email requerido.');
    }
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
   * Inicia el flujo de login: verifica un `idToken` de Firebase enviado en la
   * cabecera `Authorization`. Si el usuario tiene 2FA habilitado, indica
   * que se requiere TFA; en caso contrario genera un `customToken`.
   *
   * @param authorization Cabecera `Authorization: Bearer <idToken>`
   * @returns Objeto indicando si `tfaRequired` y el `customToken` cuando no
   *   se requiere TFA.
   * @throws `UnauthorizedException` si falta la cabecera o el token no es válido.
   */
  async login(authorization: string): Promise<AuthLoginResponse> {
    try {
      const userRecord = await this.decodeFbUserToken(authorization);
      const user = await this.userService.findOneByUid(userRecord.uid);
      if (user?.isTfaEnabled) {
        return { tfaRequired: true, token: null, authenticated: false };
      } else {
        const customToken = await this.firebaseAdmin.auth.createCustomToken(
          userRecord.uid,
        );
        return { tfaRequired: false, token: customToken, authenticated: true };
      }
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Valida el código TOTP durante el flujo de login cuando el usuario tiene
   * TFA habilitado y, si es correcto, genera un `customToken` para que el
   * cliente lo intercambie por una sesión Firebase.
   *
   * @param authorization Cabecera `Authorization: Bearer <idToken>`
   * @param dto Código TOTP de 6 dígitos enviado por el cliente
   * @returns `{ customToken, authenticated }` con el token a intercambiar
   * @throws `UnauthorizedException` si el token o el código no son válidos
   */
  async loginTfa(
    authorization: string,
    dto: TfaCodeDto,
  ): Promise<LoginTfaResponse> {
    const { code } = dto;
    try {
      const userRecord = await this.decodeFbUserToken(authorization);
      const user = await this.userService.findOneByUid(userRecord.uid);

      if (!user || !user.isTfaEnabled || !user.tfaSecret) {
        throw new UnauthorizedException('TFA no habilitado para este usuario');
      }

      const isCodeValid = await this.otpAuthenticatorService.verifyCode(
        String(code).trim(),
        user.tfaSecret,
      );
      if (!isCodeValid) {
        throw new UnauthorizedException('Código TFA inválido');
      }

      const customToken = await this.firebaseAdmin.auth.createCustomToken(
        userRecord.uid,
      );

      return { customToken: customToken, authenticated: true };
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Verifica un `idToken` de Firebase y devuelve información pública del
   * usuario junto con su estado de TFA.
   *
   * @param authorization Cabecera `Authorization: Bearer <idToken>`
   * @returns Objeto con `success` y `data` (uid, email, emailVerified,
   *   phoneNumber, name, userName, tfaEnabled)
   * @throws `UnauthorizedException` si el token no es válido o expiró
   */
  async verifyToken(
    authorization: string,
  ): Promise<{ success: boolean; data: VerifyTokenResponse }> {
    try {
      const userRecord = await this.decodeFbUserToken(authorization);
      const user = await this.userService.findOneByUid(userRecord.uid);

      return {
        success: true,
        data: {
          uid: userRecord.uid,
          email: userRecord.email ?? null,
          emailVerified: userRecord.emailVerified,
          phoneNumber: userRecord.phoneNumber ?? null,
          name: userRecord.displayName ?? null,
          userName: user?.username ?? null,
          tfaEnabled: user?.isTfaEnabled ?? false,
        },
      };
    } catch (err: any) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Decodifica el idToken de Firebase desde la cabecera Authorization.
   * @param authorization Cabecera Authorization con el token Bearer
   * @returns El token decodificado
   */
  async decodeFbUserToken(authorization: string) {
    try {
      const tokenId = await extractTokenFromHeader(authorization);
      const decoded = await this.firebaseAdmin.auth.verifyIdToken(tokenId);
      const user: UserRecord = await this.firebaseAdmin.auth.getUser(
        decoded.uid,
      );
      return user;
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
