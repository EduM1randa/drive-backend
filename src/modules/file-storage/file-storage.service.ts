import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFileStorageDto } from './dto/create-file-storage.dto';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';
import { FileStorage } from './schemas/file-storage.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} from '@azure/storage-blob';
import { ConfigService } from '@nestjs/config';

@Injectable()
/**
 * Servicio para manejar el almacenamiento de archivos. Implementa operaciones
 * CRUD básicas sobre metadatos de archivos.
 */
export class FileStorageService {

  private blobClient: BlobServiceClient;
  private containerName: string;
  private accountName: string;
  private accountKey: string;

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
    this.containerName = container ? container : "my-container";

    // Extract account name and key for SAS generation
    this.accountName = this.config.get<string>('AZURE_STORAGE_ACCOUNT_NAME') || 'devstoreaccount1';
    this.accountKey = this.config.get<string>('AZURE_STORAGE_ACCOUNT_KEY') || 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
  }

  /** Crea un nuevo registro de FileStorage. */
  async create(dto: CreateFileStorageDto) {
    const file = new this.fileModel(dto);
    return file.save();
  }

  async findAll(firebaseId?: string, parentId?: string) {
    const query: any = {};

    // Only filter by firebaseId if provided
    if (firebaseId) {
      query.firebaseId = firebaseId;
    }

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

  /**
   * Generates a SAS URL for secure, temporary access to a blob.
   * @param fileId - The file ID
   * @param firebaseId - User ID for authorization
   * @returns URL with SAS token (valid for 2 hours)
   */
  async generateSASUrl(fileId: string, firebaseId: string): Promise<string | null> {
    const file = await this.fileModel.findOne({ _id: fileId, firebaseId }).exec();
    if (!file) throw new NotFoundException('File not found or access denied');

    // Folders don't have blobs
    if (file.isFolder || !file.blobName) {
      return null;
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey
    );

    const sasOptions = {
      containerName: file.container,
      blobName: file.blobName,
      permissions: BlobSASPermissions.parse("r"), // Read-only
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 2 * 3600 * 1000), // 2 hours
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      sharedKeyCredential
    ).toString();

    // Construct full URL with SAS token
    const baseUrl = file.url.split('?')[0]; // Remove any existing query params
    return `${baseUrl}?${sasToken}`;
  }

  /**
   * Tracks a file download by incrementing counter and updating timestamp.
   * @param fileId - The file ID
   * @param firebaseId - User ID for authorization
   */
  async trackDownload(fileId: string, firebaseId: string): Promise<void> {
    const file = await this.fileModel.findOne({ _id: fileId, firebaseId }).exec();
    if (!file) throw new NotFoundException('File not found or access denied');

    file.downloadCount = (file.downloadCount || 0) + 1;
    file.lastDownloadedAt = new Date();
    await file.save();
  }

  /**
   * Returns the top 5 most downloaded files for a user.
   * @param firebaseId - User ID
   * @returns Array of top 5 files sorted by download count
   */
  async getTopDownloads(firebaseId: string): Promise<FileStorage[]> {
    return this.fileModel
      .find({ firebaseId, isFolder: false })
      .sort({ downloadCount: -1 })
      .limit(5)
      .exec();
  }

  /**
   * Generates a SAS URL for publicly shared files (no authentication required).
   * Used for permanent share links that generate fresh tokens on each access.
   * @param file - The file document
   * @returns URL with SAS token (valid for 24 hours)
   */
  async generatePublicSASUrl(file: FileStorage): Promise<string | null> {
    // Folders don't have blobs
    if (file.isFolder || !file.blobName) {
      return null;
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(
      this.accountName,
      this.accountKey
    );

    const sasOptions = {
      containerName: file.container,
      blobName: file.blobName,
      permissions: BlobSASPermissions.parse("r"), // Read-only
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 24 * 3600 * 1000), // 24 hours for shared files
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      sharedKeyCredential
    ).toString();

    // Construct full URL with SAS token
    const baseUrl = file.url.split('?')[0]; // Remove any existing query params
    return `${baseUrl}?${sasToken}`;
  }
}
