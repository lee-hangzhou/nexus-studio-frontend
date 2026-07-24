export type PendingLocalFile = {
  localId: string;
  file: File;
  previewUrl?: string;
};

export function createPendingLocalFile(file: File): PendingLocalFile {
  return {
    localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  };
}

export function revokePendingLocalFile(item: PendingLocalFile): void {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

export function revokePendingLocalFiles(items: PendingLocalFile[]): void {
  items.forEach(revokePendingLocalFile);
}
