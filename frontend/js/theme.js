/**
 * theme.js — 全局主题切换
 *
 * 支持主题：
 *   - pure-white（纯白，默认）
 *   - aurora（梦幻极光）
 *   - glow-digital（微光数字）
 *   - glow-digital-dark（微光数字暗）
 *
 * 原理：
 *   纯白主题为项目原始配色，无需额外覆盖。
 *   其余主题通过在 <html> 上添加 data-theme 属性，
 *   配合 CSS 变量覆盖实现全局配色切换。
 *
 * 持久化：localStorage key = "app-theme"
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'app-theme';
    var THEMES = ['pure-white', 'aurora', 'glow-digital', 'glow-digital-dark'];
    var themeTransitionTimer = null;
    var pendingBlobTheme = null;
    var blobReadyBound = false;

    var THEME_TRANSITION_CSS = [
        'html.theme-color-transition,',
        'html.theme-color-transition body,',
        'html.theme-color-transition body::before,',
        'html.theme-color-transition body::after,',
        'html.theme-color-transition *,',
        'html.theme-color-transition *::before,',
        'html.theme-color-transition *::after {',
        '  transition-property: background-color, border-color, color, fill, stroke, box-shadow, opacity, filter, backdrop-filter, -webkit-backdrop-filter;',
        '  transition-duration: 320ms;',
        '  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);',
        '}',
        '@media (prefers-reduced-motion: reduce) {',
        '  html.theme-color-transition,',
        '  html.theme-color-transition body,',
        '  html.theme-color-transition body::before,',
        '  html.theme-color-transition body::after,',
        '  html.theme-color-transition *,',
        '  html.theme-color-transition *::before,',
        '  html.theme-color-transition *::after {',
        '    transition-duration: 1ms;',
        '  }',
        '}'
    ].join('\n');

    var AURORA_CSS = [
        '/* ========== 梦幻极光主题 ========== */',
        '[data-theme="aurora"] {',
        '  --aurora-bg: #0f0e17;',
        '  --aurora-surface: #1a1825;',
        '  --aurora-surface-2: #232032;',
        '  --aurora-border: #2d2a40;',
        '  --aurora-text: #e2e0f0;',
        '  --aurora-text-secondary: #a09bb8;',
        '  --aurora-text-muted: #6b6786;',
        '  --aurora-brand: #a78bfa;',
        '  --aurora-brand-hover: #c4b5fd;',
        '  --aurora-brand-light: rgba(167,139,250,0.12);',
        '  --aurora-accent: #f0abfc;',
        '  --table-head-row-tint: rgba(255,255,255,0.035);',
        '  --table-row-odd-tint: rgba(255,255,255,0.01);',
        '  --table-row-even-tint: rgba(167,139,250,0.075);',
        '  --table-row-hover-tint: rgba(167,139,250,0.16);',
        '}',
        /* body / main 背景 */
        '[data-theme="aurora"] body,',
        '[data-theme="aurora"] main { background-color: var(--aurora-bg) !important; color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] main.bg-\\[\\#f9fafb\\] { background-color: var(--aurora-bg) !important; }',
        /* 侧边栏 */
        '[data-theme="aurora"] aside { background-color: var(--aurora-surface) !important; border-color: var(--aurora-border) !important; }',
        '[data-theme="aurora"] aside h1 { color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] aside p { color: var(--aurora-text-muted) !important; }',
        '[data-theme="aurora"] .nav-link { color: var(--aurora-text-secondary) !important; }',
        '[data-theme="aurora"] .nav-link:hover { background-color: var(--aurora-surface-2) !important; color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] .nav-link .icon-base { color: var(--aurora-text-muted) !important; }',
        '[data-theme="aurora"] aside .border-gray-50,',
        '[data-theme="aurora"] aside .border-gray-100 { border-color: var(--aurora-border) !important; }',
        /* 卡片 / 面板 */
        '[data-theme="aurora"] .card,',
        '[data-theme="aurora"] .bg-white { background-color: var(--aurora-surface) !important; border-color: var(--aurora-border) !important; color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] .rounded-xl { border-color: var(--aurora-border) !important; }',
        /* 文本 */
        '[data-theme="aurora"] h1,',
        '[data-theme="aurora"] h2,',
        '[data-theme="aurora"] h3,',
        '[data-theme="aurora"] h4 { color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] .text-gray-800,',
        '[data-theme="aurora"] .text-gray-900 { color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] .text-gray-700 { color: var(--aurora-text-secondary) !important; }',
        '[data-theme="aurora"] .text-gray-600 { color: var(--aurora-text-secondary) !important; }',
        '[data-theme="aurora"] .text-gray-500 { color: var(--aurora-text-muted) !important; }',
        '[data-theme="aurora"] .text-gray-400 { color: var(--aurora-text-muted) !important; }',
        /* 输入框 */
        '[data-theme="aurora"] input,',
        '[data-theme="aurora"] select,',
        '[data-theme="aurora"] textarea:not(.shiba-chat-input) { background-color: var(--aurora-surface-2) !important; border-color: var(--aurora-border) !important; color: var(--aurora-text) !important; }',
        '[data-theme="aurora"] input::placeholder,',
        '[data-theme="aurora"] textarea:not(.shiba-chat-input)::placeholder { color: var(--aurora-text-muted) !important; }',
        '[data-theme="aurora"] input:focus,',
        '[data-theme="aurora"] select:focus,',
        '[data-theme="aurora"] textarea:not(.shiba-chat-input):focus { border-color: var(--aurora-brand) !important; box-shadow: 0 0 0 3px rgba(167,139,250,0.15) !important; }',
        /* 品牌色 */
        '[data-theme="aurora"] .text-brand-600 { color: var(--aurora-brand) !important; }',
        '[data-theme="aurora"] .text-brand-500 { color: var(--aurora-brand) !important; }',
        '[data-theme="aurora"] .bg-brand-600 { background-color: var(--aurora-brand) !important; }',
        '[data-theme="aurora"] .bg-brand-600:hover { background-color: var(--aurora-brand-hover) !important; }',
        '[data-theme="aurora"] .bg-brand-50 { background-color: var(--aurora-brand-light) !important; }',
        '[data-theme="aurora"] .border-brand-500 { border-color: var(--aurora-brand) !important; }',
        '[data-theme="aurora"] .border-brand-100 { border-color: rgba(167,139,250,0.3) !important; }',
        '[data-theme="aurora"] .shadow-brand-500\\/30 { box-shadow: 0 2px 8px rgba(167,139,250,0.25) !important; }',
        /* 表格 */
        '[data-theme="aurora"] table thead tr { background-color: var(--aurora-surface-2) !important; }',
        '[data-theme="aurora"] table tbody tr { border-color: var(--aurora-border) !important; }',
        '[data-theme="aurora"] table tbody tr:hover { background-color: var(--aurora-surface-2) !important; }',
        /* 阴影 */
        '[data-theme="aurora"] .shadow-soft { box-shadow: 0 4px 20px -2px rgba(0,0,0,0.3) !important; }',
        '[data-theme="aurora"] .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important; }',
        '[data-theme="aurora"] .shadow-md { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25) !important; }',
        '[data-theme="aurora"] .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3) !important; }',
        '[data-theme="aurora"] .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.35) !important; }',
        '[data-theme="aurora"] .shadow-2xl { box-shadow: -10px 0 30px -5px rgba(0,0,0,0.4) !important; }',
        /* 边框 */
        '[data-theme="aurora"] .border-gray-50 { border-color: var(--aurora-border) !important; }',
        '[data-theme="aurora"] .border-gray-100 { border-color: var(--aurora-border) !important; }',
        '[data-theme="aurora"] .border-gray-200 { border-color: var(--aurora-border) !important; }',
        /* 背景色辅助 */
        '[data-theme="aurora"] .bg-gray-50 { background-color: var(--aurora-surface-2) !important; }',
        '[data-theme="aurora"] .bg-gray-50\\/50 { background-color: rgba(35,32,50,0.5) !important; }',
        '[data-theme="aurora"] .bg-gray-50\\/80 { background-color: rgba(35,32,50,0.8) !important; }',
        '[data-theme="aurora"] .bg-gray-100 { background-color: var(--aurora-surface-2) !important; }',
        /* 滚动条 */
        '[data-theme="aurora"] ::-webkit-scrollbar-thumb { background: var(--aurora-border) !important; }',
        '[data-theme="aurora"] ::-webkit-scrollbar-thumb:hover { background: var(--aurora-text-muted) !important; }',
        /* 标签 tag */
        '[data-theme="aurora"] .tag { opacity: 0.85; }',
        /* select 下拉箭头颜色 */
        `[data-theme="aurora"] select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b6786'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E") !important; }`,
        /* 极光渐变背景装饰 */
        '[data-theme="aurora"] body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; background: radial-gradient(ellipse at 20% 0%, rgba(167,139,250,0.08), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(240,171,252,0.06), transparent 50%); }',
        '[data-theme="aurora"] main, [data-theme="aurora"] aside { position: relative; z-index: 1; }'
    ].join('\n');

    var GLOW_DIGITAL_CSS = [
        '/* ========== 微光数字主题 ========== */',
        '[data-theme="glow-digital"] {',
        '  --gd-bg: #f8fafc;',
        '  --gd-surface: rgba(255,255,255,0.72);',
        '  --gd-surface-solid: #ffffff;',
        '  --gd-surface-2: rgba(241,245,249,0.8);',
        '  --gd-border: rgba(148,163,184,0.25);',
        '  --gd-border-strong: rgba(148,163,184,0.4);',
        '  --gd-text: #1e293b;',
        '  --gd-text-secondary: #475569;',
        '  --gd-text-muted: #94a3b8;',
        '  --gd-brand: #6366f1;',
        '  --gd-brand-hover: #4f46e5;',
        '  --gd-brand-light: rgba(99,102,241,0.08);',
        '  --gd-accent-blue: #38bdf8;',
        '  --gd-accent-purple: #c084fc;',
        '  --table-head-row-tint: rgba(15,23,42,0.025);',
        '  --table-row-odd-tint: rgba(255,255,255,0.04);',
        '  --table-row-even-tint: rgba(99,102,241,0.045);',
        '  --table-row-hover-tint: rgba(56,189,248,0.1);',
        '}',
        /* 光晕动画背景层 */
        '[data-theme="glow-digital"] body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; overflow: hidden; filter: blur(60px); }',
        '[data-theme="glow-digital"] body::after { content: ""; position: fixed; top: -25%; left: -25%; width: 105%; height: 105%; border-radius: 50%; background-color: rgba(56,189,248,0.30); pointer-events: none; z-index: 0; filter: blur(60px); animation: gd-drift-1 10s infinite ease-in-out; }',
        /* 第二个光晕（紫色，右下角）用 body 内伪元素无法实现，改用注入的 div */
        /* body / main 背景 */
        '[data-theme="glow-digital"] body { background-color: var(--gd-bg) !important; color: var(--gd-text) !important; }',
        '[data-theme="glow-digital"] main { background-color: transparent !important; color: var(--gd-text) !important; position: relative; z-index: 1; }',
        '[data-theme="glow-digital"] main.bg-\\[\\#f9fafb\\] { background-color: transparent !important; }',
        /* 侧边栏 */
        '[data-theme="glow-digital"] aside { background-color: var(--gd-surface) !important; border-color: var(--gd-border) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }',
        '[data-theme="glow-digital"] aside h1 { color: var(--gd-text) !important; }',
        '[data-theme="glow-digital"] aside p { color: var(--gd-text-muted) !important; }',
        '[data-theme="glow-digital"] .nav-link { color: var(--gd-text-secondary) !important; }',
        '[data-theme="glow-digital"] .nav-link:hover { background-color: var(--gd-surface-2) !important; color: var(--gd-text) !important; }',
        '[data-theme="glow-digital"] .nav-link .icon-base { color: var(--gd-text-muted) !important; }',
        '[data-theme="glow-digital"] aside .border-gray-50,',
        '[data-theme="glow-digital"] aside .border-gray-100 { border-color: var(--gd-border) !important; }',
        /* 卡片 / 面板 —— 玻璃拟态 */
        '[data-theme="glow-digital"] .card,',
        '[data-theme="glow-digital"] .bg-white { background-color: var(--gd-surface) !important; border-color: var(--gd-border) !important; color: var(--gd-text) !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }',
        '[data-theme="glow-digital"] .rounded-xl { border-color: var(--gd-border) !important; }',
        /* 文本 */
        '[data-theme="glow-digital"] h1,',
        '[data-theme="glow-digital"] h2,',
        '[data-theme="glow-digital"] h3,',
        '[data-theme="glow-digital"] h4 { color: var(--gd-text) !important; }',
        '[data-theme="glow-digital"] .text-gray-800,',
        '[data-theme="glow-digital"] .text-gray-900 { color: var(--gd-text) !important; }',
        '[data-theme="glow-digital"] .text-gray-700 { color: var(--gd-text-secondary) !important; }',
        '[data-theme="glow-digital"] .text-gray-600 { color: var(--gd-text-secondary) !important; }',
        '[data-theme="glow-digital"] .text-gray-500 { color: var(--gd-text-muted) !important; }',
        '[data-theme="glow-digital"] .text-gray-400 { color: var(--gd-text-muted) !important; }',
        /* 输入框 */
        '[data-theme="glow-digital"] input,',
        '[data-theme="glow-digital"] select,',
        '[data-theme="glow-digital"] textarea:not(.shiba-chat-input) { background-color: var(--gd-surface-solid) !important; border-color: var(--gd-border-strong) !important; color: var(--gd-text) !important; }',
        '[data-theme="glow-digital"] input::placeholder,',
        '[data-theme="glow-digital"] textarea:not(.shiba-chat-input)::placeholder { color: var(--gd-text-muted) !important; }',
        '[data-theme="glow-digital"] input:focus,',
        '[data-theme="glow-digital"] select:focus,',
        '[data-theme="glow-digital"] textarea:not(.shiba-chat-input):focus { border-color: var(--gd-brand) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }',
        /* 品牌色 —— 蓝紫渐变感 */
        '[data-theme="glow-digital"] .text-brand-600 { color: var(--gd-brand) !important; }',
        '[data-theme="glow-digital"] .text-brand-500 { color: var(--gd-brand) !important; }',
        '[data-theme="glow-digital"] .bg-brand-600 { background-color: var(--gd-brand) !important; }',
        '[data-theme="glow-digital"] .bg-brand-600:hover { background-color: var(--gd-brand-hover) !important; }',
        '[data-theme="glow-digital"] .bg-brand-50 { background-color: var(--gd-brand-light) !important; }',
        '[data-theme="glow-digital"] .border-brand-500 { border-color: var(--gd-brand) !important; }',
        '[data-theme="glow-digital"] .border-brand-100 { border-color: rgba(99,102,241,0.2) !important; }',
        '[data-theme="glow-digital"] .border-brand-300 { border-color: rgba(99,102,241,0.35) !important; }',
        '[data-theme="glow-digital"] .shadow-brand-500\\/30 { box-shadow: 0 2px 8px rgba(99,102,241,0.2) !important; }',
        '[data-theme="glow-digital"] .shadow-blue-200 { box-shadow: 0 4px 6px -1px rgba(56,189,248,0.15) !important; }',
        /* 表格 */
        '[data-theme="glow-digital"] table thead tr { background-color: var(--gd-surface-2) !important; }',
        '[data-theme="glow-digital"] table tbody tr { border-color: var(--gd-border) !important; }',
        '[data-theme="glow-digital"] table tbody tr:hover { background-color: var(--gd-surface-2) !important; }',
        /* 阴影 —— 柔和蓝紫光晕 */
        '[data-theme="glow-digital"] .shadow-soft { box-shadow: 0 4px 24px -4px rgba(99,102,241,0.10), 0 2px 8px -2px rgba(56,189,248,0.08) !important; }',
        '[data-theme="glow-digital"] .shadow-sm { box-shadow: 0 1px 3px rgba(99,102,241,0.06) !important; }',
        '[data-theme="glow-digital"] .shadow-md { box-shadow: 0 4px 6px -1px rgba(99,102,241,0.08) !important; }',
        '[data-theme="glow-digital"] .shadow-lg { box-shadow: 0 10px 15px -3px rgba(99,102,241,0.10) !important; }',
        '[data-theme="glow-digital"] .shadow-xl { box-shadow: 0 20px 25px -5px rgba(99,102,241,0.12) !important; }',
        '[data-theme="glow-digital"] .shadow-2xl { box-shadow: -10px 0 30px -5px rgba(99,102,241,0.15) !important; }',
        /* 边框 */
        '[data-theme="glow-digital"] .border-gray-50 { border-color: var(--gd-border) !important; }',
        '[data-theme="glow-digital"] .border-gray-100 { border-color: var(--gd-border) !important; }',
        '[data-theme="glow-digital"] .border-gray-200 { border-color: var(--gd-border-strong) !important; }',
        /* 背景色辅助 */
        '[data-theme="glow-digital"] .bg-gray-50 { background-color: var(--gd-surface-2) !important; }',
        '[data-theme="glow-digital"] .bg-gray-50\\/50 { background-color: rgba(241,245,249,0.5) !important; }',
        '[data-theme="glow-digital"] .bg-gray-50\\/80 { background-color: rgba(241,245,249,0.7) !important; }',
        '[data-theme="glow-digital"] .bg-gray-100 { background-color: var(--gd-surface-2) !important; }',
        /* 滚动条 */
        '[data-theme="glow-digital"] ::-webkit-scrollbar-thumb { background: var(--gd-border-strong) !important; border-radius: 4px; }',
        '[data-theme="glow-digital"] ::-webkit-scrollbar-thumb:hover { background: var(--gd-text-muted) !important; }',
        /* select 下拉箭头颜色 */
        `[data-theme="glow-digital"] select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E") !important; }`,
        /* 光晕动画 keyframes */
        '@keyframes gd-drift-1 {',
        '  0% { transform: translate(0px,0px) scale(1) rotate(0deg); }',
        '  33% { transform: translate(40px,-60px) scale(1.15) rotate(120deg); }',
        '  66% { transform: translate(-30px,40px) scale(0.9) rotate(240deg); }',
        '  100% { transform: translate(0px,0px) scale(1) rotate(360deg); }',
        '}',
        '@keyframes gd-drift-2 {',
        '  0% { transform: translate(0px,0px) scale(1) rotate(0deg); }',
        '  33% { transform: translate(-50px,30px) scale(1.1) rotate(-120deg); }',
        '  66% { transform: translate(35px,-25px) scale(0.95) rotate(-240deg); }',
        '  100% { transform: translate(0px,0px) scale(1) rotate(-360deg); }',
        '}',
        /* 紫色光晕 div（通过 JS 注入 body 末尾） */
        '[data-theme="glow-digital"] #gd-glow-blob-purple { position: fixed; bottom: -25%; right: -25%; width: 105%; height: 105%; border-radius: 50%; background-color: rgba(192,132,252,0.30); pointer-events: none; z-index: 0; filter: blur(60px); animation: gd-drift-2 10s infinite ease-in-out; }'
    ].join('\n');

    var GLOW_DIGITAL_DARK_CSS = [
        '/* ========== 微光数字暗主题 ========== */',
        '[data-theme="glow-digital-dark"] {',
        '  --gdd-bg: #0b0f19;',
        '  --gdd-surface: rgba(15,23,42,0.72);',
        '  --gdd-surface-solid: #0f172a;',
        '  --gdd-surface-2: rgba(30,41,59,0.8);',
        '  --gdd-border: rgba(99,102,241,0.18);',
        '  --gdd-border-strong: rgba(99,102,241,0.3);',
        '  --gdd-text: #e2e8f0;',
        '  --gdd-text-secondary: #94a3b8;',
        '  --gdd-text-muted: #64748b;',
        '  --gdd-brand: #818cf8;',
        '  --gdd-brand-hover: #a5b4fc;',
        '  --gdd-brand-light: rgba(129,140,248,0.12);',
        '  --gdd-accent-blue: #38bdf8;',
        '  --gdd-accent-purple: #c084fc;',
        '  --table-head-row-tint: rgba(255,255,255,0.035);',
        '  --table-row-odd-tint: rgba(255,255,255,0.012);',
        '  --table-row-even-tint: rgba(129,140,248,0.08);',
        '  --table-row-hover-tint: rgba(56,189,248,0.14);',
        '}',
        /* 蓝色光晕（左上角，body::after） */
        '[data-theme="glow-digital-dark"] body::after { content: ""; position: fixed; top: -25%; left: -25%; width: 105%; height: 105%; border-radius: 50%; background-color: rgba(56,189,248,0.35); pointer-events: none; z-index: 0; filter: blur(60px); animation: gd-drift-1 10s infinite ease-in-out; }',
        /* body / main 背景 */
        '[data-theme="glow-digital-dark"] body { background-color: var(--gdd-bg) !important; color: var(--gdd-text) !important; }',
        '[data-theme="glow-digital-dark"] main { background-color: transparent !important; color: var(--gdd-text) !important; position: relative; z-index: 1; }',
        '[data-theme="glow-digital-dark"] main.bg-\\[\\#f9fafb\\] { background-color: transparent !important; }',
        /* 侧边栏 —— 暗色玻璃拟态 */
        '[data-theme="glow-digital-dark"] aside { background-color: var(--gdd-surface) !important; border-color: var(--gdd-border) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }',
        '[data-theme="glow-digital-dark"] aside h1 { color: var(--gdd-text) !important; }',
        '[data-theme="glow-digital-dark"] aside p { color: var(--gdd-text-muted) !important; }',
        '[data-theme="glow-digital-dark"] .nav-link { color: var(--gdd-text-secondary) !important; }',
        '[data-theme="glow-digital-dark"] .nav-link:hover { background-color: var(--gdd-surface-2) !important; color: var(--gdd-text) !important; }',
        '[data-theme="glow-digital-dark"] .nav-link .icon-base { color: var(--gdd-text-muted) !important; }',
        '[data-theme="glow-digital-dark"] aside .border-gray-50,',
        '[data-theme="glow-digital-dark"] aside .border-gray-100 { border-color: var(--gdd-border) !important; }',
        /* 卡片 / 面板 —— 暗色玻璃拟态 */
        '[data-theme="glow-digital-dark"] .card,',
        '[data-theme="glow-digital-dark"] .bg-white { background-color: var(--gdd-surface) !important; border-color: var(--gdd-border) !important; color: var(--gdd-text) !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }',
        '[data-theme="glow-digital-dark"] .rounded-xl { border-color: var(--gdd-border) !important; }',
        /* 文本 */
        '[data-theme="glow-digital-dark"] h1,',
        '[data-theme="glow-digital-dark"] h2,',
        '[data-theme="glow-digital-dark"] h3,',
        '[data-theme="glow-digital-dark"] h4 { color: var(--gdd-text) !important; }',
        '[data-theme="glow-digital-dark"] .text-gray-800,',
        '[data-theme="glow-digital-dark"] .text-gray-900 { color: var(--gdd-text) !important; }',
        '[data-theme="glow-digital-dark"] .text-gray-700 { color: var(--gdd-text-secondary) !important; }',
        '[data-theme="glow-digital-dark"] .text-gray-600 { color: var(--gdd-text-secondary) !important; }',
        '[data-theme="glow-digital-dark"] .text-gray-500 { color: var(--gdd-text-muted) !important; }',
        '[data-theme="glow-digital-dark"] .text-gray-400 { color: var(--gdd-text-muted) !important; }',
        /* 输入框 */
        '[data-theme="glow-digital-dark"] input,',
        '[data-theme="glow-digital-dark"] select,',
        '[data-theme="glow-digital-dark"] textarea:not(.shiba-chat-input) { background-color: var(--gdd-surface-solid) !important; border-color: var(--gdd-border-strong) !important; color: var(--gdd-text) !important; }',
        '[data-theme="glow-digital-dark"] input::placeholder,',
        '[data-theme="glow-digital-dark"] textarea:not(.shiba-chat-input)::placeholder { color: var(--gdd-text-muted) !important; }',
        '[data-theme="glow-digital-dark"] input:focus,',
        '[data-theme="glow-digital-dark"] select:focus,',
        '[data-theme="glow-digital-dark"] textarea:not(.shiba-chat-input):focus { border-color: var(--gdd-brand) !important; box-shadow: 0 0 0 3px rgba(129,140,248,0.15) !important; }',
        /* 品牌色 —— 靛蓝 + 蓝紫 */
        '[data-theme="glow-digital-dark"] .text-brand-600 { color: var(--gdd-brand) !important; }',
        '[data-theme="glow-digital-dark"] .text-brand-500 { color: var(--gdd-brand) !important; }',
        '[data-theme="glow-digital-dark"] .bg-brand-600 { background-color: var(--gdd-brand) !important; }',
        '[data-theme="glow-digital-dark"] .bg-brand-600:hover { background-color: var(--gdd-brand-hover) !important; }',
        '[data-theme="glow-digital-dark"] .bg-brand-50 { background-color: var(--gdd-brand-light) !important; }',
        '[data-theme="glow-digital-dark"] .border-brand-500 { border-color: var(--gdd-brand) !important; }',
        '[data-theme="glow-digital-dark"] .border-brand-100 { border-color: rgba(129,140,248,0.25) !important; }',
        '[data-theme="glow-digital-dark"] .border-brand-300 { border-color: rgba(129,140,248,0.4) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-brand-500\\/30 { box-shadow: 0 2px 8px rgba(129,140,248,0.25) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-blue-200 { box-shadow: 0 4px 6px -1px rgba(56,189,248,0.15) !important; }',
        /* 表格 */
        '[data-theme="glow-digital-dark"] table thead tr { background-color: var(--gdd-surface-2) !important; }',
        '[data-theme="glow-digital-dark"] table tbody tr { border-color: var(--gdd-border) !important; }',
        '[data-theme="glow-digital-dark"] table tbody tr:hover { background-color: var(--gdd-surface-2) !important; }',
        /* 阴影 —— 深色 + 蓝紫光晕 */
        '[data-theme="glow-digital-dark"] .shadow-soft { box-shadow: 0 4px 24px -4px rgba(0,0,0,0.4), 0 2px 8px -2px rgba(99,102,241,0.10) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-md { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.35) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.45) !important; }',
        '[data-theme="glow-digital-dark"] .shadow-2xl { box-shadow: -10px 0 30px -5px rgba(0,0,0,0.5) !important; }',
        /* 边框 */
        '[data-theme="glow-digital-dark"] .border-gray-50 { border-color: var(--gdd-border) !important; }',
        '[data-theme="glow-digital-dark"] .border-gray-100 { border-color: var(--gdd-border) !important; }',
        '[data-theme="glow-digital-dark"] .border-gray-200 { border-color: var(--gdd-border-strong) !important; }',
        /* 背景色辅助 */
        '[data-theme="glow-digital-dark"] .bg-gray-50 { background-color: var(--gdd-surface-2) !important; }',
        '[data-theme="glow-digital-dark"] .bg-gray-50\\/50 { background-color: rgba(30,41,59,0.5) !important; }',
        '[data-theme="glow-digital-dark"] .bg-gray-50\\/80 { background-color: rgba(30,41,59,0.7) !important; }',
        '[data-theme="glow-digital-dark"] .bg-gray-100 { background-color: var(--gdd-surface-2) !important; }',
        /* 滚动条 */
        '[data-theme="glow-digital-dark"] ::-webkit-scrollbar-thumb { background: var(--gdd-border-strong) !important; border-radius: 4px; }',
        '[data-theme="glow-digital-dark"] ::-webkit-scrollbar-thumb:hover { background: var(--gdd-text-muted) !important; }',
        /* select 下拉箭头颜色 */
        `[data-theme="glow-digital-dark"] select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E") !important; }`,
        /* 紫色光晕 div（右下角，通过 JS 注入 body 末尾） */
        '[data-theme="glow-digital-dark"] #gdd-glow-blob-purple { position: fixed; bottom: -25%; right: -25%; width: 105%; height: 105%; border-radius: 50%; background-color: rgba(192,132,252,0.35); pointer-events: none; z-index: 0; filter: blur(60px); animation: gd-drift-2 10s infinite ease-in-out; }'
    ].join('\n');

    /** 当前主题 */
    function getTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'pure-white';
        } catch (e) {
            return 'pure-white';
        }
    }

    function beginThemeTransition() {
        var html = document.documentElement;
        clearTimeout(themeTransitionTimer);
        html.classList.add('theme-color-transition');
        // 先让浏览器吃到 transition 规则，再切换 data-theme。
        void html.offsetHeight;
        themeTransitionTimer = setTimeout(function () {
            html.classList.remove('theme-color-transition');
        }, 420);
    }

    function syncThemeBlobs(theme) {
        if (!document.body) {
            pendingBlobTheme = theme;
            if (!blobReadyBound) {
                blobReadyBound = true;
                document.addEventListener('DOMContentLoaded', function () {
                    blobReadyBound = false;
                    syncThemeBlobs(pendingBlobTheme || getTheme());
                }, { once: true });
            }
            return;
        }

        pendingBlobTheme = null;

        // 管理微光数字(亮)的紫色光晕 div
        var blobLight = document.getElementById('gd-glow-blob-purple');
        if (theme === 'glow-digital') {
            if (!blobLight) {
                blobLight = document.createElement('div');
                blobLight.id = 'gd-glow-blob-purple';
                document.body.appendChild(blobLight);
            }
        } else {
            if (blobLight) blobLight.remove();
        }

        // 管理微光数字(暗)的紫色光晕 div
        var blobDark = document.getElementById('gdd-glow-blob-purple');
        if (theme === 'glow-digital-dark') {
            if (!blobDark) {
                blobDark = document.createElement('div');
                blobDark.id = 'gdd-glow-blob-purple';
                document.body.appendChild(blobDark);
            }
        } else {
            if (blobDark) blobDark.remove();
        }
    }

    /** 应用主题 */
    function applyTheme(theme, options) {
        if (THEMES.indexOf(theme) === -1) theme = 'pure-white';
        var html = document.documentElement;
        var previousTheme = html.getAttribute('data-theme') || 'pure-white';
        var shouldAnimate = !options || !options.skipTransition;
        if (shouldAnimate && previousTheme !== theme) {
            beginThemeTransition();
        }

        if (theme === 'aurora') {
            html.setAttribute('data-theme', 'aurora');
        } else if (theme === 'glow-digital') {
            html.setAttribute('data-theme', 'glow-digital');
        } else if (theme === 'glow-digital-dark') {
            html.setAttribute('data-theme', 'glow-digital-dark');
        } else {
            html.removeAttribute('data-theme');
        }

        syncThemeBlobs(theme);
        try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
        // 通知其他监听者
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    }

    /** 注入主题过渡 CSS（仅一次） */
    function injectThemeTransitionCSS() {
        if (document.getElementById('theme-transition-css')) return;
        var style = document.createElement('style');
        style.id = 'theme-transition-css';
        style.textContent = THEME_TRANSITION_CSS;
        document.head.appendChild(style);
    }

    /** 注入极光主题 CSS（仅一次） */
    function injectAuroraCSS() {
        if (document.getElementById('aurora-theme-css')) return;
        var style = document.createElement('style');
        style.id = 'aurora-theme-css';
        style.textContent = AURORA_CSS;
        document.head.appendChild(style);
    }

    /** 注入微光数字主题 CSS（仅一次） */
    function injectGlowDigitalCSS() {
        if (document.getElementById('glow-digital-theme-css')) return;
        var style = document.createElement('style');
        style.id = 'glow-digital-theme-css';
        style.textContent = GLOW_DIGITAL_CSS;
        document.head.appendChild(style);
    }

    /** 注入微光数字暗主题 CSS（仅一次） */
    function injectGlowDigitalDarkCSS() {
        if (document.getElementById('glow-digital-dark-theme-css')) return;
        var style = document.createElement('style');
        style.id = 'glow-digital-dark-theme-css';
        style.textContent = GLOW_DIGITAL_DARK_CSS;
        document.head.appendChild(style);
    }

    /** 初始化 */
    function init() {
        injectThemeTransitionCSS();
        injectAuroraCSS();
        injectGlowDigitalCSS();
        injectGlowDigitalDarkCSS();
        applyTheme(getTheme(), { skipTransition: true });
    }

    // 暴露 API
    window.AppTheme = {
        get: getTheme,
        set: applyTheme,
        themes: THEMES
    };

    // 立即初始化
    init();
})();
