import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

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
}
