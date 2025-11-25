import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFileStorageDto } from './dto/create-file-storage.dto';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';
import { FileStorage } from './schemas/file-storage.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { BlobServiceClient } from '@azure/storage-blob';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { extractTokenFromHeader } from '../../common/utils/auth.util';

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
    private firebaseAdmin: FirebaseAdminService,
  ) {
    // Use configured connection string or fallback to Azurite (local emulator)
    // This allows the app to start even if Azure Storage is not yet provisioned
    const azuriteConn = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1';
    const conn = this.config.get<string>('AZURE_BLOB_CONNECTION_STRING') || azuriteConn;

    const container = this.config.get<string>('CONTAINER_NAME');

    this.blobClient = BlobServiceClient.fromConnectionString(conn);
    this.containerName = container ? container : 'my-container';
  }

  /** Crea un nuevo registro de FileStorage. */
  async create(dto: CreateFileStorageDto) {
    const file = new this.fileModel(dto);
    return file.save();
  }

  /**
   * Obtiene el uid de Firebase a partir del header Authorization `Bearer <idToken>`.
   */
  private async getFirebaseUidFromAuthorization(authorization: string): Promise<string> {
    const idToken = extractTokenFromHeader(authorization);
    const decoded = await this.firebaseAdmin.auth.verifyIdToken(idToken);
    return decoded.uid;
  }

  async findAll() {
    return this.fileModel.find().exec();
  }

  async findOne(id: string) {
    return this.fileModel.findById(id).exec();
  }

  /**
   * Devuelve los archivos asociados al uid de Firebase.
   * @param authorization Header Authorization con el idToken de Firebase.
   */
  async findByUser(authorization: string, path?: string) {
    const firebaseUid = await this.getFirebaseUidFromAuthorization(authorization);
    const filter: FilterQuery<FileStorage> = { firebaseId: firebaseUid };

    if (path !== undefined) {
      filter.path = this.normalizePath(path);
    }

    return this.fileModel.find(filter).exec();
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
    authorization: string,
    path: string = '',
  ) {
    const normalizedPath = this.normalizePath(path);
    const prefix = normalizedPath ? `${normalizedPath}/` : '';

    const blobName = `${prefix}${Date.now()}-${file.originalname}`;

    const { url, container } =
      await this.uploadToAzureRaw(file.buffer, blobName);

    // obtenemos el uid real del usuario
    const firebaseUid = await this.getFirebaseUidFromAuthorization(authorization);

    const dto: CreateFileStorageDto = {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
      firebaseId: firebaseUid, // guardamos el uid, no el token
      blobName,
      container,
      path: normalizedPath,
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

  /** Stream del blob desde Azure hacia la respuesta HTTP. */
  async streamFromAzure(
    container: string,
    blobName: string,
    res: Response,
    mimetype?: string,
    filename?: string,
  ) {
    const containerClient = this.blobClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobName);

    const exists = await blobClient.exists();
    if (!exists) {
      throw new NotFoundException('Blob not found');
    }

    const downloadResponse = await blobClient.download();
    res.setHeader(
      'Content-Type',
      mimetype || downloadResponse.contentType || 'application/octet-stream',
    );
    if (filename) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(filename)}"`,
      );
    }

    const readableStream = downloadResponse.readableStreamBody;
    if (!readableStream) {
      throw new NotFoundException('Blob stream not available');
    }
    readableStream.pipe(res);
  }

  private normalizePath(path?: string | null): string {
    if (!path) return '';
    return path.trim().replace(/^\/+|\/+$/g, '');
  }

}