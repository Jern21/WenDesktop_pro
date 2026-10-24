'use strict';

var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var dialog = electron.dialog;
var fs = require('node:fs');
var path = require('node:path');
var pathToFileURL = require('node:url').pathToFileURL;
var policy = require('./policy');
var serverUrl = '';
var mainWindow;
var setupWindow;
var setupPath = path.join(__dirname, 'setup', 'index.html');
var setupUrl = pathToFileURL(setupPath).href;

function configPath() { return path.join(app.getPath('userData'), 'server.json'); }

function openExternal(url) {
    if (policy.isExternalLink(url)) electron.shell.openExternal(url).catch(function () {});
}

function showSetup() {
    if (setupWindow) { setupWindow.focus(); return; }
    setupWindow = new BrowserWindow({
        width: 600, height: 420, resizable: false, title: '连接工作台',
        webPreferences: {
            preload: path.join(__dirname, 'setup', 'preload.js'),
            nodeIntegration: false, contextIsolation: true, sandbox: true
        }
    });
    setupWindow.setMenu(null);
    setupWindow.webContents.on('will-navigate', function (event) { event.preventDefault(); });
    setupWindow.webContents.setWindowOpenHandler(function () { return { action: 'deny' }; });
    setupWindow.on('closed', function () { setupWindow = null; });
    setupWindow.loadFile(setupPath);
}

function loadWorkbench() {
    mainWindow.loadURL(serverUrl).catch(function () { /* did-fail-load 提供重试入口 */ });
}

function showWorkbench() {
    if (mainWindow) { loadWorkbench(); mainWindow.focus(); return; }
    mainWindow = new BrowserWindow({
        width: 1380, height: 900, minWidth: 960, minHeight: 640,
        title: '文的项目工作台', backgroundColor: '#f8fafc',
        webPreferences: {
            partition: 'persist:workbench', nodeIntegration: false,
            contextIsolation: true, sandbox: true, webSecurity: true
        }
    });
    var contents = mainWindow.webContents;
    contents.session.setPermissionRequestHandler(function (_contents, _permission, callback) { callback(false); });
    contents.session.setPermissionCheckHandler(function () { return false; });
    contents.on('will-attach-webview', function (event) { event.preventDefault(); });
    function guardNavigation(event, url) {
        if (!policy.isSameSite(url, serverUrl)) event.preventDefault();
    }
    contents.on('will-navigate', guardNavigation);
    contents.on('will-redirect', guardNavigation);
    contents.setWindowOpenHandler(function (details) {
        // 同站附件在应用会话中打开，保留 Cookie；外站交给系统浏览器。
        if (policy.isSameSite(details.url, serverUrl)) {
            mainWindow.loadURL(details.url).catch(function () {});
        } else { openExternal(details.url); }
        return { action: 'deny' };
    });
    contents.on('did-fail-load', function (_event, code, _description, _url, isMainFrame) {
        if (!isMainFrame || code === -3 || !mainWindow) return;
        dialog.showMessageBox(mainWindow, {
            type: 'error', title: '无法连接工作台',
            message: '网页加载失败，请检查网络、服务器地址或 HTTPS 证书。',
            buttons: ['重试', '修改地址', '关闭提示'], cancelId: 2
        }).then(function (result) {
            if (!mainWindow) return;
            if (result.response === 0) loadWorkbench();
            if (result.response === 1) showSetup();
        });
    });
    mainWindow.on('closed', function () { mainWindow = null; });
    loadWorkbench();
}

function installMenu() {
    electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([
        { label: '工作台', submenu: [
            { label: '返回首页', click: function () { if (mainWindow) loadWorkbench(); } },
            { label: '修改服务器地址', click: showSetup },
            { type: 'separator' }, { role: 'quit', label: '退出' }
        ] },
        { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' },
            { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: '视图', submenu: [{ role: 'reload', label: '刷新' }, { role: 'forceReload' },
            { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
    ]));
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', function () {
        var window = setupWindow || mainWindow;
        if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
    });
    app.whenReady().then(function () {
        installMenu();
        electron.ipcMain.handle('desktop:config', function (event, value) {
            if (!setupWindow || event.sender !== setupWindow.webContents ||
                event.senderFrame !== setupWindow.webContents.mainFrame || event.senderFrame.url !== setupUrl) {
                throw new Error('不允许此页面修改服务器地址');
            }
            if (value === undefined) return { url: serverUrl };
            try {
                var next = policy.parseServerUrl(value);
                fs.mkdirSync(path.dirname(configPath()), { recursive: true });
                fs.writeFileSync(configPath(), JSON.stringify({ url: next }, null, 2));
                serverUrl = next;
                showWorkbench();
                setupWindow.close();
                return { ok: true };
            } catch (error) { return { error: error.message }; }
        });
        try { serverUrl = policy.parseServerUrl(JSON.parse(fs.readFileSync(configPath(), 'utf8')).url); }
        catch (_) { /* 首次运行或配置损坏时重新填写 */ }
        if (serverUrl) showWorkbench(); else showSetup();
        app.on('activate', function () {
            if (!mainWindow && !setupWindow) { if (serverUrl) showWorkbench(); else showSetup(); }
        });
    });
    app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });
}
