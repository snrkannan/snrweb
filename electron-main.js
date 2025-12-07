const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow () {
  const win = new BrowserWindow({
    width: 600,
    height: 350,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, 'dist/snrweb/index.html'));
}

app.whenReady().then(createWindow);

// IPC handlers for script runs:
ipcMain.handle('run-color-coding', async () => {
  exec('powershell.exe -ExecutionPolicy Bypass -File "D:\\folderSize1.ps1"');
});

ipcMain.handle('run-reset-icon', async () => {
  exec('powershell.exe -ExecutionPolicy Bypass -File "D:\\FolderSizeReset.ps1"');
});
