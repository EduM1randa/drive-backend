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
  Res,
  NotFoundException,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';

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
    @Headers('authorization') authorization: string,
    @Body('path') path: string = '',
  ) {
    return this.fileStorageService.upload(file, authorization, path);
  }

  /**
   * Devuelve los archivos pertenecientes al usuario autenticado.
   * Opcionalmente se puede filtrar por `path` (?path=/carpeta/subcarpeta).
   */
  @Get('user')
  async findUserFiles(@Headers('authorization') authorization: string) {
    return this.fileStorageService.findByUser(authorization);
  }

  /** Devuelve todos los registros de file storage. */
  @Get()
  findAll() {
    return this.fileStorageService.findAll();
  }

  /** Devuelve un registro específico por id. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileStorageService.findOne(id);
  }

  /** Stream de descarga del archivo desde Azure mediante el backend. */
  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.fileStorageService.findOne(id);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Opcional: aquí podrías validar el JWT si quieres proteger la descarga

    await this.fileStorageService.streamFromAzure(
      file.container,
      file.blobName,
      res,
      file.mimetype,
      file.filename,
    );
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