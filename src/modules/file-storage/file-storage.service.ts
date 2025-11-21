import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFileStorageDto } from './dto/create-file-storage.dto';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';
import { FileStorage } from './schemas/file-storage.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlobServiceClient } from '@azure/storage-blob';
import { ConfigService } from '@nestjs/config';

@Injectable()
/**
 * Servicio para manejar el almacenamiento de archivos. Implementa operaciones
 * CRUD básicas sobre metadatos de archivos.
 */
export class FileStorageService {

  private blobClient: BlobServiceClient;
  private containerName: string;

  constructor(
    private config: ConfigService,
    @InjectModel(FileStorage.name) private fileModel: Model<FileStorage>,
  ) {
    const conn = this.config.get<string>('AZURE_BLOB_CONNECTION_STRING');

    // para probar con azurite no es necesario un valor .env
    const container = this.config.get<string>('CONTAINER_NAME');

    if (!conn) {
      throw new Error('Missing AZURE_BLOB_CONNECTION_STRING in .env');
    }

    this.blobClient = BlobServiceClient.fromConnectionString(conn);
    this.containerName = container ? container : "my-container"
  }

  /** Crea un nuevo registro de FileStorage. */
  async create(dto: CreateFileStorageDto) {
    const file = new this.fileModel(dto);
    return file.save();
  }

  async findAll() {
    return this.fileModel.find().exec();
  }

  async findOne(id: string) {
    return this.fileModel.findById(id).exec();
  }

  async update(id: string, dto: UpdateFileStorageDto) {
    return this.fileModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  async remove(id: string) {
    const file = await this.fileModel.findById(id).exec();

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.deleteFromAzure(file.container, file.blobName);

    await this.fileModel.findByIdAndDelete(id).exec();

    return { success: true, message: 'File deleted successfully' };
  }

  async upload(
    file: Express.Multer.File,
    firebaseId: string,
    path: string = ''
  ) {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, ''); 
    const prefix = normalizedPath ? normalizedPath + '/' : '';

    const blobName = `${prefix}${Date.now()}-${file.originalname}`;

    const { url, container } =
      await this.uploadToAzureRaw(file.buffer, blobName);

    const dto: CreateFileStorageDto = {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
      firebaseId,
      blobName,
      container,
      path: normalizedPath || '', // root as empty string
    };

    return this.create(dto);
  }

  async uploadToAzureRaw(buffer: Buffer, blobName: string) {
    const container = this.containerName;
    const containerClient = this.blobClient.getContainerClient(container);
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer);

    return {
      url: blockBlobClient.url,
      blobName,
      container
    };
  }

  // no la estoy usando pero puede usarse en caso que sea necesario
  async uploadToAzure(file: Express.Multer.File): Promise<{ url: string; blobName: string; container: string }> {

    const container = this.containerName;
    const containerClient = this.blobClient.getContainerClient(this.containerName);
    await containerClient.createIfNotExists();

    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer);

    return {
      url: blockBlobClient.url,
      blobName,
      container,
    };
  }

  async deleteFromAzure(container: string, blobName: string) {
    const containerClient = this.blobClient.getContainerClient(container);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  }

}
