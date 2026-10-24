'use strict';
var form = document.querySelector('form');
var input = document.getElementById('server-url');
var errorBox = document.getElementById('error');
var button = document.querySelector('button');
window.desktop.readConfig().then(function (config) { input.value = config.url || ''; }).catch(function () {
    errorBox.textContent = '无法读取配置，请重新启动应用。';
});
form.addEventListener('submit', function (event) {
    event.preventDefault();
    button.disabled = true;
    errorBox.textContent = '';
    window.desktop.saveConfig(input.value).then(function (result) {
        if (result.error) errorBox.textContent = result.error;
    }).catch(function () {
        errorBox.textContent = '保存失败，请重新启动应用后重试。';
    }).finally(function () { button.disabled = false; });
});
