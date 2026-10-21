/**
 * 数据目录解析（单一来源）
 *
 * 优先级：APP_DATA_DIR 环境变量 > backend/data
 *
 * 为什么要抽这一层：
 *   1. **测试**：要验证「接口写完盘上是不是密文」，必须把整个后端指向临时目录，
 *      否则每跑一次测试就把真实数据洗一遍。
 *   2. **部署**：数据要放到持久化卷（如 /var/lib/xxx/data）时，改一个环境变量即可，
 *      不用满仓库找 path.join(__dirname, '..', '..', 'data')。
 *
 * 之前 7 个文件各自写死了同一个路径，改一处漏一处；现在统一从这里取。
 */
'use strict';

var path = require('path');

var DATA_DIR = process.env.APP_DATA_DIR || path.join(__dirname, '..', '..', 'data');

module.exports = {
    DATA_DIR: DATA_DIR,
    BACKUP_DIR: path.join(DATA_DIR, 'backups'),
    UPLOADS_DIR: path.join(DATA_DIR, 'uploads'),
    /** 取数据文件的绝对路径，如 file('accounts.json') */
    file: function (name) {
        return path.join(DATA_DIR, name);
    }
};
