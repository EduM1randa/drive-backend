import { UnauthorizedException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
Extrae el token del encabezado Authorization.
@param authorizationHeader El valor del encabezado Authorization.
@returns El token extraído.
@throws UnauthorizedException Si el encabezado no está presente o tiene un formato inválido.
*/
export function extractTokenFromHeader(
  authorizationHeader: string,
): string {
  if (!authorizationHeader) {
    throw new UnauthorizedException('Token no proporcionado');
  }
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new UnauthorizedException('Cabecera de autorización inválida');
  }

  const idToken = match[1];
  return idToken;
}
