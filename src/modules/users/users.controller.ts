import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Controlador de usuarios: endpoints relacionados con perfiles y estado.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}
}
