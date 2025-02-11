const { ipcRenderer } = require('electron');
const fs = require('fs');
const { dialog, getCurrentWindow } = require('@electron/remote');

let tabs = [];
let activeTabId = null;
let currentTheme = localStorage.getItem('theme') || 'dark';

// Theme switching logic
let isDark = true;

// Add file type support
const SUPPORTED_FILES = [
    { name: 'Text Files', extensions: ['txt', 'md', 'js', 'py', 'html', 'css', 'json', 'xml', 'csv'] },
    { name: 'All Files', extensions: ['*'] }
];

// Add file type detection
const FILE_TYPES = {
    'js': { language: 'javascript', mime: 'text/javascript' },
    'jsx': { language: 'jsx', mime: 'text/javascript' },
    'ts': { language: 'typescript', mime: 'text/typescript' },
    'tsx': { language: 'tsx', mime: 'text/typescript' },
    'css': { language: 'css', mime: 'text/css' },
    'html': { language: 'markup', mime: 'text/html' },
    'py': { language: 'python', mime: 'text/x-python' },
    'cpp': { language: 'cpp', mime: 'text/x-c++' },
    'c': { language: 'cpp', mime: 'text/x-c' },
    'java': 'java',
    'json': { language: 'json', mime: 'application/json' },
    'md': 'markdown',
    'txt': { language: null, mime: 'text/plain' }
};

class Tab {
    constructor() {
        this.id = Date.now();
        this.filePath = null;
        this.fileName = 'Untitled';
        this.content = '';
        this.isModified = false;
    }
}

function createEditorElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-wrapper';
    
    const editor = document.createElement('textarea');
    editor.className = 'editor';
    editor.spellcheck = false;
    
    wrapper.appendChild(editor);
    return wrapper;
}

function createTabElement(tab) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.setAttribute('data-tab-id', tab.id);
    
    const tabName = document.createElement('span');
    tabName.textContent = tab.fileName + (tab.isModified ? ' •' : '');
    
    const closeButton = document.createElement('span');
    closeButton.className = 'tab-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
    };
    
    tabEl.appendChild(tabName);
    tabEl.appendChild(closeButton);
    tabEl.onclick = () => activateTab(tab.id);
    
    return tabEl;
}

function activateTab(tabId) {
    activeTabId = tabId;
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-tab-id') == tabId);
    });
    document.querySelectorAll('.editor-wrapper').forEach((editor, index) => {
        editor.classList.toggle('active', tabs[index].id == tabId);
    });
}

function newTab() {
    const tab = new Tab();
    const editorWrapper = createEditorElement();
    const editor = editorWrapper.querySelector('.editor');
    
    editor.oninput = () => {
        tab.content = editor.value;
        tab.isModified = true;
        updateTabTitle(tab);
    };
    
    tabs.push(tab);
    document.querySelector('.editors-container').appendChild(editorWrapper);
    
    const tabsContainer = document.querySelector('.tabs-container');
    tabsContainer.insertBefore(createTabElement(tab), document.getElementById('new-tab-button'));
    
    activateTab(tab.id);
}

function openFile() {
    const files = dialog.showOpenDialogSync({
        properties: ['openFile'],
        filters: [
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (files) {
        const filePath = files[0];
        const tab = new Tab();
        tab.filePath = filePath;
        tab.fileName = filePath.split('\\').pop().split('/').pop();
        
        const editorWrapper = createEditorElement();
        const editor = editorWrapper.querySelector('.editor');
        
        try {
            tab.content = fs.readFileSync(filePath, 'utf8');
            editor.value = tab.content;
            
            editor.oninput = () => {
                tab.content = editor.value;
                tab.isModified = true;
                updateTabTitle(tab);
            };
            
            tabs.push(tab);
            document.querySelector('.editors-container').appendChild(editorWrapper);
            
            const tabsContainer = document.querySelector('.tabs-container');
            tabsContainer.insertBefore(createTabElement(tab), document.getElementById('new-tab-button'));
            
            activateTab(tab.id);
        } catch (err) {
            dialog.showErrorBox('Error', `Failed to open file: ${err.message}`);
        }
    }
}

function updateTabTitle(tab) {
    const tabEl = document.querySelector(`[data-tab-id="${tab.id}"]`);
    if (tabEl) {
        const tabName = tabEl.querySelector('span');
        tabName.textContent = tab.fileName + (tab.isModified ? ' •' : '');
    }
    updateWindowTitle();
}

function saveFile() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    
    if (!tab.filePath) {
        return saveFileAs();
    }

    try {
        fs.writeFileSync(tab.filePath, tab.content);
        tab.isModified = false;
        updateTabTitle(tab);
    } catch (err) {
        dialog.showErrorBox('Error', `Failed to save file: ${err.message}`);
    }
}

function saveFileAs() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    
    const file = dialog.showSaveDialogSync({
        filters: [
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (file) {
        tab.filePath = file;
        tab.fileName = file.split('\\').pop().split('/').pop();
        updateTabTitle(tab);
        try {
            fs.writeFileSync(tab.filePath, tab.content);
            tab.isModified = false;
            updateTabTitle(tab);
        } catch (err) {
            dialog.showErrorBox('Error', `Failed to save file: ${err.message}`);
        }
    }
}

function closeTab(tabId) {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;
    
    if (tabs[tabIndex].isModified) {
        const choice = dialog.showMessageBoxSync({
            type: 'question',
            buttons: ['Save', "Don't Save", 'Cancel'],
            title: 'Confirm',
            message: `Do you want to save the changes to ${tabs[tabIndex].fileName}?`
        });
        
        if (choice === 0) {
            saveFile();
        } else if (choice === 2) {
            return;
        }
    }
    
    document.querySelectorAll('.tab')[tabIndex].remove();
    document.querySelectorAll('.editor-wrapper')[tabIndex].remove();
    tabs.splice(tabIndex, 1);
    
    if (tabs.length === 0) {
        newTab();
    } else {
        activateTab(tabs[Math.min(tabIndex, tabs.length - 1)].id);
    }
}

// Window controls
function minimizeWindow() {
    getCurrentWindow().minimize();
}

function maximizeWindow() {
    const win = getCurrentWindow();
    if (win.isMaximized()) {
        win.unmaximize();
    } else {
        win.maximize();
    }
}

function closeWindow() {
    getCurrentWindow().close();
}

// Auto-save functionality (optional)
let saveTimeout;
editor.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        if (currentFilePath) {
            saveFile();
        }
    }, 1000);
});

// Initialize
updateTitle();

function toggleTheme() {
    isDark = !isDark;
    const themeButton = document.getElementById('theme-toggle');
    
    if (isDark) {
        document.body.classList.remove('light');
        document.body.classList.add('dark');
        themeButton.textContent = '🌙';
    } else {
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        themeButton.textContent = '☀️';
    }
    
    // Save preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize theme from saved preference
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    isDark = savedTheme === 'dark';
    toggleTheme();
});

// Add this to your window initialization
function updateWindowTitle() {
    const tab = tabs.find(t => t.id === activeTabId);
    const fileName = tab ? tab.fileName : 'Untitled';
    const modified = tab && tab.isModified ? '• ' : '';
    document.title = `${modified}${fileName} - PURE Studio`;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) { // metaKey for Mac support
        switch(e.key.toLowerCase()) {
            case 'n':
                e.preventDefault();
                newTab();
                break;
            case 'o':
                e.preventDefault();
                openFile();
                break;
            case 's':
                e.preventDefault();
                if (e.shiftKey) {
                    saveFileAs();
                } else {
                    saveFile();
                }
                break;
            case 'w':
                e.preventDefault();
                closeCurrentTab();
                break;
        }
    }
});

// Tab key handling
document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab' && document.activeElement.classList.contains('editor')) {
        e.preventDefault();
        const editor = document.activeElement;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        // Insert 4 spaces
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        
        // Put cursor after the inserted spaces
        editor.selectionStart = editor.selectionEnd = start + 4;
    }
});

// Add function to close current tab
function closeCurrentTab() {
    if (activeTabId) {
        closeTab(activeTabId);
    }
} 