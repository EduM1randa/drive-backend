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
  findAll(@Req() req) {
    const firebaseId = extractTokenFromHeader(req.headers['authorization']);
    return this.fileStorageService.findAll(firebaseId);
  }

  /** Devuelve un registro específico por id. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileStorageService.findOne(id);
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
}
