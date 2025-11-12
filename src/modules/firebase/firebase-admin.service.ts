import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
// Importamos 'fs' y 'path' para resolver la ruta (ya están en tu archivo)
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  public auth: admin.auth.Auth;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Leemos la variable. Esperamos que contenga una RUTA RELATIVA (ej: ./secrets/archivo.json)
    const filePath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_KEY',
    );

    if (!filePath) {
      throw new InternalServerErrorException(
        'FIREBASE_SERVICE_ACCOUNT_KEY no está definida.',
      );
    }

    try {
      // Usamos path.resolve(process.cwd(), filePath) para asegurar que la ruta se resuelve desde la raíz del backend
      const absolutePath = resolve(process.cwd(), filePath);

      // La verificación del archivo es muy importante
      if (!existsSync(absolutePath)) {
        throw new Error(`Fichero no encontrado: ${absolutePath}`);
      }

      // **La inicialización del SDK de Firebase puede aceptar la ruta directamente**
      // Usando admin.credential.cert(ruta/al/archivo)
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(absolutePath),
        });
      }

      this.auth = admin.auth();
      console.log('Firebase Admin SDK inicializado correctamente.');
    } catch (error) {
      // Capturamos cualquier error, incluyendo 'Fichero no encontrado'
      console.error(
        'Error al inicializar Firebase Admin SDK. Mensaje:',
        error?.message ?? error,
      );
      throw new InternalServerErrorException(
        'Error de configuración de Firebase Admin. Verifique FIREBASE_SERVICE_ACCOUNT_KEY (ruta o JSON).',
      );
    }
  }
}
