/**
 * 通用编辑表单（底部弹层引擎）
 *
 * 为什么要做成引擎而不是每页各写一份：
 *  订单/客户/项目/发帖/报价/收藏/素材/账号/提醒的编辑表单，
 *  弹层骨架、忙碌态、保存语义完全一样，只有字段定义不同。
 *  字段是数据，骨架是组件 —— 一处维护，九处复用。
 *
 * 用法：
 *   import { openFormSheet } from '../components/form-sheet.js';
 *   openFormSheet({
 *       title: '编辑客户',
 *       fields: [
 *           { key:'name', label:'姓名', full:true },
 *           { key:'phone', label:'电话', type:'tel' },
 *           { key:'source', label:'来源', type:'select', options:['闲鱼','小红书'] },
 *           { key:'secret', label:'密码', keepEmpty:true, placeholder:'留空不修改' }
 *       ],
 *       values: customer,
 *       onSave: function (patch) { return customers.update(customer.id, patch); }
 *   });
 *
 * 字段属性：
 *   key        数据键（patch 里同名）
 *   label      显示名
 *   type       text|tel|number|date|time|select|textarea|password（默认 text）
 *   options    type=select 时的选项数组
 *   placeholder/inputmode/min 透传给 input
 *   full       true → 该字段占整行（默认半行两两并排）
 *   keepEmpty  true → 值为空时 patch 里不送这个键（「留空不修改」语义）
 *   required   true → 提交前校验非空（标红星），不满足则不发起保存
 *   numeric    true → 收集时转数字（空→0，下限 0）；不设则按字符串
 *
 * onSave(patch) 返回 Promise；组件自己管 busy/关层，报错文案由调用方 toast。
 */
import { escapeHtml } from '../lib/format.js';
import { toast } from '../lib/toast.js';

function fieldHtml(field, value) {
    var val = value === null || value === undefined ? '' : String(value);
    var cls = 'of-field' + (field.full ? ' of-field--full' : '');
    var inner;
    if (field.type === 'select') {
        inner = '<select data-key="' + field.key + '">' +
            '<option value="">未设置</option>' +
            (field.options || []).map(function (opt) {
                var v = typeof opt === 'object' ? opt.value : opt;
                var t = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                return '<option value="' + escapeHtml(v) + '"' +
                    (String(v) === val ? ' selected' : '') + '>' + escapeHtml(t) + '</option>';
            }).join('') + '</select>';
    } else if (field.type === 'textarea') {
        inner = '<textarea data-key="' + field.key + '" rows="3"' +
            (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') +
            '>' + escapeHtml(val) + '</textarea>';
    } else {
        inner = '<input type="' + (field.type || 'text') + '" data-key="' + field.key + '"' +
            ' value="' + escapeHtml(val) + '"' +
            (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') +
            (field.inputmode ? ' inputmode="' + field.inputmode + '"' : '') +
            (field.min !== undefined ? ' min="' + field.min + '"' : '') +
            (field.max !== undefined ? ' max="' + field.max + '"' : '') + ' />';
    }
    return '<label class="' + cls + '"><span>' + escapeHtml(field.label) +
        (field.required ? '<em class="of-req">*</em>' : '') + '</span>' + inner + '</label>';
}

/**
 * @param {Object} opts { title, fields, values, onSave }
 * @returns {{close:Function}}
 */
export function openFormSheet(opts) {
    var o = opts || {};
    var fields = o.fields || [];
    var values = o.values || {};
    var busy = false;

    var backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML =
        '<div class="sheet-panel of-panel" role="dialog" aria-modal="true">' +
        '<h3 class="sheet-title"></h3>' +
        '<div class="of-grid">' +
        fields.map(function (f) { return fieldHtml(f, values[f.key]); }).join('') +
        '</div>' +
        '<div class="sheet-actions">' +
        '<button type="button" class="sheet-btn" data-act="cancel">取消</button>' +
        '<button type="button" class="sheet-btn sheet-btn--primary" data-act="save">保存</button>' +
        '</div></div>';
    backdrop.querySelector('.sheet-title').textContent = o.title || '编辑';

    var saveBtn = backdrop.querySelector('[data-act="save"]');
    var inputs = {};
    fields.forEach(function (f) {
        inputs[f.key] = backdrop.querySelector('[data-key="' + f.key + '"]');
    });

    function close() {
        if (!backdrop.parentNode) return;
        backdrop.classList.remove('is-in');
        setTimeout(function () {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 200);
    }

    function setBusy(on) {
        busy = on;
        backdrop.querySelectorAll('input, select, textarea, button').forEach(function (el) {
            el.disabled = on;
        });
    }

    function collect() {
        var patch = {};
        fields.forEach(function (f) {
            var raw = String(inputs[f.key].value || '').trim();
            if (f.keepEmpty && raw === '') return;   // 留空 = 不修改，键不进 patch
            if (f.numeric) {
                patch[f.key] = raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0);
            } else {
                patch[f.key] = raw;
            }
        });
        return patch;
    }

    function submit() {
        if (busy) return;
        var patch = collect();
        var missing = null;
        fields.forEach(function (f) {
            if (f.required && !missing && !String(patch[f.key] || '').trim()) missing = f;
        });
        if (missing) {
            toast.error('请填写' + (missing.label || '必填项'));
            var el = inputs[missing.key];
            if (el && el.focus) el.focus();
            return;
        }
        setBusy(true);
        saveBtn.textContent = '保存中…';
        Promise.resolve()
            .then(function () { return o.onSave(patch); })
            .then(function () {
                setBusy(false);
                saveBtn.textContent = '保存';
                close();
            })
            .catch(function () {
                // 报错文案由调用方 toast —— 组件只负责恢复可点状态
                setBusy(false);
                saveBtn.textContent = '保存';
            });
    }

    backdrop.addEventListener('click', function (e) {
        if (busy) return;
        if (e.target === backdrop) { close(); return; }
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'cancel') close();
        if (act === 'save') submit();
    });

    document.body.appendChild(backdrop);
    requestAnimationFrame(function () { backdrop.classList.add('is-in'); });

    return { close: close };
}
