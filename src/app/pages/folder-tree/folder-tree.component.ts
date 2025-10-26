import { Component } from '@angular/core';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource } from '@angular/material/tree';

interface FileNode {
  name: string;
  size: number; // size in bytes
  children?: FileNode[];
}

@Component({
  selector: 'app-folder-tree',
  templateUrl: './folder-tree.component.html',
  styleUrls: ['./folder-tree.component.scss']
})
export class FolderTreeComponent {
  treeControl = new NestedTreeControl<FileNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<FileNode>();
  sortAsc = true;

  hasChild = (_: number, node: FileNode) => !!node.children && node.children.length > 0;

  onFolderSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    const root: any = {};

    Array.from(files).forEach(file => {
      const parts = file.webkitRelativePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {
            __size: 0,
            __children: {},
            __isFile: i === parts.length - 1,
            __fileSize: i === parts.length - 1 ? file.size : 0
          };
        }

        if (i === parts.length - 1) {
          current[part].__size = file.size;
        }

        current = current[part].__children;
      }
    });

    const convertToTree = (node: any): FileNode[] => {
      return Object.entries(node).map(([name, value]: [string, any]) => {
        const children = convertToTree(value.__children || {});
        const size = value.__isFile
          ? value.__fileSize
          : children.reduce((sum, child) => sum + child.size, 0);

        return {
          name,
          size,
          children: children.length ? children : undefined
        };
      });
    };

    const result = convertToTree(root);
    this.dataSource.data = result;
  }

  toggleSort(): void {
    this.sortAsc = !this.sortAsc;
    this.sortTree(this.dataSource.data, this.sortAsc);
    this.treeControl.collapseAll();
    this.dataSource.data = [...this.dataSource.data];
  }

  sortTree(nodes: FileNode[], asc: boolean): void {
    nodes.sort((a, b) => asc ? a.size - b.size : b.size - a.size);
    for (const node of nodes) {
      if (node.children) {
        this.sortTree(node.children, asc);
      }
    }
  }
}
