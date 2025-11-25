export class CreateFileStorageDto {
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  firebaseId: string;
  container: string;
  blobName: string;
  readonly path: string;
  readonly isFolder?: boolean;
  readonly parentId?: string;
  readonly shareToken?: string;
}
