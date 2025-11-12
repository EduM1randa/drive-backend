import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { CreateFileStorageDto } from './dto/create-file-storage.dto';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';

@Controller('file-storage')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post()
  create(@Body() createFileStorageDto: CreateFileStorageDto) {
    return this.fileStorageService.create(createFileStorageDto);
  }

  @Get()
  findAll() {
    return this.fileStorageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileStorageService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFileStorageDto: UpdateFileStorageDto) {
    return this.fileStorageService.update(+id, updateFileStorageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileStorageService.remove(+id);
  }
}
