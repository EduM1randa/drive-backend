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

  @Prop()
  url: string;

  @Prop({ required: true })
  firebaseId: string;

  @Prop()
  container: string;

  @Prop()
  blobName: string;

  @Prop({ default: false })
  isFolder: boolean;

  @Prop({ default: null })
  parentId: string;

  @Prop({ type: String, default: null })
  shareToken: string | null;

  @Prop({ default: 0 })
  downloadCount: number;

  @Prop({ type: Date, default: null })
  lastDownloadedAt: Date | null;
}

export const FileStorageSchema = SchemaFactory.createForClass(FileStorage);
