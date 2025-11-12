import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { FirebaseJwtStrategy } from '../firebase/firebase-jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';
import { AuthController } from './auth.controller';
import { IsUsernameAvailable } from 'src/common/validators/username-exist.validator';
import { UsersModule } from '../users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    FirebaseAdminModule,
    UsersModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
  ],
  controllers: [AuthController],
  providers: [FirebaseJwtStrategy, IsUsernameAvailable, AuthService],
  exports: [PassportModule, FirebaseJwtStrategy],
})
export class AuthModule {}
