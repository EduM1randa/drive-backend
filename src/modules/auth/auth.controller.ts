import {
  Controller,
  Get,
  UseGuards,
  Post,
  Body,
  Headers,
  Req,
  Res,
} from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { PasswordRequestDto } from './dto/pass-request.dto';
import { PasswordResetDto } from './dto/pass-reset.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TfaCodeDto } from './dto/tfa-code.dto';
import { Request, Response } from 'express';
import { toFileStream } from 'qrcode';
import { AuthGuard } from '@nestjs/passport';

/**
 * Controlador de autenticación.
 *
 * Expone endpoints relacionados con la gestión de cuentas: registro, inicio
 * de sesión (con y sin 2FA), recuperación de contraseña, verificación de
 * correo y operaciones de TFA (generar y confirmar secreto).
 *
 * Las rutas están bajo el prefijo `/auth`.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Verifica un `idToken` de Firebase y devuelve información pública del
   * usuario.
   *
   * @param authorization Cabecera `Authorization: Bearer <idToken>` con el
   *   token de Firebase a verificar.
   * @returns Objeto con información verificada del usuario (uid, email,
   *   emailVerified, phoneNumber, name, userName, tfaEnabled).
   * @throws `UnauthorizedException` si la cabecera no está presente o el
   *   token es inválido/expirado.
   */
  @Get('verify-token')
  async verifyToken(@Headers('authorization') authorization: string) {
    return this.authService.verifyToken(authorization);
  }

  /**
   * Registra un nuevo usuario: crea la cuenta en Firebase Auth y el perfil
   * en MongoDB. Si la creación del perfil falla, se realiza rollback en
   * Firebase eliminando al usuario creado.
   *
   * @param registerUserDto Payload de registro validado por
   *   `RegisterUserDto` (email, password, confirmPassword, fullName,
   *   username, phone).
   * @returns `{ uid, email }` con el uid de Firebase y el email registrado.
   * @throws `BadRequestException` | `ConflictException` | `InternalServerErrorException`
   *   según condiciones de validación o errores internos.
   */
  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return await this.authService.registerUser(registerUserDto);
  }

  /**
   * Solicita un código de recuperación de contraseña para el email dado.
   *
   * @param dto `PasswordRequestDto` con la propiedad `email`.
   * @returns Mensaje público que no revela si el email existe o no.
   */
  @Post('password/request')
  async requestPasswordReset(@Body() dto: PasswordRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  /**
   * Resetea la contraseña de un usuario.
   *
   * @param dto `PasswordResetDto` con `email`, `code`, `newPassword` y
   *   `confirmNewPassword`.
   * @returns Mensaje de éxito si el código es válido y la contraseña fue
   *   actualizada en Firebase.
   * @throws `BadRequestException` | `NotFoundException` |
   *   `InternalServerErrorException` según el resultado de las comprobaciones.
   */
  @Post('password/reset')
  async resetPassword(@Body() dto: PasswordResetDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Genera y envía un enlace de verificación de email para la dirección
   * proporcionada.
   *
   * @param dto `VerifyEmailDto` con la propiedad `email`.
   * @returns Mensaje público indicando que el enlace fue enviado.
   * @throws `BadRequestException` si falta el email, `InternalServerErrorException`
   *   si falla la generación/envío del enlace.
   */
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  /**
   * Inicia el proceso de login. Espera un `idToken` de Firebase en la
   * cabecera `Authorization`. Si el usuario tiene TFA habilitado, el
   * servicio retornará `{ tfaRequired: true }` para que el frontend
   * solicite el código TOTP; si no, devuelve un `customToken` para
   * intercambiar por una sesión Firebase.
   *
   * @param authorization Cabecera `Authorization: Bearer <idToken>`.
   * @returns Objeto con `tfaRequired`, `token` (customToken|null) y
   *   `authenticated`.
   * @throws `UnauthorizedException` si falta o es inválida la cabecera.
   */
  @Post('login')
  async login(@Headers('authorization') authorization: string) {
    return this.authService.login(authorization);
  }

  /**
   * Completa el login cuando el usuario tiene TFA habilitado. Recibe el
   * `idToken` en la cabecera y el `code` TOTP en el body.
   *
   * @param authorization Cabecera `Authorization: Bearer <idToken>`.
   * @param dto `TfaCodeDto` con la propiedad `code` (6 dígitos).
   * @returns `{ customToken, authenticated }` donde `customToken` debe ser
   *   intercambiado en el cliente con `signInWithCustomToken`.
   * @throws `UnauthorizedException` si el token o el código son inválidos.
   */
  @Post('loginTfa')
  async loginTfa(
    @Headers('authorization') authorization: string,
    @Body() dto: TfaCodeDto,
  ) {
    return this.authService.loginTfa(authorization, dto);
  }

  /**
   * Genera un secreto TOTP para el usuario autenticado y devuelve una
   * imagen PNG con el QR para ser escaneado por una app de autenticación.
   *
   * Esta ruta está protegida por el `AuthGuard('firebase-jwt')` y espera
   * que el middleware ya haya poblado `req.user` con `{ uid }`.
   *
   * @param req Objeto `Request` de Express. `req.user` debe contener el
   *   `uid` del usuario autenticado (proporcionado por el guard).
   * @param res Objeto `Response` de Express usado para enviar el PNG.
   * @returns Stream PNG con el QR (se establece `Cache-Control: no-store`).
   */
  @UseGuards(AuthGuard('firebase-jwt'))
  @Post('tfa/generate')
  async generateTfaSecret(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { uid: string };
    const { uri } = await this.authService.generateTfaSecretForUser(user.uid);

    res.setHeader('Cache-Control', 'no-store');
    res.type('png');
    return toFileStream(res, uri);
  }

  /**
   * Confirma y habilita TFA para el usuario autenticado verificando el
   * código TOTP proporcionado.
   *
   * Esta ruta está protegida por `AuthGuard('firebase-jwt')`.
   *
   * @param req Objeto `Request` de Express. `req.user` debe contener el
   *   `uid` del usuario autenticado.
   * @param dto `TfaCodeDto` con el `code` TOTP de 6 dígitos.
   * @returns `{ success: true, message: 'TFA enabled' }` si la verificación fue
   *   correcta.
   * @throws `BadRequestException` si el código no es válido o no se inició TFA.
   */
  @UseGuards(AuthGuard('firebase-jwt'))
  @Post('tfa/confirm')
  async confirmTfa(@Req() req: Request, @Body() dto: TfaCodeDto) {
    const user = req.user as { uid: string };
    return this.authService.confirmTfaForUser(user.uid, dto);
  }
}
