import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(sizeInBytes: number): string {
    if (isNaN(sizeInBytes)) return '';
    const kb = sizeInBytes / 1024;
    return `${kb.toFixed(2)} KB`;
  }
}
