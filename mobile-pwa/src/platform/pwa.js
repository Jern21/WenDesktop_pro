/** 仅网站构建引用；Android 构建不会解析或打包这个模块。 */
import { registerSW } from 'virtual:pwa-register';

export function startPlatform() {
    registerSW({ immediate: true });
}
