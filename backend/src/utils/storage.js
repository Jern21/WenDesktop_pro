/**
 * JSON 文件存储工具
 *
 * 提供对 data/ 目录下 JSON 文件的通用 CRUD 操作。
 * 所有数据文件都以 { id: string, ...fields } 的数组形式存储。
 *
 * 用法：
 *   const Storage = require('./storage');
 *   const orders = new Storage('orders');
 *   const all = orders.findAll();
 *   const one = orders.findById('123');
 *   const created = orders.create({ name: 'test' });
 *   const updated = orders.update('123', { name: 'new' });
 *   orders.remove('123');
 */
'use strict';

const fs = require('fs');
const dataBackups = require('./data-backups');

/**
 * 生成唯一 ID（时间戳 + 随机串）
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 数据文件读取失败（损坏 / 无权限 / 结构不对）时抛出。
 *
 * 为什么要单独一个错误类型：调用方（路由层）需要把「文件坏了」和
 * 「业务逻辑出错」区分开 —— 前者必须立刻停止写入并提示人工介入，
 * 绝不能像以前那样静默返回空数组、让后续写入把原文件覆盖掉。
 */
class StorageError extends Error {
    constructor(fileName, filePath, cause) {
        super('数据文件读取失败：' + fileName + '.json（' + (cause && cause.message) + '）');
        this.name = 'StorageError';
        this.fileName = fileName;
        this.filePath = filePath;
        this.cause = cause;
    }
}

class Storage {
    /**
     * @param {string} fileName - 文件名（不含 .json 后缀）
     */
    constructor(fileName) {
        this.fileName = fileName;
        // ⚠️ 这里**不能**把路径算出来存成属性。
        //
        // 所有 Storage 实例都是「模块加载时」创建的（routes 顶层的
        // `var orders = new Storage('orders')`），那一刻请求还没进来、
        // userContext 是空的 —— 一旦在构造时固化 filePath，
        // 它就会永久指向根目录 data/，此后**所有用户都读写同一份根目录文件**，
        // 用户隔离直接失效（表现：trial 登录进去订单/客户/海报全是 0 条，
        // 而 users/trial/*.json 里明明有数据）。
        //
        // 所以路径必须每次用时现算（见下面的 filePath getter）。
    }

    /**
     * 当前用户的数据文件绝对路径 —— **动态解析**。
     *
     * 用 getter 而不是在构造时赋值：userContext 是「每个请求」切换的，
     * 路径也必须跟着请求走。写路径同理（data-backups 每次都会
     * ensureDir(getActiveDataDir())，所以这里不需要预先建目录）。
     */
    get filePath() {
        return dataBackups.getDataFilePath(this.fileName);
    }

    /**
     * 确保数据文件存在，不存在则创建空数组
     *
     * ⚠️ 不要把它挪回 constructor。
     * 模块加载时 userContext 是空的，那时建文件会在**根目录**造一堆空 json，
     * 而且建出来的那份跟用户实际读写的那份不是同一个文件。
     * 现在写路径自己会建目录（`data-backups.writeJsonFile` 里 ensureDir），
     * 读路径对「文件不存在」返回空数组，所以不需要提前建。
     */
    _ensureFile() {
        if (!fs.existsSync(this.filePath)) {
            this._write([], { backup: false });
        }
    }

    /**
     * 读取整个 JSON 数组
     *
     * ⚠️ 这里刻意「读不懂就抛」，不再 catch 成 []。
     * 返空数组会被 create/update/remove 当成「当前没有数据」，
     * 于是下一次写入就用新数据覆盖整个文件 ——
     * 把「数据损坏」伪装成「没有数据」，且全程没有任何告警、没有中断。
     * 正确做法是让异常一路抛到响应层，宁可报 500 也不要静默毁数据。
     *
     * 只有「文件不存在」和「文件是空的」这两种情况才算真的没有数据。
     *
     * @returns {Array}
     * @throws {StorageError}
     */
    _read() {
        if (!fs.existsSync(this.filePath)) return [];

        let raw;
        try {
            raw = fs.readFileSync(this.filePath, 'utf-8');
        } catch (e) {
            throw new StorageError(this.fileName, this.filePath, e);
        }

        // 空文件：可能是写入过程被打断，按空数据处理（此时确实没有可丢的内容）
        if (raw.trim() === '') {
            console.warn('[Storage] 数据文件为空，按空数据处理:', this.filePath);
            return [];
        }

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            throw new StorageError(this.fileName, this.filePath, e);
        }

        if (!Array.isArray(data)) {
            throw new StorageError(
                this.fileName,
                this.filePath,
                new Error('顶层结构不是数组，实际为 ' + (data === null ? 'null' : typeof data))
            );
        }
        return data;
    }

    /**
     * 写入 JSON 数组
     * @param {Array} data
     */
    _write(data, options) {
        options = options || {};
        if (!Array.isArray(data)) {
            throw new Error('Storage 只能写入数组数据: ' + this.fileName);
        }

        try {
            dataBackups.writeJsonFile(this.fileName, data, options);
        } catch (e) {
            console.error('[Storage] 写入文件失败:', this.filePath, e.message);
            throw e;
        }
    }

    /**
     * 写入前备份当前数据文件，并保留最近 MAX_BACKUPS_PER_FILE 份。
     */
    _backupCurrentFile() {
        return dataBackups.createBackup(this.fileName);
    }

    /**
     * 手动列出备份，便于后续恢复工具使用。
     */
    listBackups() {
        return dataBackups.listBackups(this.fileName);
    }

    /**
     * 这份备份能不能用：必须是数组且能解析。
     * 只看大小不够 —— 备份也可能是在数据已经坏掉之后拍的。
     */
    _isUsableBackup(backupName) {
        try {
            const raw = fs.readFileSync(dataBackups.getBackupPath(this.fileName, backupName), 'utf-8');
            return Array.isArray(JSON.parse(raw));
        } catch (e) {
            return false;
        }
    }

    /**
     * 从备份恢复数据文件。
     *
     * 配合 _read() 抛错使用：数据坏了之后写入会被阻断，
     * 但不应该只能靠人去 backups 目录里手工翻文件 —— 这里给出显式恢复入口。
     *
     * @param {string} [backupName] 指定备份；不传则从新到旧挑第一份可解析为数组的
     * @returns {{restoredFrom: string, count: number, restoredAt: string}}
     */
    recoverFromBackup(backupName) {
        const list = dataBackups.listBackups(this.fileName);
        if (!list.length) {
            throw new Error('没有可用备份：' + this.fileName);
        }

        let chosen = null;
        if (backupName) {
            if (!list.some(b => b.name === backupName)) {
                throw new Error('找不到指定备份：' + backupName);
            }
            if (!this._isUsableBackup(backupName)) {
                throw new Error('指定备份无法解析为数组：' + backupName);
            }
            chosen = backupName;
        } else {
            // 最新的一份未必可用（它可能就是坏掉那版拍的），从新到旧往下找
            for (const item of list) {
                if (this._isUsableBackup(item.name)) { chosen = item.name; break; }
            }
            if (!chosen) {
                throw new Error('所有备份都无法解析为数组：' + this.fileName);
            }
        }

        const result = dataBackups.restoreBackup(this.fileName, chosen);
        // 恢复后立刻自检，别把"恢复成功"建立在假设上
        const count = this._read().length;
        return {
            restoredFrom: chosen,
            count: count,
            restoredAt: result.restoredAt
        };
    }

    /**
     * 查询全部数据
     * @param {Object} [filter] - 可选的过滤条件（简易键值匹配）
     * @returns {Array}
     */
    findAll(filter) {
        let data = this._read();
        if (filter && typeof filter === 'object') {
            data = data.filter(function (item) {
                return Object.keys(filter).every(function (key) {
                    return item[key] === filter[key];
                });
            });
        }
        return data;
    }

    /**
     * 按 ID 查找
     * @param {string} id
     * @returns {Object|null}
     */
    findById(id) {
        return this._read().find(function (item) {
            return item.id === id;
        }) || null;
    }

    /**
     * 创建新记录
     * @param {Object} data - 不含 id 和时间戳
     * @returns {Object} 创建后的完整记录
     */
    create(data) {
        var all = this._read();
        var now = new Date().toISOString();
        var record = Object.assign({}, data, {
            id: generateId(),
            createdAt: now,
            updatedAt: now
        });
        all.unshift(record); // 最新的排在前面
        this._write(all);
        return record;
    }

    /**
     * 批量创建
     * @param {Array} items
     * @returns {Array}
     */
    createMany(items) {
        var all = this._read();
        var now = new Date().toISOString();
        var records = items.map(function (item) {
            return Object.assign({}, item, {
                id: generateId(),
                createdAt: now,
                updatedAt: now
            });
        });
        all = records.concat(all);
        this._write(all);
        return records;
    }

    /**
     * 按 ID 更新（部分更新，merge 模式）
     * @param {string} id
     * @param {Object} patch - 要更新的字段
     * @returns {Object|null} 更新后的完整记录，不存在返回 null
     */
    update(id, patch) {
        var all = this._read();
        var idx = all.findIndex(function (item) {
            return item.id === id;
        });
        if (idx === -1) return null;

        // id / createdAt 是身份字段，路由层漏了白名单也不能被请求体改掉。
        var safe = Object.assign({}, patch && typeof patch === 'object' ? patch : {});
        delete safe.id;
        delete safe.createdAt;

        var original = all[idx];
        all[idx] = Object.assign({}, original, safe, {
            id: original.id,
            createdAt: original.createdAt,
            updatedAt: new Date().toISOString()
        });
        this._write(all);
        return all[idx];
    }

    /**
     * 按 ID 删除
     * @param {string} id
     * @returns {boolean} 是否删除成功
     */
    remove(id) {
        var all = this._read();
        var before = all.length;
        var filtered = all.filter(function (item) {
            return item.id !== id;
        });
        if (filtered.length === before) return false;
        this._write(filtered);
        return true;
    }

    /**
     * 批量删除
     * @param {Array<string>} ids
     * @returns {number} 删除的数量
     */
    removeMany(ids) {
        var all = this._read();
        var idSet = new Set(ids);
        var filtered = all.filter(function (item) {
            return !idSet.has(item.id);
        });
        var removed = all.length - filtered.length;
        if (removed > 0) this._write(filtered);
        return removed;
    }

    /**
     * 清空所有数据
     */
    clear() {
        this._write([]);
    }

    /**
     * 统计总数
     * @returns {number}
     */
    count() {
        return this._read().length;
    }
}

module.exports = Storage;
module.exports.generateId = generateId;
module.exports.StorageError = StorageError;
