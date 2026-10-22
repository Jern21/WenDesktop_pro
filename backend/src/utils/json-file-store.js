'use strict';

var fs = require('fs');
var dataBackups = require('./data-backups');

/**
 * 一份 JSON 文件的读写。
 *
 * 读不懂就抛，缺少文件才返回该形状的空值。
 * 同一次 write 使用调用方传入的 scope，不再重新询问「当前用户」。
 */
class JsonFileError extends Error {
    constructor(fileName, filePath, cause) {
        super('数据文件读取失败：' + fileName + '.json（' + (cause && cause.message) + '）');
        this.name = 'JsonFileError';
        this.fileName = fileName;
        this.filePath = filePath;
        this.cause = cause;
        this.status = 500;
    }
}

class JsonFileStore {
    /**
     * @param {string} fileName 不含 .json
     * @param {{ shape: 'array'|'object', ErrorClass?: Function }} options
     */
    constructor(fileName, options) {
        options = options || {};
        if (options.shape !== 'array' && options.shape !== 'object') {
            throw new Error('JsonFileStore 需要 shape: array 或 object');
        }
        this.fileName = fileName;
        this.shape = options.shape;
        this.ErrorClass = options.ErrorClass || JsonFileError;
    }

    empty() {
        return this.shape === 'array' ? [] : {};
    }

    _fail(filePath, cause) {
        throw new this.ErrorClass(this.fileName, filePath, cause);
    }

    _assertShape(data, filePath) {
        var ok = this.shape === 'array' ? Array.isArray(data) : data !== null && typeof data === 'object' && !Array.isArray(data);
        if (!ok) {
            this._fail(filePath, new Error(
                '顶层结构不是' + (this.shape === 'array' ? '数组' : '对象') +
                '，实际为 ' + (data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data)
            ));
        }
    }

    read(scope) {
        scope = scope || dataBackups.captureScope();
        var filePath = dataBackups.getDataFilePath(this.fileName, scope);
        if (!fs.existsSync(filePath)) return this.empty();

        var raw;
        try {
            raw = fs.readFileSync(filePath, 'utf-8');
        } catch (e) {
            this._fail(filePath, e);
        }

        if (raw.trim() === '') return this.empty();

        var data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            this._fail(filePath, e);
        }
        this._assertShape(data, filePath);
        return data;
    }

    write(data, scope, options) {
        options = options || {};
        scope = scope || options.scope || dataBackups.captureScope();
        var filePath = dataBackups.getDataFilePath(this.fileName, scope);
        this._assertShape(data, filePath);
        dataBackups.writeJsonFile(this.fileName, data, {
            backup: options.backup,
            scope: scope
        });
    }
}

module.exports = JsonFileStore;
module.exports.JsonFileError = JsonFileError;
