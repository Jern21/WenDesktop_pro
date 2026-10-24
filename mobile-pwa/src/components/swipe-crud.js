/**
 * 列表项「左滑 → 编辑/删除」的一站式接线
 *
 * 为什么不散在各页面里：
 *  每个列表页要干的活完全一样 —— swipe-actions 手势、form-sheet 编辑表单、
 *  confirmSheet 删除确认、toast 结果反馈、成功后局部刷新。
 *  九个页面各抄一遍就是九份漂移；这里一处封装，页面只声明
 *  「字段长什么样、接口在哪、改完怎么刷」。
 *
 * 用法：
 *   renderItem 里用 swipeRowHtml(cardHtml(item)) 包卡片；
 *   var swipe = attachSwipeCrud(listEl, {
 *       itemOf: function (row) { return items[row.parentNode.dataset.index]; },
 *       title: '编辑客户',
 *       labelOf: function (c) { return c.name; },     // 删除确认文案里的对象名
 *       fields: CUSTOMER_FIELDS,                       // form-sheet 字段集
 *       update: function (id, patch) { return customers.update(id, patch); },
 *       remove: function (id) { return customers.remove(id); },
 *       updated: function (saved) { lv.updateItem(saved); },   // 保存成功后局部刷新
 *       removed: function (id) { lv.removeItemById(id); }
 *   });
 *   destroy 时调 swipe.destroy()
 */
import { attachSwipeActions } from './swipe-actions.js';
import { openFormSheet } from './form-sheet.js';
import { confirmSheet, toast } from '../lib/toast.js';

/**
 * 卡片外面包一层左滑容器（各页 renderItem 统一用它）
 * @param {string} innerHtml 卡片 HTML
 * @param {Object} [opts] { acts:['edit','del'] } —— 只删不编辑的列表（如流水）传 ['del']
 */
export function swipeRowHtml(innerHtml, opts) {
    var acts = (opts && opts.acts) || ['edit', 'del'];
    var btns = '';
    if (acts.indexOf('edit') !== -1) {
        btns += '<button type="button" class="swipe-act swipe-act--edit" data-swipe="edit">编辑</button>';
    }
    if (acts.indexOf('del') !== -1) {
        btns += '<button type="button" class="swipe-act swipe-act--del" data-swipe="del">删除</button>';
    }
    return '<div class="swipe-row">' +
        '<div class="swipe-actions">' + btns + '</div>' +
        '<div class="swipe-content">' + innerHtml + '</div>' +
        '</div>';
}

/**
 * @param {HTMLElement} listEl 列表容器（事件委托挂这里）
 * @param {Object} opts
 * @param {(row:HTMLElement)=>*} opts.itemOf 从左滑行找回数据项
 * @param {string} [opts.title] 表单标题，默认「编辑」
 * @param {(item)=>string} [opts.labelOf] 删除确认文案里的对象名
 * @param {Array} opts.fields form-sheet 字段定义
 * @param {(id:string,patch:Object)=>Promise} opts.update
 * @param {(id:string)=>Promise} opts.remove
 * @param {(saved:*)=>void} [opts.updated] 保存成功后刷新界面（res.data 整个传入）
 * @param {(id:string)=>void} [opts.removed] 删除成功后刷新界面
 * @param {()=>boolean} [opts.alive] 页面存活检查，默认恒 true
 */
export function attachSwipeCrud(listEl, opts) {
    var o = opts || {};
    var alive = o.alive || function () { return true; };

    function edit(item) {
        if (!item || !o.update) return;
        // fields 支持函数 —— 选项依赖异步数据时（如平台列表），开表单的瞬间再取
        var fields = typeof o.fields === 'function' ? o.fields(item) : (o.fields || []);
        openFormSheet({
            title: o.title || '编辑',
            fields: fields,
            values: item,
            onSave: function (patch) {
                // item 一并透传：有的后端 PUT 不是 merge（如 quotes 全量重算），
                // 调用方需要原始记录做完整对象回写
                return o.update(item.id, patch, item).then(function (res) {
                    if (!alive()) return;
                    var saved = res && res.data;
                    if (saved && o.updated) o.updated(saved);
                    toast.success('已更新');
                }).catch(function (err) {
                    toast.error((err && err.message) || '保存失败');
                    throw err;   // 让 form-sheet 恢复按钮
                });
            }
        });
    }

    function remove(item) {
        if (!item || !o.remove) return;
        var label = (o.labelOf && o.labelOf(item)) || '这条记录';
        confirmSheet({
            title: '确认删除？',
            message: '「' + label + '」删除后不可恢复。',
            confirmText: '删除',
            danger: true
        }).then(function (ok) {
            if (!ok || !alive()) return;
            o.remove(item.id).then(function () {
                if (!alive()) return;
                if (o.removed) o.removed(item.id);
                toast.success('已删除');
            }).catch(function (err) {
                toast.error((err && err.message) || '删除失败');
            });
        });
    }

    return attachSwipeActions(listEl, {
        onAction: function (act, row) {
            var item = o.itemOf ? o.itemOf(row) : null;
            if (act === 'edit') edit(item);
            if (act === 'del') remove(item);
        }
    });
}
