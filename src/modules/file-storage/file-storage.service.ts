import { Injectable } from '@nestjs/common';
import { CreateFileStorageDto } from './dto/create-file-storage.dto';
import { UpdateFileStorageDto } from './dto/update-file-storage.dto';

@Injectable()
export class FileStorageService {
  create(createFileStorageDto: CreateFileStorageDto) {
    return 'This action adds a new fileStorage';
  }

  findAll() {
    return `This action returns all fileStorage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} fileStorage`;
  }

  update(id: number, updateFileStorageDto: UpdateFileStorageDto) {
    return `This action updates a #${id} fileStorage`;
  }

  remove(id: number) {
    return `This action removes a #${id} fileStorage`;
  }
}
