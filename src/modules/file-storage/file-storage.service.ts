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
    // Use configured connection string or fallback to Azurite (local emulator)
    // This allows the app to start even if Azure Storage is not yet provisioned
    const azuriteConn = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1';
    const conn = this.config.get<string>('AZURE_BLOB_CONNECTION_STRING') || azuriteConn;

    const container = this.config.get<string>('CONTAINER_NAME');

    this.blobClient = BlobServiceClient.fromConnectionString(conn);
    this.containerName = container ? container : "my-container"
  }

  /** Crea un nuevo registro de FileStorage. */
  async create(dto: CreateFileStorageDto) {
    const file = new this.fileModel(dto);
    return file.save();
  }

  async findAll(firebaseId: string, parentId?: string) {
    const query: any = { firebaseId };

    // Filter by parentId if provided, otherwise show root items (parentId is null or undefined)
    if (parentId !== undefined) {
      query.parentId = parentId;
    } else {
      query.parentId = { $in: [null, undefined] };
    }

    return this.fileModel.find(query).exec();
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

    // Only delete from Azure if it's a file (not a folder)
    if (!file.isFolder) {
      await this.deleteFromAzure(file.container, file.blobName);
    }

    await this.fileModel.findByIdAndDelete(id).exec();

    return { success: true, message: 'File deleted successfully' };
  }

  async createFolder(name: string, firebaseId: string, parentId?: string) {
    const dto: CreateFileStorageDto = {
      filename: name,
      mimetype: 'folder',
      size: 0,
      url: '',
      firebaseId,
      blobName: '',
      container: '',
      path: '',
      isFolder: true,
      parentId: parentId || undefined,
    };

    return this.create(dto);
  }

  async upload(
    file: Express.Multer.File,
    firebaseId: string,
    path: string = '',
    parentId?: string
  ) {
    const normalizedPath = path.trim().replace(/^[\/\\]+|[\/\\]+$/g, '');
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
      isFolder: false,
      parentId: parentId || undefined,
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

  async deleteFromAzure(containerName: string, blobName: string) {
    const containerClient = this.blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  }

  // --- Sharing Functionality ---

  async generateShareToken(id: string, firebaseId: string) {
    const file = await this.fileModel.findOne({ _id: id, firebaseId }).exec();
    if (!file) throw new NotFoundException('File not found or access denied');

    // Generate a simple UUID-like token
    const token = crypto.randomUUID();
    file.shareToken = token;
    await file.save();

    return { success: true, shareToken: token };
  }

  async revokeShare(id: string, firebaseId: string) {
    const file = await this.fileModel.findOne({ _id: id, firebaseId }).exec();
    if (!file) throw new NotFoundException('File not found or access denied');

    file.shareToken = null;
    await file.save();

    return { success: true, message: 'Share revoked' };
  }

  async getFileByShareToken(token: string) {
    const file = await this.fileModel.findOne({ shareToken: token }).exec();
    if (!file) throw new NotFoundException('Shared file not found or link expired');
    return file;
  }
}
