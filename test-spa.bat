@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo   核心层冒烟测试
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 node，请先安装 Node.js 18+
    pause
    exit /b 1
)

node "%~dp0tools\verify-consistency.js"
echo.

node "%~dp0frontend\test\core.smoke.js"

if errorlevel 1 (
    echo.
    echo [结果] 有测试未通过
) else (
    echo.
    echo [结果] 全部通过
)

echo.
echo 浏览器端回归请访问（需先启动服务）：
echo   http://localhost:3456/test/routes-smoke.html       ^(全路由冒烟：18 条路由 x 2 轮^)
echo   http://localhost:3456/test/deeplink.html           ^(深链接/刷新：11 项^)
echo   http://localhost:3456/test/migration-verify.html   ^(迁移行为验证 28 项^)
echo   http://localhost:3456/test/spa-autotest.html       ^(核心层 13 项^)
echo   http://localhost:3456/test/app-interaction.html    ^(备忘页交互 17 项^)
echo   http://localhost:3456/test/platform-posts.html     ^(平台页 x3 共 17 项^)
echo   http://localhost:3456/test/bookmarks.html          ^(收藏页 15 项^)
echo.
echo 新入口（18 条路由已全部迁移到 SPA）：
echo   http://localhost:3456/app.html
echo.
echo 注意：/ 目前仍是旧入口。要正式切到新 SPA，见 docs/架构重构方案.md 第三节。
echo.
pause
