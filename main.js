const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('@electron/remote/main').initialize();

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600, 
        frame: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    // Remove the default menu bar
    win.removeMenu();

    require('@electron/remote/main').enable(win.webContents);
    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const content = await fs.readFile(result.filePaths[0], 'utf8');
        return { filePath: result.filePaths[0], content };
    }
    return null;
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
    if (!filePath) {
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });
        
        if (result.canceled) return false;
        filePath = result.filePath;
    }

    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
}); 