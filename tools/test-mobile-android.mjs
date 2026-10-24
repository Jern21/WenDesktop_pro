/** 实际检查 Android 构建产物，阻止 PWA 缓存/清单混入安装包。 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertAndroidAssets(directory) {
    var html = readFileSync(join(directory, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /rel=["']manifest["']|registerSW|registerSW\.js/);
    var checked = 0;
    function inspect(folder) {
        readdirSync(folder, { withFileTypes: true }).forEach(function (entry) {
            var path = join(folder, entry.name);
            if (entry.isDirectory()) return inspect(path);
            assert.doesNotMatch(entry.name, /^(sw\.js|registerSW\.js|workbox-.*)|\.webmanifest$/i);
            if (/\.(js|html)$/.test(entry.name)) {
                assert.doesNotMatch(readFileSync(path, 'utf8'),
                    /navigator\.serviceWorker\.register|workbox-window|virtual:pwa-register/);
            }
            checked += 1;
        });
    }
    inspect(directory);
    console.log('Android 隔离检查通过：' + checked + ' 个产物，无 PWA 清单和 Service Worker');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assertAndroidAssets(fileURLToPath(new URL('../mobile-pwa/dist-android/', import.meta.url)));
}
