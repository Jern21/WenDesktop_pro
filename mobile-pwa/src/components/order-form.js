/**
 * 订单编辑表单 —— 通用引擎 form-sheet.js 的订单字段集封装
 *
 * 为什么独立成组件，而不是各页面各写一份：
 *  订单列表（左滑编辑）和订单详情（编辑按钮）改的是同一份字段、
 *  同一套校验、同一个保存语义 —— 放两处写，字段早晚漂移。
 *
 * 字段集是后端 EDITABLE_FIELDS 的子集：手机上只编最常用的几项
 * （项目名/客户/电话/类型/金额/成本/耗时/终稿日）。
 * 附件、需求描述、打款记录等复杂字段仍留给桌面端抽屉。
 *
 * 用法：
 *   import { openOrderForm } from '../components/order-form.js';
 *   openOrderForm(order, {
 *       onSave: function (patch) { return orders.update(order.id, patch); }
 *   });
 */
import { openFormSheet } from './form-sheet.js';

var PROJECT_TYPES = ['网站开发', '小程序开发', 'UI/设计', '视频剪辑', '平面设计', '文案优化', '其他'];

/** 表单字段定义：一处维护，列表和详情共用（导出给 swipe-crud 直接用） */
export var ORDER_FIELDS = [
    { key: 'projectName', label: '项目名称', full: true, placeholder: '例如：官网改版' },
    { key: 'customerNick', label: '客户昵称', placeholder: '例如：闲鱼·阿明' },
    { key: 'customerPhone', label: '客户电话', type: 'tel', full: true, placeholder: '选填' },
    { key: 'projectType', label: '项目类型', type: 'select', options: PROJECT_TYPES },
    { key: 'amount', label: '成交额（¥）', type: 'number', inputmode: 'decimal', min: '0', numeric: true },
    { key: 'cost', label: '成本（¥）', type: 'number', inputmode: 'decimal', min: '0', numeric: true },
    { key: 'hours', label: '耗时（小时）', type: 'number', inputmode: 'decimal', min: '0', numeric: true },
    { key: 'finalDate', label: '终稿日期', type: 'date' }
];

/**
 * @param {Object} order 要编辑的订单（至少要有 id）
 * @param {Object} opts { onSave(patch) -> Promise }
 * @returns {{close:Function}}
 */
export function openOrderForm(order, opts) {
    var o = opts || {};
    return openFormSheet({
        title: '编辑订单',
        fields: ORDER_FIELDS,
        values: order,
        onSave: o.onSave
    });
}
