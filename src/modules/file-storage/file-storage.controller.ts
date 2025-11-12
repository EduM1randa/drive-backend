import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { CreateFileStorageDto } from './dto/create-file-storage.dto';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';

/**
 * Controlador para endpoints relacionados con el almacenamiento de archivos.
 */
@Controller('file-storage')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /** Crea un nuevo metadato de archivo. */
  @Post()
  create(@Body() createFileStorageDto: CreateFileStorageDto) {
    return this.fileStorageService.create(createFileStorageDto);
  }

  /** Devuelve todos los registros de file storage. */
  @Get()
  findAll() {
    return this.fileStorageService.findAll();
  }

  /** Devuelve un registro específico por id. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileStorageService.findOne(+id);
  }

  /** Actualiza un registro de file storage. */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFileStorageDto: UpdateFileStorageDto,
  ) {
    return this.fileStorageService.update(+id, updateFileStorageDto);
  }

  /** Elimina un registro de file storage. */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileStorageService.remove(+id);
  }
}
