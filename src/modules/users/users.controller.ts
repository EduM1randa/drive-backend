// backend-api/src/users/users.controller.ts
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

// Usaremos un tipo genérico para el payload del token
interface DecodedToken {
  uid: string;
  email: string;
  // otros claims de Firebase
}

@Controller('users')
export class UsersController {
  // Endpoint 1: Recibe y procesa los datos del perfil después del registro.
  // Es la URL que el Frontend llama: http://localhost:3000/users/profile
  @UseGuards(AuthGuard('firebase-jwt'))
  @Post('profile')
  async createProfile(@Body() createUserData: CreateUserDto, @Request() req) {
    // 1. **VERIFICACIÓN CRÍTICA DEL TOKEN:**
    // El AuthGuard ya verificó la firma del token. Si llegamos aquí, es válido.
    const userPayload: DecodedToken = req.user;

    // 2. **Verificación de Enlace:** Aseguramos que el UID en el cuerpo del request
    // coincida con el UID del token (esto evita que un usuario registre perfiles para otros).
    if (userPayload.uid !== createUserData.firebaseUid) {
      throw new HttpException(
        'Token UID does not match request body UID.',
        HttpStatus.FORBIDDEN,
      );
    }

    // 3. LÓGICA DE NEGOCIO (OMITIDA POR AHORA, IRÍA LA CONEXIÓN A MONGODB)
    // console.log('Guardando en MongoDB:', createUserData);

    return {
      message: 'Perfil de usuario creado y token verificado con éxito.',
      userUid: userPayload.uid,
      receivedData: createUserData,
      status: 'Token OK',
    };
  }

  // Endpoint 2: Endpoint de prueba simple, accesible solo con token.
  // Ejemplo: http://localhost:3000/users/status
  @UseGuards(AuthGuard('firebase-jwt'))
  @Get('status')
  async getUserStatus(@Request() req) {
    const userPayload: DecodedToken = req.user;

    return {
      message: 'Acceso autorizado. El token de Firebase es válido.',
      uid: userPayload.uid,
      email: userPayload.email,
    };
  }
}
