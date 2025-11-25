import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { FileStorageController } from './file-storage.controller';
import { FileStorage, FileStorageSchema } from './schemas/file-storage.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';

@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
    ConfigModule,
    FirebaseAdminModule,
    MongooseModule.forFeature([
      { name: FileStorage.name, schema: FileStorageSchema },
    ]),
  ],
  controllers: [FileStorageController],
  providers: [FileStorageService],
})
export class FileStorageModule {}
