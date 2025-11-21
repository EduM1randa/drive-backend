/**
 * Esquema (entidad) para metadatos de archivos almacenados.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class FileStorage extends Document {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  mimetype: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  firebaseId: string;

  @Prop({ required: true })
  container: string;

  @Prop({ required: true })
  blobName: string;
}

export const FileStorageSchema = SchemaFactory.createForClass(FileStorage);
