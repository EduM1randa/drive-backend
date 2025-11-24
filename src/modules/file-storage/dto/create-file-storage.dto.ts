export class CreateFileStorageDto {
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  firebaseId: string;
  container: string;
  blobName: string;
  path: string;
  isFolder?: boolean;
  parentId?: string;
}
