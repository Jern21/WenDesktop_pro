/** Android 平台唯一入口，业务页面不直接依赖原生插件。 */
import { App } from '@capacitor/app';
import { getPath, goBack } from '../../router.js';
import { matchRoute } from '../../config/routes.js';

var started = false;

function handleBack() {
    // 页面可取消此事件并自行关闭特殊弹层，无需反向引用具体页面。
    if (!window.dispatchEvent(new Event('android-back', { cancelable: true }))) return;
    var dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    var dialog = dialogs[dialogs.length - 1];
    if (dialog) {
        var cancel = dialog.querySelector('[data-act="cancel"]');
        if (cancel) cancel.click();
        // 未识别的模态框保持原位，避免后台页面被系统返回键切走。
        return;
    }
    var path = getPath();
    if (path === '/' || path === '/login') {
        App.minimizeApp().catch(reportError);
        return;
    }
    goBack(matchRoute(path).parent || '/');
}

function reportError(error) {
    console.error('[android]', error);
}

export function startPlatform() {
    if (started) return;
    started = true;
    App.addListener('backButton', handleBack).catch(reportError);
}
