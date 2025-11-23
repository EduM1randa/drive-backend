import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Servicio que inicializa y expone el cliente de administración de Firebase.
 */
@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  public auth: admin.auth.Auth;

  constructor(private configService: ConfigService) { }

  /**
   * Inicializa el SDK de Firebase Admin usando la ruta definida en
   * `FIREBASE_SERVICE_ACCOUNT_KEY`. Lanza `InternalServerErrorException`
   * si la variable no está definida o el archivo no existe.
   */
  onModuleInit() {
    const firebaseConfig = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_KEY',
    );

    if (!firebaseConfig) {
      throw new InternalServerErrorException(
        'FIREBASE_SERVICE_ACCOUNT_KEY no está definida.',
      );
    }

    try {
      let credential;

      // Check if the config is a JSON string (starts with '{')
      if (firebaseConfig.trim().startsWith('{')) {
        try {
          const serviceAccount = JSON.parse(firebaseConfig);
          credential = admin.credential.cert(serviceAccount);
        } catch (e) {
          throw new Error('El contenido de FIREBASE_SERVICE_ACCOUNT_KEY no es un JSON válido.');
        }
      } else {
        // Assume it's a file path
        const absolutePath = resolve(process.cwd(), firebaseConfig);
        if (!existsSync(absolutePath)) {
          throw new Error(`Fichero no encontrado: ${absolutePath}`);
        }
        credential = admin.credential.cert(absolutePath);
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential,
        });
      }

      this.auth = admin.auth();
      console.log('Firebase Admin SDK inicializado correctamente.');
    } catch (error) {
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
