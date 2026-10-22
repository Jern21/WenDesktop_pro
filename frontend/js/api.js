/**
 * 统一 API 封装层
 *
 * 功能：
 *   - 统一 baseURL 配置
 *   - 自动 JSON 序列化/反序列化
 *   - 统一错误处理
 *   - 请求/响应拦截器
 *   - 支持 loading 状态自动管理
 *   - 支持全局错误提示
 *
 * 用法：
 *   api.get('/orders')                    // GET 请求
 *   api.post('/orders', data)             // POST 请求
 *   api.put('/orders/123', data)          // PUT 请求
 *   api.delete('/orders/123')             // DELETE 请求
 *   api.request({ url, method, data })    // 自定义请求
 */
(function () {
    'use strict';

    // ========== 配置 ==========
    var CONFIG = {
        baseURL: '',  // 空表示使用相对路径
        timeout: 30000,  // 30秒超时（每次尝试单独计时）
        retryCount: 1,   // 失败重试次数（仅对幂等方法生效）
        retryDelay: 1000 // 重试间隔(ms)
    };

    /**
     * 只有幂等方法才允许自动重试。
     *
     * 写请求绝不能盲目重试：服务端可能已经把记录写进去了，
     * 只是响应在回程丢了 —— 这时候重试就会**重复创建一条记录**。
     * 订单、付款、客户这类数据重复一条，比报个错难查得多。
     *
     * 确实幂等的写请求（例如整体覆盖式的 PUT）可以显式传 retryUnsafe: true。
     */
    var RETRYABLE_METHODS = { GET: true, HEAD: true, OPTIONS: true };

    // ========== 拦截器 ==========
    var interceptors = {
        request: [],
        response: [],
        error: []
    };

    // ========== 工具函数 ==========

    /**
     * 合并 URL
     */
    function mergeURL(url) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        var base = CONFIG.baseURL || '';
        if (base && base.endsWith('/')) base = base.slice(0, -1);
        if (url && !url.startsWith('/')) url = '/' + url;
        return base + url;
    }

    /**
     * 延迟函数
     */
    function delay(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    /**
     * 执行拦截器链
     */
    function runInterceptors(type, data) {
        var chain = interceptors[type];
        var result = data;
        for (var i = 0; i < chain.length; i++) {
            try {
                result = chain[i](result);
                // 支持异步拦截器
                if (result && typeof result.then === 'function') {
                    return result;
                }
            } catch (e) {
                console.error('Interceptor error:', e);
            }
        }
        return result;
    }

    // ========== 核心请求函数 ==========

    /**
     * 决定这次请求最多重试几次
     *
     * ⚠️ 这里必须用「有没有传」来判断，不能用 `config.retryCount || CONFIG.retryCount`：
     * 那样 `retryCount: 0`（明确表示不重试）会被静默换成默认值 1，
     * 等于这个开关根本关不掉。
     */
    function resolveRetryCount(config, method) {
        if (!RETRYABLE_METHODS[method] && config.retryUnsafe !== true) return 0;

        if (config.retryCount === undefined || config.retryCount === null) {
            return CONFIG.retryCount;
        }
        var n = parseInt(config.retryCount, 10);
        return (isNaN(n) || n < 0) ? 0 : n;
    }

    /**
     * 单次尝试的超时时间；<= 0 表示不设超时
     */
    function resolveTimeout(config) {
        var raw = config.timeout !== undefined && config.timeout !== null
            ? config.timeout
            : CONFIG.timeout;
        var ms = parseInt(raw, 10);
        return (isNaN(ms) || ms <= 0) ? 0 : ms;
    }

    /**
     * 发起 HTTP 请求
     */
    function request(config) {
        config = config || {};

        // 标准化配置
        if (typeof config === 'string') {
            config = { url: config, method: 'GET' };
        }

        var url = mergeURL(config.url || '');
        var method = (config.method || 'GET').toUpperCase();
        var data = config.data;
        var options = config.options || {};

        // 请求拦截
        var interceptedConfig = runInterceptors('request', {
            url: url,
            method: method,
            data: data,
            headers: Object.assign({
                'Accept': 'application/json'
            }, options.headers || {})
        });

        // 重试次数与超时要按「最终生效的方法」算：
        // 请求拦截器有权改写 method（比如把 POST 改成 PUT），必须听改后的。
        var retries = resolveRetryCount(config, String(interceptedConfig.method || method).toUpperCase());
        var timeoutMs = resolveTimeout(config);
        var signal = config.signal || null;

        // 处理异步拦截器结果
        if (interceptedConfig && typeof interceptedConfig.then === 'function') {
            return interceptedConfig.then(function (cfg) {
                return doRequest(cfg, retries, timeoutMs, signal);
            });
        }

        return doRequest(interceptedConfig, retries, timeoutMs, signal);
    }

    /**
     * 执行实际请求（支持重试 / 超时 / 外部取消）
     *
     * @param {Object} config     - 已过请求拦截器的配置
     * @param {number} retriesLeft - 剩余重试次数
     * @param {number} timeoutMs   - 单次尝试超时（0 = 不限）
     * @param {AbortSignal} [externalSignal] - 调用方的 signal（切页时主动取消）
     */
    function doRequest(config, retriesLeft, timeoutMs, externalSignal) {
        var url = config.url;
        var method = config.method;
        var data = config.data;
        var headers = config.headers;

        // 准备 fetch 选项
        var fetchOptions = {
            method: method,
            headers: headers,
            credentials: 'same-origin'
        };

        // ---- 超时与取消 ----
        // 用一个内部 controller，把「超时」和「调用方取消」都汇到它身上；
        // fetch 只认一个 signal，所以外部 signal 要转发进来。
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeoutId = null;
        var timedOut = false;

        if (controller) {
            fetchOptions.signal = controller.signal;

            if (timeoutMs > 0) {
                timeoutId = setTimeout(function () {
                    timedOut = true;
                    controller.abort();
                }, timeoutMs);
            }

            if (externalSignal && typeof externalSignal.addEventListener === 'function') {
                if (externalSignal.aborted) {
                    clearTimeout(timeoutId);
                    controller.abort();
                } else {
                    externalSignal.addEventListener('abort', function () {
                        clearTimeout(timeoutId);
                        controller.abort();
                    }, { once: true });
                }
            }
        } else if (externalSignal) {
            fetchOptions.signal = externalSignal;
        }

        function cleanup() {
            if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        }

        // 处理请求体
        if (data !== undefined && data !== null) {
            if (method === 'GET' || method === 'HEAD') {
                // GET 请求将 data 转为 query string
                var params = new URLSearchParams();
                if (typeof data === 'object') {
                    Object.keys(data).forEach(function (key) {
                        params.append(key, data[key]);
                    });
                }
                var qs = params.toString();
                if (qs) url = url + (url.indexOf('?') > -1 ? '&' : '?') + qs;
            } else {
                // POST/PUT/DELETE 请求
                if (typeof data === 'object' && !(data instanceof FormData)) {
                    fetchOptions.body = JSON.stringify(data);
                    headers['Content-Type'] = 'application/json';
                } else {
                    fetchOptions.body = data;
                }
            }
        }

        // 发起请求
        return fetch(url, fetchOptions)
            .then(function (response) {
                cleanup();
                // 响应拦截
                return runInterceptors('response', response);
            })
            .then(function (response) {
                // 解析响应
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                // 根据 Content-Type 解析
                var contentType = response.headers.get('content-type') || '';
                if (contentType.indexOf('application/json') > -1) {
                    return response.json();
                }
                return response.text();
            })
            .catch(function (error) {
                cleanup();

                // 错误拦截
                var interceptedError = runInterceptors('error', error);

                // 超时：换成可读的错误，避免抛出浏览器那句 "This operation was aborted"
                if (timedOut) {
                    var timeoutError = new Error(
                        '请求超时（' + timeoutMs + 'ms）：' + method + ' ' + url
                    );
                    timeoutError.code = 'ETIMEDOUT';
                    timeoutError.timeout = timeoutMs;
                    throw timeoutError;
                }

                // 调用方主动取消：这是它的意图，不能重试（否则等于无视取消）
                if (error && error.name === 'AbortError') {
                    throw interceptedError || error;
                }

                // 重试逻辑（走不到这里说明 retriesLeft 已经按方法判定过了）
                if (retriesLeft > 0) {
                    return delay(CONFIG.retryDelay).then(function () {
                        return doRequest(config, retriesLeft - 1, timeoutMs, externalSignal);
                    });
                }

                throw interceptedError || error;
            });
    }

    // ========== 快捷方法 ==========

    /**
     * 快捷方法的 options 除 headers 外，还接受：
     *   timeout     本次超时(ms)
     *   signal      AbortSignal，切页/重开时主动取消
     *   retryCount  本次重试次数（0 = 不重试）
     *   retryUnsafe 写请求确实幂等时，显式允许重试
     */
    function buildConfig(method, url, data, options) {
        options = options || {};
        return {
            url: url,
            method: method,
            data: data,
            options: options,
            timeout: options.timeout,
            signal: options.signal,
            retryCount: options.retryCount,
            retryUnsafe: options.retryUnsafe
        };
    }

    function get(url, params, options) {
        return request(buildConfig('GET', url, params, options));
    }

    function post(url, data, options) {
        return request(buildConfig('POST', url, data, options));
    }

    function put(url, data, options) {
        return request(buildConfig('PUT', url, data, options));
    }

    function del(url, options) {
        return request(buildConfig('DELETE', url, null, options));
    }

    /**
     * 接近 fetch 的调用方式，给从局部 api()/fetch 迁过来的页面用。
     * body 传对象即可（不要先 JSON.stringify，否则会变成普通字符串）。
     */
    function call(url, options) {
        options = options || {};
        var method = String(options.method || 'GET').toUpperCase();
        var extra = {
            headers: options.headers,
            timeout: options.timeout,
            signal: options.signal,
            retryCount: options.retryCount,
            retryUnsafe: options.retryUnsafe
        };
        var data = options.body;
        if (method === 'GET' || method === 'HEAD') {
            return get(url, null, extra);
        }
        if (method === 'POST') return post(url, data, extra);
        if (method === 'PUT') return put(url, data, extra);
        if (method === 'DELETE') return del(url, extra);
        return request(buildConfig(method, url, data, extra));
    }

    // ========== 拦截器注册 ==========

    function addRequestInterceptor(fn) {
        interceptors.request.push(fn);
    }

    function addResponseInterceptor(fn) {
        interceptors.response.push(fn);
    }

    function addErrorInterceptor(fn) {
        interceptors.error.push(fn);
    }

    // ========== 配置 ==========

    function setConfig(newConfig) {
        Object.assign(CONFIG, newConfig);
    }

    // ========== 暴露 API ==========

    window.api = {
        request: request,
        call: call,
        get: get,
        post: post,
        put: put,
        delete: del,
        config: setConfig,
        interceptors: {
            request: addRequestInterceptor,
            response: addResponseInterceptor,
            error: addErrorInterceptor
        }
    };

})();
