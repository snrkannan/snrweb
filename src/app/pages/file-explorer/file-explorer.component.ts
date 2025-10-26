// file-explorer.component.ts
import { Component, OnInit } from '@angular/core';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';

// Interface for a file or folder item
interface FileItem {
  name: string;
  size: number; // Size in bytes, will be calculated for folders
  type: 'file' | 'folder';
  children?: FileItem[]; // Only for folders
}

// Flat node with expandable and level information
interface FlatTreeNode {
  expandable: boolean;
  name: string;
  size: number;
  type: 'file' | 'folder';
  level: number;
  item: FileItem; // Reference to the original item
}

// Define a type for a root folder entry
interface RootFolderItem {
  id: string;
  name: string;
  contents: FileItem[]; // The actual file system structure for this root
}

@Component({
  selector: 'app-file-explorer',
  templateUrl: './file-explorer.component.html',
  styleUrls: ['./file-explorer.component.scss']
})
export class FileExplorerComponent implements OnInit {

  // Dummy data for different root file systems
  rootFileSystems: RootFolderItem[] = [
    {
      id: 'my_pc',
      name: 'My PC',
      contents: [
        {
          name: 'C:',
          size: 0,
          type: 'folder',
          children: [
            {
              name: 'Users',
              size: 0,
              type: 'folder',
              children: [
                { name: 'John', size: 0, type: 'folder', children: [{ name: 'document.txt', size: 10240, type: 'file' }] }, // 10KB
                { name: 'Jane', size: 0, type: 'folder', children: [{ name: 'image.png', size: 524288, type: 'file' }] }, // 0.5MB
              ]
            },
            { name: 'Program Files', size: 0, type: 'folder', children: [{ name: 'App.exe', size: 10485760, type: 'file' }] }, // 10MB
            { name: 'Windows', size: 0, type: 'folder', children: [{ name: 'system.log', size: 51200, type: 'file' }] }, // 50KB
          ]
        },
        {
          name: 'D:',
          size: 0,
          type: 'folder',
          children: [
            { name: 'Projects', size: 0, type: 'folder', children: [{ name: 'project_plan.pdf', size: 2097152, type: 'file' }] }, // 2MB
            { name: 'Photos', size: 0, type: 'folder', children: [{ name: 'album.zip', size: 31457280, type: 'file' }] }, // 30MB
          ]
        },
      ]
    },
    {
      id: 'network_drive',
      name: 'Network Share (S:)',
      contents: [
        {
          name: 'SharedDocs',
          size: 0,
          type: 'folder',
          children: [
            { name: 'TeamReport.xlsx', size: 8388608, type: 'file' }, // 8MB
            { name: 'Guidelines.pdf', size: 157286, type: 'file' }, // 0.15MB
          ]
        },
        { name: 'Public', size: 0, type: 'folder', children: [{ name: 'announcement.txt', size: 512, type: 'file' }] }, // 0.5KB
      ]
    },
    {
      id: 'cloud_storage',
      name: 'Cloud Drive',
      contents: [
        {
          name: 'Backup',
          size: 0,
          type: 'folder',
          children: [
            { name: 'archive_2023.zip', size: 524288000, type: 'file' }, // 500MB
          ]
        },
        { name: 'SharedWithMe.link', size: 100, type: 'file' }, // 0.1KB
      ]
    }
  ];

  selectedRootFolderId: string = 'my_pc'; // Initialize with a default root

  // Tree control for FlatTree
  treeControl: FlatTreeControl<FlatTreeNode>;
  treeFlattener: MatTreeFlattener<FileItem, FlatTreeNode>;
  dataSource: MatTreeFlatDataSource<FileItem, FlatTreeNode>;

  currentFolder: FileItem | null = null;
  currentPath: FileItem[] = []; // Stack to keep track of the path for "Back" functionality

  sortColumn: 'name' | 'size' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor() {
    this.treeFlattener = new MatTreeFlattener(
      this._transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren,
    );
    this.treeControl = new FlatTreeControl(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  }

  ngOnInit(): void {
    // Find the initially selected root folder and load it
    this.loadSelectedRootFolder();
  }

  // Helper method to load the selected root folder data
  private loadSelectedRootFolder(): void {
    const initialRoot = this.rootFileSystems.find(root => root.id === this.selectedRootFolderId);
    if (initialRoot) {
      // Create a deep copy of the contents to avoid modifying the original data
      // when calculating sizes or navigating
      const contentsCopy = JSON.parse(JSON.stringify(initialRoot.contents));

      this.currentFolder = {
        name: initialRoot.name,
        size: 0, // Will be calculated below
        type: 'folder',
        children: contentsCopy
      };
      // Calculate initial sizes for the selected root folder and its children
      this.calculateFolderSize(this.currentFolder);
    }
    this.updateTreeData();
    this.treeControl.collapseAll(); // Ensure all nodes are collapsed on initial load or root change
  }


  // --- Tree Control Methods ---
  getLevel = (node: FlatTreeNode) => node.level;
  isExpandable = (node: FlatTreeNode) => node.expandable;
  getChildren = (node: FileItem): FileItem[] | null | undefined => node.children;
  hasChild = (_: number, node: FlatTreeNode) => node.expandable;

  private _transformer = (node: FileItem, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      size: node.size,
      type: node.type,
      level: level,
      item: node, // Keep a reference to the original item
    };
  };

  // --- Custom Logic ---

  // Calculates the total size of a folder, including its children
  private calculateFolderSize(folder: FileItem): number {
    let totalSize = 0;
    if (folder.children) {
      for (const item of folder.children) {
        if (item.type === 'file') {
          totalSize += item.size;
        } else if (item.type === 'folder' && item.children) {
          // Recursively calculate size for nested folders and update their size property
          item.size = this.calculateFolderSize(item);
          totalSize += item.size;
        }
      }
    }
    folder.size = totalSize; // Update the folder's own size property
    return totalSize;
  }

  // Updates the MatTreeFlatDataSource with sorted data
  private updateTreeData(): void {
    if (!this.currentFolder || !this.currentFolder.children) {
      this.dataSource.data = [];
      return;
    }

    // Sort the current level's children
    const sortedChildren = [...this.currentFolder.children].sort((a, b) => {
      let comparison = 0;

      if (this.sortColumn === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (this.sortColumn === 'size') {
        // Sort folders by their calculated size
        comparison = a.size - b.size;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.dataSource.data = sortedChildren;

    // Expand previously expanded nodes if navigating back
    this.treeControl.dataNodes.forEach(node => {
      if (node.type === 'folder' && node.expandable && this.treeControl.isExpanded(node)) {
        // Re-expansion logic can be complex; for this example, we re-render data on change.
        // A more advanced solution would track expanded nodes by ID across data changes.
      }
    });
  }

  // Navigate into a selected folder
  goToFolder(node: FlatTreeNode): void {
    if (node.type === 'folder' && node.item.children) {
      // Push the current folder to path stack before navigating deeper
      // Only push if not at the true root of the selected file system
      if (this.currentFolder && this.currentFolder.name === this.rootFileSystems.find(r => r.id === this.selectedRootFolderId)?.name) {
        // If current is the selected root, push its direct children as the first level of path
        this.currentPath.push({ name: this.currentFolder.name, size: this.currentFolder.size, type: 'folder', children: this.currentFolder.children });
      } else if (this.currentFolder) {
        this.currentPath.push(this.currentFolder);
      }

      this.currentFolder = node.item; // Set the actual folder item
      this.treeControl.collapseAll(); // Collapse all on new folder entry
      this.updateTreeData();
    }
  }

  // Navigate back up to the parent folder
  goBack(): void {
    if (this.currentPath.length > 0) {
      this.currentFolder = this.currentPath.pop()!;
      this.treeControl.collapseAll(); // Collapse all on going back
      this.updateTreeData();
    }
  }

  // Method to select a new root folder
  selectRootFolder(rootId: string): void {
    this.selectedRootFolderId = rootId;
    this.currentPath = []; // Clear current path when changing root
    this.loadSelectedRootFolder(); // Load the new root data
  }

  // Sorts the items based on the selected column and direction
  sort(column: 'name' | 'size'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc'; // Default to ascending when changing column
    }
    this.updateTreeData();
  }

  // Helper function to format bytes into human-readable string, now specifically to MB
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024); // Convert bytes to MB
    return mb.toFixed(2) + ' MB';
  }

  /**
   * Getter to construct the full current path for display.
   * This centralizes the path string construction, avoiding complex template expressions.
   */
  get displayCurrentPath(): string {
    let path = '';
    const rootName = this.rootFileSystems.find(r => r.id === this.selectedRootFolderId)?.name || 'Unknown Root';
    path += rootName; // Start with the selected root's name

    if (this.currentPath.length > 0) {
      path += '/' + this.currentPath.map(f => f.name).slice(1).join('/'); // Skip the first element if it's the root itself
    }

    if (this.currentFolder && this.currentFolder.name !== rootName && this.currentFolder.name !== 'Root') {
        path += '/' + this.currentFolder.name;
    }
    return path;
  }
}
