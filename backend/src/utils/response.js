/**
 * 统一响应格式工具
 *
 * 成功：{ success: true, data: ... }
 * 失败：{ success: false, error: "...", code: ... }
 */
'use strict';

function success(res, data, status) {
    return res.status(status || 200).json({
        success: true,
        data: data
    });
}

function error(res, message, status) {
    return res.status(status || 400).json({
        success: false,
        error: message
    });
}

function notFound(res, message) {
    return res.status(404).json({
        success: false,
        error: message || '资源不存在'
    });
}

/**
 * 包装异步路由处理函数，自动捕获异常
 *
 * 两个细节都不能省：
 *
 * 1) **必须在 promise 链里调用 fn**。
 *    写成 `Promise.resolve(fn(req, res, next))` 时，fn 是**同步执行**的 ——
 *    只要它在返回 promise 之前抛错（业务校验失败就是这种情况），
 *    异常在进入 .catch() 之前就已经逸出，落到 Express 默认错误页：
 *    返回 HTML + 完整堆栈（信息泄露），前端 res.json() 直接解析失败。
 *
 * 2) **抛出物上带 status 时按该状态码返回**（例如 OrderPayloadError 带 400）。
 *    业务校验失败不该被当成「服务器内部错误」——前端拿 500 会弹"服务器异常"，
 *    日志里 400 和真正的故障也会混在一起，排查时误判。
 */
function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve()
            .then(function () { return fn(req, res, next); })
            .catch(function (err) {
                console.error('[API Error]', err);
                if (res.headersSent) return next(err);
                var status = (err && typeof err.status === 'number') ? err.status : 500;
                res.status(status).json({
                    success: false,
                    error: (err && err.message) || '服务器内部错误'
                });
            });
    };
}

module.exports = {
    success: success,
    error: error,
    notFound: notFound,
    asyncHandler: asyncHandler
};
