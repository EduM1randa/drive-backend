import { User } from '../users/schemas/user.schema';
import { EmailService } from './email.service';
import { Body, Controller, Post } from '@nestjs/common';

/**
 * Controlador para endpoints relacionados con el envío de correos de
 * recuperación y verificación.
 */
@Controller('passwordRecovery')
export class EmailController {
  constructor(private emailService: EmailService) {}

  /**
   * Endpoint para enviar el código de recuperación al usuario.
   */
  @Post('sendUserRecovery')
  sendUserRecovery(@Body() user: User) {
    try {
      return this.emailService.sendUserRecovery(user);
    } catch (e) {
      throw new Error('INTERNAL_SERVER_ERROR');
    }
  }
}
