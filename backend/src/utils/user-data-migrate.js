/**
 * 把根目录 data/*.json 的业务数据归属给 trial 账号（**手动操作**）
 *
 * ⚠️ 这不是服务启动流程的一部分
 * -------------------------------
 * 它是一次性的「改数据归属」动作：根目录旧数据 → users/<trial>/，其余账号置空。
 * 一旦挂进启动钩子（server.js 里无条件调用），后果是：
 *
 *   · 任何新数据目录首启都会被搬一遍 —— 测试临时目录、换机器、全新部署；
 *   · 全新部署时示例数据会不声不响全归到**免密**的 trial 账号，admin 进去空无一物；
 *   · admin 若已经存了真实数据，会被直接清空（旧实现是无条件 writeFileSync 覆盖）。
 *
 * 所以改成显式执行：
 *
 *   node backend/src/utils/user-data-migrate.js          # 手动跑一次
 *   USER_SCOPE_MIGRATE=1 node backend/server.js          # 明确要求在启动时跑（部署脚本用）
 *
 * 不想让 trial 拿数据、只想让两个账号各自从空开始，就什么都别做 —— 默认行为就是这个。
 *
 * 安全网
 * ------
 * 置空某个账号之前，先把它原有的非空数据备份到
 * `_legacy_root_data/admin-backup-<时间戳>/`，手滑也能捞回来。
 */

'use strict';

var fs = require('fs');
var path = require('path');
var dataPaths = require('./data-paths');

var MARKER = '.user-scope-migrated';
var LEGACY_DIR = '_legacy_root_data';

var USER_JSON_FILES = [
    'orders', 'customers', 'quotes', 'posters', 'projects', 'platform-posts',
    'memos', 'reminders', 'resume', 'bookmarks', 'accounts', 'bug-reports', 'settings', 'ledger'
];

function emptySettings() {
    return {
        profile: {
            nickname: '',
            realName: '',
            phone: '',
            email: '',
            role: '',
            city: '',
            bio: '',
            avatar: ''
        },
        theme: 'pure-white',
        notifications: {
            orderReminders: true,
            customerMessages: true,
            platformUpdates: false,
            weeklyReport: true
        },
        backup: { autoBackup: false, lastBackup: null },
        exportFormat: 'json',
        cleanupDays: 30
    };
}

function emptyJsonContent(fileName) {
    if (fileName === 'settings') {
        return JSON.stringify(emptySettings(), null, 2);
    }
    return '[]';
}

function readJsonSafe(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        var raw = fs.readFileSync(filePath, 'utf-8').trim();
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

/**
 * 这个文件里有没有「真实数据」？
 *
 * settings 是对象结构，空模板本身也有 key，所以要拿模板比一次；
 * 其余都是数组，非空即为有数据。解析失败也算「有数据」——
 * 宁可多备份一份，也不能把读不懂的文件直接覆盖掉。
 */
function hasMeaningfulData(fileName, filePath) {
    if (!fs.existsSync(filePath)) return false;
    var data = readJsonSafe(filePath);
    if (data === null) {
        // 读不懂：字面量不是空数组/空文件，就当作有东西，必须备份
        var raw = '';
        try { raw = fs.readFileSync(filePath, 'utf-8').trim(); } catch (e) { return false; }
        return raw !== '' && raw !== '[]';
    }
    if (fileName === 'settings') {
        return JSON.stringify(data) !== JSON.stringify(emptySettings());
    }
    // 数组类文件：解析出来不是数组 → 结构异常，同样必须保护
    if (!Array.isArray(data)) return true;
    return data.length > 0;
}

/**
 * 置空之前先备份。备份目录不存在就建，重名就带时间戳。
 */
function backupBeforeWipe(fileName, filePath, legacyDir) {
    if (!hasMeaningfulData(fileName, filePath)) return null;

    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    var backupDir = path.join(legacyDir, 'admin-backup-' + stamp);
    fs.mkdirSync(backupDir, { recursive: true });

    var dest = path.join(backupDir, fileName + '.json');
    fs.copyFileSync(filePath, dest);
    return path.relative(dataPaths.DATA_DIR, dest);
}

function normalizeOptions(options) {
    // 兼容老写法：runUserDataMigration(function () { return {trial, admin}; })
    if (typeof options === 'function') return { getUsers: options };
    return options || {};
}

function resolveUsers(options) {
    if (options.trialUsername && options.adminUsername) {
        return {
            trial: dataPaths.normalizeUsername(options.trialUsername),
            admin: dataPaths.normalizeUsername(options.adminUsername)
        };
    }
    var getUsers = typeof options.getUsers === 'function' ? options.getUsers : null;
    if (!getUsers) throw new Error('runUserDataMigration 需要 getUsers 或 trialUsername/adminUsername');
    var users = getUsers() || {};
    return {
        trial: dataPaths.normalizeUsername(users.trial),
        admin: dataPaths.normalizeUsername(users.admin)
    };
}

/**
 * 执行「把根目录数据归属给 trial」。
 *
 * @param {Object|Function} options
 *        options.getUsers         - () => { trial, admin }
 *        options.trialUsername / adminUsername - 直接指定账号（测试用）
 *        options.force            - 已有迁移标记也重跑（默认 false）
 * @returns {{skipped: boolean, reason?: string, trial?: string, admin?: string,
 *            moved?: number, backedUp?: Array<string>}}
 */
function runUserDataMigration(options) {
    options = normalizeOptions(options);
    var users = resolveUsers(options);

    var dataDir = dataPaths.DATA_DIR;
    var markerPath = path.join(dataDir, MARKER);

    if (!options.force && fs.existsSync(markerPath)) {
        return { skipped: true, reason: 'already migrated' };
    }

    var trialDir = dataPaths.ensureUserDataDir(users.trial);
    var adminDir = dataPaths.ensureUserDataDir(users.admin);
    var legacyDir = path.join(dataDir, LEGACY_DIR);

    var moved = 0;
    var backedUp = [];

    USER_JSON_FILES.forEach(function (name) {
        var src = path.join(dataDir, name + '.json');
        var adminFile = path.join(adminDir, name + '.json');

        // 1) 先把 admin 已有的真实数据备份掉，再置空
        var backupPath = backupBeforeWipe(name, adminFile, legacyDir);
        if (backupPath) backedUp.push(backupPath);

        fs.writeFileSync(adminFile, emptyJsonContent(name), 'utf-8');

        // 2) 根目录有数据就归给 trial（原文件搬进 legacy，不做双份）
        if (!fs.existsSync(src)) return;

        fs.copyFileSync(src, path.join(trialDir, name + '.json'));

        var legacyTarget = path.join(legacyDir, name + '.json');
        if (!fs.existsSync(legacyDir)) fs.mkdirSync(legacyDir, { recursive: true });
        if (fs.existsSync(legacyTarget)) {
            // legacy 里已有一份（上一次跑过），本次直接丢掉根目录这份
            fs.unlinkSync(src);
        } else {
            fs.renameSync(src, legacyTarget);
        }
        moved++;
    });

    fs.writeFileSync(markerPath, JSON.stringify({
        migratedAt: new Date().toISOString(),
        trialUser: users.trial,
        adminUser: users.admin,
        files: moved,
        backedUp: backedUp
    }, null, 2), 'utf-8');

    console.log('[user-data] 已将根目录数据归属给 users/' + users.trial +
        '，users/' + users.admin + ' 置空（文件数 ' + moved + '）');
    if (backedUp.length) {
        console.log('[user-data] 置空前已备份 ' + backedUp.length + ' 份原数据到 ' + LEGACY_DIR);
    }

    return {
        skipped: false,
        trial: users.trial,
        admin: users.admin,
        moved: moved,
        backedUp: backedUp
    };
}

/**
 * 启动时是否要跑迁移 —— **默认不跑**。
 *
 * 只有部署脚本显式声明 `USER_SCOPE_MIGRATE=1` 才执行。
 * 为什么不默认开：这是「改数据归属」的一次性动作，不是服务的常规启动步骤。
 */
function maybeRunOnStartup(options) {
    options = options || {};
    var env = options.env || process.env;
    var flag = String(env.USER_SCOPE_MIGRATE == null ? '' : env.USER_SCOPE_MIGRATE).trim();

    if (flag !== '1') {
        return { skipped: true, reason: 'disabled (set USER_SCOPE_MIGRATE=1 to enable)' };
    }
    return runUserDataMigration(options);
}

if (require.main === module) {
    var auth = require('./auth');
    auth.init();

    var result = runUserDataMigration({
        getUsers: function () {
            return { trial: auth.getTrialUsername(), admin: auth.getUsername() };
        }
    });

    if (result.skipped) {
        console.log('[user-data] 跳过：' + result.reason +
            '（要强制重跑，加 FORCE=1 或删掉 data/.user-scope-migrated）');
        if (String(process.env.FORCE || '') === '1') {
            result = runUserDataMigration({
                force: true,
                getUsers: function () {
                    return { trial: auth.getTrialUsername(), admin: auth.getUsername() };
                }
            });
            console.log(JSON.stringify(result, null, 2));
        }
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
}

module.exports = {
    MARKER: MARKER,
    LEGACY_DIR: LEGACY_DIR,
    USER_JSON_FILES: USER_JSON_FILES,
    runUserDataMigration: runUserDataMigration,
    maybeRunOnStartup: maybeRunOnStartup,
    // 给测试用
    hasMeaningfulData: hasMeaningfulData
};
