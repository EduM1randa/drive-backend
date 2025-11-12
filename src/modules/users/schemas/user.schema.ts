import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

/**
 * Esquema de usuario en MongoDB que representa el perfil almacenado en
 * la colección `users`. Incluye campos para recuperación de contraseña.
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  firebaseUid: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  email: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  username: string;

  @Prop({ required: true })
  fullName: string;

  @Prop()
  phone?: string;

  @Prop({ default: 'free' })
  role?: string;

  @Prop({ type: String, select: false })
  resetPasswordCode?: string | null;

  @Prop({ type: Date, select: false })
  resetPasswordExpires?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
