import { Module } from '@nestjs/common';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAdminModule } from './modules/firebase/firebase-admin.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    FileStorageModule,
    DatabaseModule,
    FirebaseAdminModule,
    AuthModule,
    UsersModule,
    EmailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
