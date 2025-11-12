import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

/**
 * Controlador de usuarios: endpoints relacionados con perfiles y estado.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}
}
