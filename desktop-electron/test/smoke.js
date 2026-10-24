'use strict';

// 真实 Electron + 临时 HTTP 站点，不读取业务数据或正式用户配置。
var electron = require('electron');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var http = require('node:http');
var temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wen-electron-smoke-'));
electron.app.setPath('userData', temp);
var server = http.createServer(function (_req, res) {
    res.setHeader('Set-Cookie', 'smoke=ok; HttpOnly; SameSite=Lax; Path=/');
    res.end('<!doctype html><title>Smoke fixture</title><h1>Connected</h1>');
});
var timer = setTimeout(function () { finish(new Error('Electron smoke timeout')); }, 30000);
function finish(error) {
    clearTimeout(timer);
    if (error) console.error(error);
    server.close();
    console.log('临时测试目录：' + temp);
    electron.app.exit(error ? 1 : 0);
}
function waitFor(predicate) {
    return new Promise(function (resolve, reject) {
        var deadline = Date.now() + 10000;
        function check() {
            try {
                var result = predicate();
                if (result) return resolve(result);
                if (Date.now() > deadline) return reject(new Error('等待窗口加载超时'));
                setTimeout(check, 50);
            } catch (error) { reject(error); }
        }
        check();
    });
}
server.listen(0, '127.0.0.1', function () {
    require(process.env.WEN_DESKTOP_SMOKE_APP || '../main');
    electron.app.whenReady().then(async function () {
        var setup = await waitFor(function () {
            return electron.BrowserWindow.getAllWindows().find(function (window) {
                return window.webContents.getURL().startsWith('file:') && !window.webContents.isLoading();
            });
        });
        assert.equal(await setup.webContents.executeJavaScript('typeof window.desktop.saveConfig'), 'function');
        var previewDir = path.join(__dirname, '..', '.cache');
        fs.mkdirSync(previewDir, { recursive: true });
        await new Promise(function (resolve) { setTimeout(resolve, 500); });
        fs.writeFileSync(path.join(previewDir, 'setup-preview.png'), (await setup.webContents.capturePage()).toPNG());
        console.log('PASS 首次启动设置页及隔离桥接');
        var invalid = await setup.webContents.executeJavaScript('window.desktop.saveConfig("http://example.com")');
        assert.ok(invalid.error);
        console.log('PASS 拒绝不安全线上地址');
        var url = 'http://127.0.0.1:' + server.address().port + '/app.html';
        // 提交真实表单，覆盖设置页脚本和 IPC。
        await setup.webContents.executeJavaScript('document.getElementById("server-url").value = ' +
            JSON.stringify(url) + '; document.querySelector("form").requestSubmit()');
        var remote = await waitFor(function () {
            return electron.BrowserWindow.getAllWindows().find(function (window) {
                return window.webContents.getURL() === url && !window.webContents.isLoading();
            });
        });
        assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'server.json'), 'utf8')).url, url);
        console.log('PASS 表单保存地址并加载网页');
        assert.equal(await remote.webContents.executeJavaScript('typeof require + ":" + typeof window.desktop'), 'undefined:undefined');
        var prefs = remote.webContents.getLastWebPreferences();
        assert.equal(prefs.sandbox, true);
        assert.equal(prefs.contextIsolation, true);
        console.log('PASS 远程网页无 Node 和配置桥接权限');
        var cookies = await remote.webContents.session.cookies.get({ url: url });
        assert.ok(cookies.find(function (cookie) { return cookie.name === 'smoke'; }));
        assert.equal(remote.webContents.session.isPersistent(), true);
        console.log('PASS 登录 Cookie 使用持久化会话');
        await remote.webContents.executeJavaScript('location.href = "https://example.invalid/"');
        await new Promise(function (resolve) { setTimeout(resolve, 300); });
        assert.equal(remote.webContents.getURL(), url);
        console.log('PASS 阻止跨站导航');
        // 从菜单重新打开配置，再验证存储的地址。
        electron.Menu.getApplicationMenu().items[0].submenu.items[1].click();
        var reopened = await waitFor(function () {
            return electron.BrowserWindow.getAllWindows().find(function (window) {
                return window.webContents.getURL().startsWith('file:') && !window.webContents.isLoading();
            });
        });
        assert.equal((await reopened.webContents.executeJavaScript('window.desktop.readConfig()')).url, url);
        console.log('PASS 菜单修改地址并读取已保存配置');
        finish();
    }).catch(finish);
});
