import { User } from '../users/schemas/user.schema';
import { EmailService } from './email.service';
import { Body, Controller, Post } from '@nestjs/common';

@Controller('passwordRecovery')
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Post('sendUserRecovery')
  sendUserRecovery(@Body() user: User) {
    try {
      return this.emailService.sendUserRecovery(user);
    } catch (e) {
      throw new Error('INTERNAL_SERVER_ERROR');
    }
  }
}
