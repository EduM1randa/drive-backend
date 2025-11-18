import { PartialType } from '@nestjs/mapped-types';
import { CreateFileStorageDto } from './create-file-storage.dto';

export class UpdateFileStorageDto extends PartialType(CreateFileStorageDto) {}
