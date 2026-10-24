/** Android 构建入口：只读取独立产物，绝不复制 PWA 的 dist。 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertAndroidAssets } from './test-mobile-android.mjs';

var root = fileURLToPath(new URL('../mobile-pwa/', import.meta.url));
var action = process.argv[2] || 'build';

function runNode(relative, args) {
    var result = spawnSync(process.execPath, [relative].concat(args), {
        cwd: root, stdio: 'inherit', env: process.env
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('命令执行失败：' + relative);
}

try {
    if (['build', 'sync', 'open', 'apk'].indexOf(action) === -1) {
        throw new Error('用法：node tools/mobile-android.mjs build|sync|open|apk');
    }
    runNode('node_modules/vite/bin/vite.js', ['build', '--mode', 'android']);
    assertAndroidAssets(root + 'dist-android');
    if (action !== 'build') {
        if (!existsSync(root + 'android')) {
            runNode('node_modules/@capacitor/cli/bin/capacitor', ['add', 'android']);
        }
        runNode('node_modules/@capacitor/cli/bin/capacitor', ['sync', 'android']);
    }
    if (action === 'open') {
        runNode('node_modules/@capacitor/cli/bin/capacitor', ['open', 'android']);
    }
    if (action === 'apk') {
        var windows = process.platform === 'win32';
        var result = spawnSync(windows ? 'cmd.exe' : './gradlew',
            windows ? ['/d', '/c', 'gradlew.bat assembleDebug'] : ['assembleDebug'],
            { cwd: root + 'android', stdio: 'inherit', env: process.env });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error('APK 编译失败，请检查 JDK、Android SDK 与 Gradle 下载');
        console.log('APK：mobile-pwa/android/app/build/outputs/apk/debug/app-debug.apk');
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
