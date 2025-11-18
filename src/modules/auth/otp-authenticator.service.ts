import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

@Injectable()
/**
 * Servicio para manejo de TOTP (OTP) usando `otplib`.
 */
export class OtpAuthenticatorService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Genera un secreto TOTP y devuelve la URI para el QR.
   * El valor de `secretAuthenticator` que se devuelve está cifrado si
   * existe la variable de entorno `TFA_ENCRYPTION_KEY` (base64, 32 bytes).
   */
  async generateSecretAuthenticator(
    email: string,
  ): Promise<{ uri: string; secretAuthenticator: string }> {
    const secretAuthenticator = authenticator.generateSecret();
    const appName =
      this.configService.get<string>('TFA_APP_NAME') ??
      process.env.TFA_APP_NAME ??
      'PapuDrive';
    const uri = authenticator.keyuri(email, appName, secretAuthenticator);

    const encrypted = this.encryptIfConfigured(secretAuthenticator);
    return { uri, secretAuthenticator: encrypted };
  }

  /**
   * Verifica un código TOTP contra un secreto (posiblemente cifrado).
   *
   * @param code Código TOTP a verificar (string de 6 dígitos)
   * @param secret Secreto almacenado en la base de datos (puede estar cifrado)
   * @returns `true` si el código es válido, `false` en caso contrario
   */
  async verifyCode(code: string, secret: string) {
    const plain = await this.maybeDecrypt(secret);
    return authenticator.verify({ token: code, secret: plain });
  }

  private getEncryptionKey(): Buffer | null {
    const key =
      this.configService.get<string>('TFA_ENCRYPTION_KEY') ??
      process.env.TFA_ENCRYPTION_KEY;
    if (!key) return null;
    try {
      return Buffer.from(key, 'base64');
    } catch (e) {
      return null;
    }
  }

  private encryptIfConfigured(plain: string): string {
    const key = this.getEncryptionKey();
    if (!key) return plain;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  /**
   * Intenta descifrar una cadena cifrada en el formato
   * `iv.base64.tag.base64.ciphertext.base64`. Si no está en ese formato
   * o no hay clave configurada, devuelve el `payload` original.
   *
   * @param payload Texto potencialmente cifrado
   * @returns Texto en claro si el descifrado fue correcto, o `payload` si no
   *   se pudo descifrar
   */
  private maybeDecrypt(payload: string): string {
    if (!payload || typeof payload !== 'string') return payload;
    const parts = payload.split('.');
    if (parts.length !== 3) return payload;
    const key = this.getEncryptionKey();
    if (!key) return payload;

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const tag = Buffer.from(parts[1], 'base64');
      const encrypted = Buffer.from(parts[2], 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (e) {
      return payload;
    }
  }
}
