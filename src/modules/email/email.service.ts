import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from '../users/schemas/user.schema';

/**
 * Servicio de correo electrónico encargado de enviar plantillas para
 * recuperación de contraseña y verificación de email.
 */
@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  /**
   * Envía el código de recuperación al email del usuario.
   * @param user Documento del usuario que contiene `resetPasswordCode`.
   */
  async sendUserRecovery(user: User) {
    try {
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }
      const code = `${user.resetPasswordCode}`;
      await this.mailerService.sendMail({
        to: user.email,
        from: '"Equipo de soporte" <support@example.com>',
        subject: 'Recuperación de contraseña',
        html: `<h1>Hey ${user.email},</h1>
                <h2>Usa el siguiente codigo para reestrablecer tu contrasena</h2>
                <p>
                    ${code}
                </p>
                <i>Si tu no pediste este codigo, puedes ignorarlo.</i>`,
        context: {
          names: user.email,
          code: code,
        },
      });
      return { message: 'Email sent successfully', success: true };
    } catch (e) {
      return { message: 'Error sending email', success: false };
    }
  }

  /**
   * Envía un correo con el enlace de verificación de email.
   * @param email Dirección de correo a verificar
   * @param link URL de verificación generada por Firebase
   */
  async sendEmailVerification(email: string, link: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        from: '"Equipo de soporte" <support@example.com>',
        subject: 'Verificación de correo electrónico',
        html: `<h1>Verifica tu correo electrónico</h1>
                <p>Haz clic en el siguiente enlace para verificar tu correo electrónico:</p>
                <a href="${link}">Verificar correo electrónico</a>
                <i>Si tu no pediste verificar este correo, puedes ignorarlo.</i>`,
        context: {
          email: email,
          link: link,
        },
      });
      return { message: 'Verification email sent successfully', success: true };
    } catch (e) {
      return { message: 'Error sending verification email', success: false };
    }
  }
}
