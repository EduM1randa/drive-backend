import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Interfaz para el usuario autenticado que se inyectará en req.user
 * Contiene el UID y el email verificado por Firebase.
 */
export interface AuthUser extends DecodedIdToken {}

/**
 * Estrategia de Passport para verificar tokens JWT de Firebase.
 * Usa el esquema Bearer (Authorization: Bearer <token>)
 */
@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(
  Strategy,
  'firebase-jwt',
) {
  constructor(private firebaseAdminService: FirebaseAdminService) {
    super(); // La superclase se encarga de extraer el token del header Authorization: Bearer
  }

  /**
   * Método que Passport llama para validar el token (llamado 'token' por passport-http-bearer)
   * @param token El token JWT extraído del encabezado 'Authorization: Bearer'
   */
  async validate(token: string): Promise<AuthUser> {
    try {
      // **LA VERIFICACIÓN CRÍTICA OCURRE AQUÍ**
      const decodedToken =
        await this.firebaseAdminService.auth.verifyIdToken(token);

      // Si la verificación tiene éxito, devolvemos el payload decodificado (AuthUser)
      // Nest.js inyectará este objeto en req.user
      return decodedToken as AuthUser;
    } catch (error) {
      // Si el token es inválido, expiró, o la firma es incorrecta, FirebaseAdmin lanza un error.
      // Lanzamos una excepción de Nest.js que resulta en una respuesta 401 Unauthorized.
      console.error('Verificación de token fallida:', error.message);
      throw new UnauthorizedException(
        'Token de autenticación inválido o expirado.',
      );
    }
  }
}
