import 'multer';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';
import { extractTokenFromHeader } from '../../common/utils/auth.util';

/**
 * Controlador para endpoints relacionados con el almacenamiento de archivos.
 */
@Controller('file-storage')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) { }

  /** Crea un nuevo metadato de archivo. */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
    @Body('path') path: string = '',
    @Body('parentId') parentId?: string
  ) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    console.log("firebaseid: ", firebaseId)
    return this.fileStorageService.upload(file, firebaseId, path, parentId);
  }

  /** Crea una nueva carpeta. */
  @Post('folder')
  async createFolder(
    @Req() req,
    @Body('name') name: string,
    @Body('parentId') parentId?: string
  ) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    return this.fileStorageService.createFolder(name, firebaseId, parentId);
  }

  /** Devuelve todos los registros de file storage. */
  @Get()
  findAll() {
    // Temporarily public - returns all files without auth
    return this.fileStorageService.findAll(undefined);
  }

  /** Returns top 5 most downloaded files for the authenticated user. */
  @Get('top-downloads')
  async getTopDownloads(@Req() req) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    return this.fileStorageService.getTopDownloads(firebaseId);
  }

  /** Devuelve un registro específico por id con SAS URL para acceso seguro. */
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    const file = await this.fileStorageService.findOne(id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Generate SAS URL for secure access (only for files, not folders)
    if (!file.isFolder && file.blobName) {
      const sasUrl = await this.fileStorageService.generateSASUrl(id, firebaseId);
      return { ...file.toObject(), url: sasUrl };
    }

    return file;
  }

  /** Actualiza un registro de file storage. */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFileStorageDto: UpdateFileStorageDto,
  ) {
    return this.fileStorageService.update(id, updateFileStorageDto);
  }

  /** Elimina un registro de file storage. */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileStorageService.remove(id);
  }

  // --- Sharing Endpoints ---

  @Post(':id/share')
  async generateShareLink(@Param('id') id: string, @Req() req) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    return this.fileStorageService.generateShareToken(id, firebaseId);
  }

  @Delete(':id/share')
  async revokeShareLink(@Param('id') id: string, @Req() req) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    return this.fileStorageService.revokeShare(id, firebaseId);
  }

  @Get('shared/:token')
  async getSharedFile(@Param('token') token: string) {
    const file = await this.fileStorageService.getFileByShareToken(token);

    // Generate fresh SAS token for shared file access (permanent link, temporary token)
    if (!file.isFolder && file.blobName) {
      const sasUrl = await this.fileStorageService.generatePublicSASUrl(file);
      return { ...file.toObject(), url: sasUrl };
    }

    return file;
  }

  /** Tracks a file download (increments counter). */
  @Post(':id/track-download')
  async trackDownload(@Param('id') id: string, @Req() req) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    await this.fileStorageService.trackDownload(id, firebaseId);
    return { success: true, message: 'Download tracked' };
  }


}
