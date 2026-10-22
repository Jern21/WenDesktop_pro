/**
 * 待办：按时间分组的提醒列表，加一个月历。
 * 勾选即完成，3 秒内可以在 toast 上撤销。不在这里新建提醒。
 */
import '../../styles/reminder.css';
import { reminders } from '../../api/resources.js';
import { escapeHtml, formatDate, reminderBucket } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { takeReminderBucket } from '../reminder-session.js';

var GROUPS = [
    { id: 'overdue', label: '已逾期' },
    { id: 'today', label: '今天' },
    { id: 'week', label: '本周' },
    { id: 'later', label: '以后' },
    { id: 'done', label: '已完成' }
];

var WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function todayKey() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}

function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

export function mountReminderPanel(container) {
    var alive = true;
    var generation = 0;
    var items = [];
    var view = 'list';
    var showDone = false;
    var focus = takeReminderBucket();
    var busy = {};
    var now = new Date();
    var cursor = { year: now.getFullYear(), month: now.getMonth() + 1 };
    var selected = todayKey();
    var calendar = null;

    container.innerHTML = '<div class="rem-page"></div>';
    var root = container.querySelector('.rem-page');

    function findItem(id) {
        var found = null;
        items.forEach(function (item) {
            if (item && item.id === id) found = item;
        });
        var days = calendar && calendar.days;
        if (!found && days) {
            Object.keys(days).forEach(function (key) {
                (days[key] || []).forEach(function (item) {
                    if (item && item.id === id) found = item;
                });
            });
        }
        return found;
    }

    function replaceItem(updated) {
        if (!updated || !updated.id) return;
        items = items.map(function (item) {
            return item.id === updated.id ? updated : item;
        });
    }

    function renderList() {
        var buckets = { overdue: [], today: [], week: [], later: [], done: [] };
        items.forEach(function (item) {
            buckets[reminderBucket(item)].push(item);
        });
        var html = '';
        var anyOpen = false;
        GROUPS.forEach(function (group) {
            var list = buckets[group.id];
            if (group.id === 'done') {
                html += '<button type="button" class="rem-done-toggle" data-act="done">' +
                    (showDone ? '收起已完成' : '已完成 ' + list.length) + '</button>';
                if (!showDone) return;
            } else if (!list.length && group.id !== focus) {
                return;
            }
            if (group.id !== 'done') anyOpen = anyOpen || list.length > 0;
            html += '<section class="rem-group' + (group.id === 'overdue' ? ' is-overdue' : '') +
                '" data-bucket="' + group.id + '">' +
                '<h2 class="rem-group-title">' + group.label +
                '<span class="rem-count">' + list.length + '</span></h2>';
            if (!list.length) {
                html += '<p class="rem-meta">没有</p>';
            }
            list.forEach(function (item) {
                html += renderItem(item);
            });
            html += '</section>';
        });
        if (!anyOpen && !showDone) {
            html = '<div class="rem-state">没有未完成的提醒</div>' + html;
        }
        return html;
    }

    function renderItem(item) {
        var meta = [];
        if (item.date) meta.push(formatDate(item.date, 'month-day') || item.date);
        if (item.time) meta.push(item.time);
        if (item.category) meta.push(item.category);
        return '<button type="button" class="rem-item' + (item.done ? ' is-done' : '') +
            (busy[item.id] ? ' is-busy' : '') + '" data-id="' + escapeHtml(item.id) + '" role="checkbox" aria-checked="' +
            (item.done ? 'true' : 'false') + '">' +
            '<span class="rem-check" aria-hidden="true"></span>' +
            '<span><span class="rem-title">' + escapeHtml(item.title || '未命名提醒') + '</span>' +
            '<span class="rem-meta">' + escapeHtml(meta.join(' · ')) + '</span></span></button>';
    }

    function renderCalendar() {
        var year = cursor.year;
        var month = cursor.month;
        var first = new Date(year, month - 1, 1);
        var lead = (first.getDay() + 6) % 7;
        var count = daysInMonth(year, month);
        var days = (calendar && calendar.days) || {};
        var html = '<div class="rem-cal-head"><button type="button" data-act="prev" aria-label="上个月">‹</button>' +
            '<span class="rem-cal-title">' + year + '年' + month + '月</span>' +
            '<button type="button" data-act="next" aria-label="下个月">›</button></div>' +
            '<div class="rem-weekdays">' + WEEKDAYS.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
            '<div class="rem-grid">';
        var i;
        for (i = 0; i < lead; i++) html += '<button type="button" class="rem-day is-out" tabindex="-1"></button>';
        for (i = 1; i <= count; i++) {
            var key = year + '-' + pad2(month) + '-' + pad2(i);
            var dayItems = days[pad2(i)] || [];
            var open = dayItems.some(function (item) { return !item.done; });
            var cls = 'rem-day';
            if (key === todayKey()) cls += ' is-today';
            if (key === selected) cls += ' is-selected';
            if (dayItems.length) cls += ' has-item';
            if (open) cls += ' has-open';
            html += '<button type="button" class="' + cls + '" data-day="' + key + '">' + i + '</button>';
        }
        html += '</div><div class="rem-day-list">';
        var picked = (days[selected.slice(8, 10)] || []).filter(function (item) {
            return item.date === selected;
        });
        if (!calendar) html += '<p class="rem-meta">加载中…</p>';
        else if (!picked.length) html += '<p class="rem-meta">' + escapeHtml(formatDate(selected, 'month-day') || selected) + ' 没有提醒</p>';
        else picked.forEach(function (item) { html += renderItem(item); });
        html += '</div>';
        return html;
    }

    function paint() {
        root.innerHTML =
            '<div class="rem-tools">' +
            '<div class="rem-seg">' +
            '<button type="button" data-view="list"' + (view === 'list' ? ' class="is-active"' : '') + '>列表</button>' +
            '<button type="button" data-view="calendar"' + (view === 'calendar' ? ' class="is-active"' : '') + '>月历</button>' +
            '</div>' +
            '<button type="button" class="rem-refresh" data-act="refresh">刷新</button>' +
            '</div>' +
            '<div class="rem-body">' + (view === 'calendar' ? renderCalendar() : renderList()) + '</div>';
        if (focus && view === 'list') {
            var target = root.querySelector('[data-bucket="' + focus + '"]');
            focus = '';
            if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start' });
        }
    }

    function fail(err) {
        root.innerHTML = '<div class="rem-state"><p></p><button type="button" class="rem-retry" data-act="refresh">重试</button></div>';
        root.querySelector('p').textContent = (err && err.message) || '加载失败';
    }

    function loadList() {
        var gen = ++generation;
        reminders.list().then(function (res) {
            if (!alive || gen !== generation) return;
            var data = res && res.data;
            items = Array.isArray(data) ? data : [];
            paint();
        }).catch(function (err) {
            if (!alive || gen !== generation) return;
            fail(err);
        });
    }

    function loadCalendar() {
        var gen = ++generation;
        reminders.calendar(cursor.year, cursor.month).then(function (res) {
            if (!alive || gen !== generation) return;
            calendar = res && res.data ? res.data : { days: {} };
            paint();
        }).catch(function (err) {
            if (!alive || gen !== generation) return;
            fail(err);
        });
    }

    function reload() {
        root.innerHTML = '<div class="rem-state">加载中…</div>';
        if (view === 'calendar') loadCalendar();
        else loadList();
    }

    function toggle(id) {
        if (!id || busy[id]) return;
        busy[id] = true;
        paint();
        var before = findItem(id);
        reminders.toggle(id).then(function (res) {
            if (!alive) return;
            busy[id] = false;
            var updated = res && res.data;
            replaceItem(updated);
            if (view === 'calendar') loadCalendar();
            else paint();
            if (before && updated && !before.done && updated.done) {
                toast.undo('已完成', function () {
                    if (!alive || busy[id]) return;
                    busy[id] = true;
                    reminders.toggle(id).then(function (again) {
                        busy[id] = false;
                        if (!alive) return;
                        replaceItem(again && again.data);
                        if (view === 'calendar') loadCalendar();
                        else paint();
                    }).catch(function (err) {
                        busy[id] = false;
                        toast.error((err && err.message) || '撤销失败');
                        if (view === 'list') paint();
                    });
                });
            }
        }).catch(function (err) {
            busy[id] = false;
            if (!alive) return;
            toast.error((err && err.message) || '更新失败');
            paint();
        });
    }

    root.addEventListener('click', function (e) {
        var viewBtn = e.target.closest && e.target.closest('[data-view]');
        if (viewBtn) {
            view = viewBtn.getAttribute('data-view') || 'list';
            reload();
            return;
        }
        var act = e.target.closest && e.target.closest('[data-act]');
        if (act) {
            var name = act.getAttribute('data-act');
            if (name === 'refresh') reload();
            if (name === 'done') { showDone = !showDone; paint(); }
            if (name === 'prev' || name === 'next') {
                cursor.month += name === 'next' ? 1 : -1;
                if (cursor.month < 1) { cursor.month = 12; cursor.year -= 1; }
                if (cursor.month > 12) { cursor.month = 1; cursor.year += 1; }
                selected = cursor.year + '-' + pad2(cursor.month) + '-01';
                loadCalendar();
            }
            return;
        }
        var dayBtn = e.target.closest && e.target.closest('[data-day]');
        if (dayBtn) {
            selected = dayBtn.getAttribute('data-day');
            paint();
            return;
        }
        var itemBtn = e.target.closest && e.target.closest('[data-id]');
        if (itemBtn) toggle(itemBtn.getAttribute('data-id'));
    });

    reload();

    return {
        destroy: function () {
            alive = false;
            generation += 1;
            container.innerHTML = '';
        }
    };
}
