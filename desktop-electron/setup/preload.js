'use strict';
var electron = require('electron');
electron.contextBridge.exposeInMainWorld('desktop', {
    readConfig: function () { return electron.ipcRenderer.invoke('desktop:config'); },
    saveConfig: function (url) { return electron.ipcRenderer.invoke('desktop:config', url); }
});
