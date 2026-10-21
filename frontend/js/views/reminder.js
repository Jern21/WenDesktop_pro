/**
 * 日期提醒 视图
 *
 * 自动迁移自 frontend/pages/personal/reminder.html
 *
 * 迁移方式：原脚本整段放入 mount() 作用域，
 *   - 所有 var/function 成为局部变量，不再污染 window
 *   - document/window 上的监听由框架自动登记并清理
 *
 * ⚠️ 人工复核清单：
 *   1. 若含 onclick 内联属性 → 需改造成 data-act 委托
 *   2. 若含 spa:ready / spa:cleanup-forms 监听 → 新架构下应删除
 *   3. 若 css 含 @apply → 需展开为原生 CSS
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    App.view('reminder', {
        path: '/reminder',
        nav: 'reminder.html',
        title: '日期提醒',
        template: 'views/reminder.html',
        styles: 'css/views/reminder.css',

        async mount(root, ctx) {
            // ---- 自动捕获本页注册的全局监听，卸载时统一移除 ----
            var _docAdd = document.addEventListener;
            var _winAdd = window.addEventListener;
            var _listeners = [];
            document.addEventListener = function (t, f, o) {
                _listeners.push(['doc', t, f, o]);
                return _docAdd.call(document, t, f, o);
            };
            window.addEventListener = function (t, f, o) {
                _listeners.push(['win', t, f, o]);
                return _winAdd.call(window, t, f, o);
            };
            ctx.onCleanup(function () {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
                _listeners.forEach(function (r) {
                    try {
                        (r[0] === 'doc' ? document : window).removeEventListener(r[1], r[2], r[3]);
                    } catch (e) { /* ignore */ }
                });
            });

            try {
                /* ==================== 原始脚本开始 ==================== */

                    (function () {
                        'use strict';

                        // ========== 工具函数 ==========
                        function escapeHtml(s) {
                            return String(s || '').replace(/[&<>"']/g, function (c) {
                                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
                            });
                        }
                        function todayStr() {
                            var d = new Date();
                            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        }
                        function addDaysStr(n) {
                            var d = new Date();
                            d.setDate(d.getDate() + n);
                            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        }
                        function daysUntil(dateStr) {
                            var target = new Date(dateStr + 'T00:00:00');
                            var today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return Math.round((target - today) / 86400000);
                        }
                        function formatDate(dateStr) {
                            if (!dateStr) return '';
                            var parts = dateStr.split('-');
                            return parts[1] + '-' + parts[2];
                        }
                        function isOverdue(r) {
                            if (r.done) return false;
                            return daysUntil(r.date) < 0;
                        }
                        function isToday(r) {
                            return r.date === todayStr();
                        }
                        function isSoon(r) {
                            var d = daysUntil(r.date);
                            return d >= 0 && d <= 7;
                        }
                        function priorityLabel(p) {
                            return { high: '高', medium: '中', low: '低' }[p] || '中';
                        }
                        function repeatLabel(r) {
                            return { none: '不重复', daily: '每天', weekly: '每周', monthly: '每月' }[r] || '不重复';
                        }
                        function calcNextRepeatDate(dateStr, repeat) {
                            var d = new Date(dateStr + 'T00:00:00');
                            if (repeat === 'daily') d.setDate(d.getDate() + 1);
                            else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
                            else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
                            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        }
                        function showToast(msg) {
                            var t = document.getElementById('toast');
                            if (!t) return;
                            t.textContent = msg;
                            t.style.opacity = '1';
                            t.style.transform = 'translateX(-50%) translateY(0)';
                            setTimeout(function () {
                                t.style.opacity = '0';
                                t.style.transform = 'translateX(-50%) translateY(10px)';
                            }, 2200);
                        }
                        function catColorBg(color) {
                            var map = {
                                blue: 'bg-blue-400', purple: 'bg-purple-400', cyan: 'bg-cyan-400',
                                amber: 'bg-amber-400', red: 'bg-red-400', green: 'bg-green-400',
                                pink: 'bg-pink-400', indigo: 'bg-indigo-400'
                            };
                            return map[color] || 'bg-gray-400';
                        }

                        // ========== 分类 & 配置（保留 localStorage） ==========
                        var CATEGORY_KEY = 'reminder_categories_v1';
                        var CONFIG_KEY = 'reminder_config_v1';

                        var defaultCategories = [
                            { name: '工作待办', cls: 'cat-work', color: 'blue' },
                            { name: '订单截止', cls: 'cat-order', color: 'purple' },
                            { name: '会议日程', cls: 'cat-meeting', color: 'cyan' },
                            { name: '个人事务', cls: 'cat-personal', color: 'amber' },
                            { name: '项目里程碑', cls: 'cat-deadline', color: 'red' }
                        ];

                        var defaultConfig = {
                            browser_notify: true,
                            overdue_highlight: true,
                            auto_archive: false,
                            advance_hours: 1
                        };

                        var categories = [];
                        var config = {};

                        function loadLocalData() {
                            try {
                                var craw = localStorage.getItem(CATEGORY_KEY);
                                categories = craw ? JSON.parse(craw) : defaultCategories.slice();
                            } catch (e) { categories = defaultCategories.slice(); }

                            try {
                                var cfig = localStorage.getItem(CONFIG_KEY);
                                config = cfig ? JSON.parse(cfig) : Object.assign({}, defaultConfig);
                            } catch (e) { config = Object.assign({}, defaultConfig); }
                        }

                        function saveLocalData() {
                            try {
                                localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
                                localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
                            } catch (e) {}
                        }

                        function getCategoryCls(name) {
                            var cat = categories.find(function (c) { return c.name === name; });
                            return cat ? cat.cls : 'cat-work';
                        }

                        // ========== 状态 ==========
                        var reminders = [];
                        var currentFilter = 'all';
                        var calYear, calMonth;
                        var editingId = null;
                        var deletingId = null;
                        var selectedRepeat = 'none';
                        var selectedCatColor = { color: 'blue', cls: 'cat-work' };
                        var eventsBound = false;

                        // ========== API 调用 ==========
                        function loadReminders() {
                            return fetch('/api/reminders')
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (res.success) {
                                        reminders = res.data || [];
                                        renderList();
                                        renderCalendar();
                                        renderCategories();
                                    }
                                })
                                .catch(function (err) {
                                    console.error('加载提醒失败:', err);
                                    showToast('加载提醒数据失败');
                                });
                        }

                        function apiCreate(data) {
                            return fetch('/api/reminders', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            }).then(function (r) { return r.json(); });
                        }

                        function apiUpdate(id, data) {
                            return fetch('/api/reminders/' + id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            }).then(function (r) { return r.json(); });
                        }

                        function apiDelete(id) {
                            return fetch('/api/reminders/' + id, { method: 'DELETE' })
                                .then(function (r) { return r.json(); });
                        }

                        function apiToggle(id) {
                            return fetch('/api/reminders/' + id + '/toggle', { method: 'PUT' })
                                .then(function (r) { return r.json(); });
                        }

                        // ========== 渲染提醒列表 ==========
                        function getFilteredReminders() {
                            var list = reminders.filter(function (r) {
                                if (currentFilter === 'all') return true;
                                if (currentFilter === 'today') return isToday(r) && !r.done;
                                if (currentFilter === 'soon') return isSoon(r) && !r.done;
                                if (currentFilter === 'overdue') return isOverdue(r);
                                if (currentFilter === 'done') return r.done;
                                return true;
                            });
                            // 排序：未完成在前，按日期升序
                            list.sort(function (a, b) {
                                if (a.done !== b.done) return a.done ? 1 : -1;
                                return (a.date || '').localeCompare(b.date || '');
                            });
                            return list;
                        }

                        function buildReminderCard(r) {
                            var overdue = isOverdue(r);
                            var days = daysUntil(r.date);
                            var urgencyClass = r.priority === 'high' || overdue ? 'urgent' : 'normal';
                            if (r.done) urgencyClass = 'done';

                            var catCls = getCategoryCls(r.category);
                            var priCls = 'pri-' + (r.priority || 'medium');

                            // 时间标签
                            var badge = '';
                            if (r.done) {
                                badge = '<span class="text-[10px] text-green-500 bg-green-50 px-1.5 py-0.5 rounded">已完成</span>';
                            } else if (overdue) {
                                badge = '<span class="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">已逾期 ' + Math.abs(days) + '天</span>';
                            } else if (days === 0) {
                                badge = '<span class="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded font-medium">今天</span>';
                            } else if (days <= 3) {
                                badge = '<span class="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">' + days + '天后</span>';
                            } else {
                                badge = '<span class="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">' + days + '天后</span>';
                            }

                            var repeatBadge = r.repeat !== 'none'
                                ? '<span class="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i class="ph ph-arrows-clockwise text-[9px]"></i>' + repeatLabel(r.repeat) + '</span>'
                                : '';

                            return '<div class="reminder-card ' + urgencyClass + '" data-id="' + r.id + '">'
                                + '<div class="flex items-start gap-3">'
                                + '<button class="toggle-done-btn mt-0.5 w-5 h-5 rounded-full border-2 ' + (r.done ? 'border-green-400 bg-green-400 text-white' : 'border-gray-300 hover:border-brand-400') + ' flex items-center justify-center flex-shrink-0 transition-colors">'
                                + (r.done ? '<i class="ph-bold ph-check text-[10px]"></i>' : '')
                                + '</button>'
                                + '<div class="flex-1 min-w-0">'
                                + '<div class="flex items-center gap-2 mb-1 flex-wrap">'
                                + '<span class="text-[10px] ' + catCls + ' px-1.5 py-0.5 rounded font-medium">' + escapeHtml(r.category) + '</span>'
                                + '<span class="text-[10px] ' + priCls + ' border px-1.5 py-0.5 rounded">优先级 ' + priorityLabel(r.priority) + '</span>'
                                + badge
                                + repeatBadge
                                + '</div>'
                                + '<h4 class="reminder-title font-medium text-gray-800 text-sm">' + escapeHtml(r.title) + '</h4>'
                                + (r.desc ? '<p class="text-xs text-gray-500 mt-1 line-clamp-2">' + escapeHtml(r.desc) + '</p>' : '')
                                + '<div class="flex items-center gap-3 mt-2 text-[10px] text-gray-400">'
                                + '<span class="flex items-center gap-1"><i class="ph ph-calendar"></i>' + formatDate(r.date) + '</span>'
                                + '<span class="flex items-center gap-1"><i class="ph ph-clock"></i>' + (r.time || '09:00') + '</span>'
                                + '</div>'
                                + '</div>'
                                + '<div class="flex flex-col gap-1 flex-shrink-0">'
                                + '<button class="edit-btn w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-brand-500 hover:bg-brand-50 transition-colors"><i class="ph ph-pencil-simple text-xs"></i></button>'
                                + '<button class="delete-btn w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="ph ph-trash text-xs"></i></button>'
                                + '</div>'
                                + '</div>'
                                + '</div>';
                        }

                        function renderList() {
                            var container = document.getElementById('reminder-list');
                            var empty = document.getElementById('empty-state');
                            if (!container) return;
                            var list = getFilteredReminders();

                            if (list.length === 0) {
                                container.innerHTML = '';
                                empty.classList.remove('hidden');
                            } else {
                                empty.classList.add('hidden');
                                container.innerHTML = list.map(buildReminderCard).join('');
                            }
                            renderStats();
                        }

                        // ========== 统计 ==========
                        function renderStats() {
                            var today = reminders.filter(function (r) { return isToday(r) && !r.done; }).length;
                            var soon = reminders.filter(function (r) { return isSoon(r) && !r.done; }).length;
                            var done = reminders.filter(function (r) { return r.done; }).length;
                            var total = reminders.length;

                            var el;
                            if ((el = document.getElementById('stat-today'))) el.textContent = today;
                            if ((el = document.getElementById('stat-soon'))) el.textContent = soon;
                            if ((el = document.getElementById('stat-done'))) el.textContent = done;
                            if ((el = document.getElementById('stat-total'))) el.textContent = total;
                        }

                        // ========== 日历 ==========
                        function renderCalendar() {
                            var grid = document.getElementById('cal-grid');
                            var title = document.getElementById('cal-title');
                            if (!grid || !title) return;

                            title.textContent = calYear + '年' + (calMonth + 1) + '月';

                            var firstDay = new Date(calYear, calMonth, 1).getDay();
                            var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                            var daysInPrev = new Date(calYear, calMonth, 0).getDate();
                            var today = todayStr();

                            // 收集有提醒的日期
                            var reminderDates = {};
                            reminders.forEach(function (r) {
                                if (!r.done) reminderDates[r.date] = true;
                            });

                            var html = '';
                            // 上月填充
                            for (var i = firstDay - 1; i >= 0; i--) {
                                var d = daysInPrev - i;
                                var m = calMonth === 0 ? 12 : calMonth;
                                var y = calMonth === 0 ? calYear - 1 : calYear;
                                var ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
                                var hasRem = reminderDates[ds] ? ' has-reminder' : '';
                                html += '<div class="cal-day other-month' + hasRem + '">' + d + '</div>';
                            }
                            // 本月
                            for (var j = 1; j <= daysInMonth; j++) {
                                var ds2 = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(j).padStart(2, '0');
                                var cls = 'cal-day';
                                if (ds2 === today) cls += ' today';
                                if (reminderDates[ds2]) cls += ' has-reminder';
                                html += '<div class="' + cls + '" data-date="' + ds2 + '">' + j + '</div>';
                            }
                            // 下月填充
                            var totalCells = firstDay + daysInMonth;
                            var fillCount = (7 - (totalCells % 7)) % 7;
                            for (var k = 1; k <= fillCount; k++) {
                                var m2 = calMonth + 2 > 12 ? 1 : calMonth + 2;
                                var y2 = calMonth + 2 > 12 ? calYear + 1 : calYear;
                                var ds3 = y2 + '-' + String(m2).padStart(2, '0') + '-' + String(k).padStart(2, '0');
                                var hasRem3 = reminderDates[ds3] ? ' has-reminder' : '';
                                html += '<div class="cal-day other-month' + hasRem3 + '">' + k + '</div>';
                            }

                            grid.innerHTML = html;
                        }

                        // ========== 分类渲染 ==========
                        function renderCategories() {
                            var container = document.getElementById('category-list');
                            if (!container) return;
                            container.innerHTML = categories.map(function (cat) {
                                var count = reminders.filter(function (r) { return r.category === cat.name && !r.done; }).length;
                                return '<div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">'
                                    + '<div class="flex items-center gap-2">'
                                    + '<span class="w-3 h-3 rounded ' + catColorBg(cat.color) + '"></span>'
                                    + '<span class="text-sm text-gray-700">' + escapeHtml(cat.name) + '</span>'
                                    + '</div>'
                                    + '<div class="flex items-center gap-2">'
                                    + '<span class="text-[10px] text-gray-400">' + count + '项</span>'
                                    + '<button class="del-cat-btn w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" data-name="' + escapeHtml(cat.name) + '"><i class="ph ph-trash text-xs"></i></button>'
                                    + '</div>'
                                    + '</div>';
                            }).join('');

                            // 更新表单 select
                            var select = document.getElementById('form-category');
                            if (select) {
                                select.innerHTML = categories.map(function (c) {
                                    return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>';
                                }).join('');
                            }
                        }

                        // ========== 模态框：新建/编辑 ==========
                        function openModal(id) {
                            editingId = id;
                            var modal = document.getElementById('reminder-modal');
                            var title = document.getElementById('modal-title');
                            var formTitle = document.getElementById('form-title');
                            var formDesc = document.getElementById('form-desc');
                            var formDate = document.getElementById('form-date');
                            var formTime = document.getElementById('form-time');
                            var formCat = document.getElementById('form-category');
                            var formPri = document.getElementById('form-priority');

                            if (id) {
                                var r = reminders.find(function (x) { return x.id === id; });
                                if (!r) return;
                                title.textContent = '编辑提醒';
                                formTitle.value = r.title || '';
                                formDesc.value = r.desc || '';
                                formDate.value = r.date || todayStr();
                                formTime.value = r.time || '09:00';
                                formCat.value = r.category;
                                formPri.value = r.priority || 'medium';
                                selectedRepeat = r.repeat || 'none';
                            } else {
                                title.textContent = '新建提醒';
                                formTitle.value = '';
                                formDesc.value = '';
                                formDate.value = todayStr();
                                formTime.value = '09:00';
                                if (categories.length) formCat.value = categories[0].name;
                                formPri.value = 'medium';
                                selectedRepeat = 'none';
                            }

                            // 更新重复按钮状态
                            document.querySelectorAll('.repeat-btn').forEach(function (btn) {
                                if (btn.dataset.repeat === selectedRepeat) {
                                    btn.classList.add('bg-brand-50', 'text-brand-600', 'border-brand-300');
                                    btn.classList.remove('text-gray-600');
                                } else {
                                    btn.classList.remove('bg-brand-50', 'text-brand-600', 'border-brand-300');
                                    btn.classList.add('text-gray-600');
                                }
                            });

                            modal.classList.remove('hidden');
                        }

                        function closeModal() {
                            var modal = document.getElementById('reminder-modal');
                            if (modal) modal.classList.add('hidden');
                            editingId = null;
                        }

                        function saveReminder() {
                            var title = document.getElementById('form-title').value.trim();
                            var date = document.getElementById('form-date').value;
                            if (!title) { showToast('请输入提醒标题'); return; }
                            if (!date) { showToast('请选择截止日期'); return; }

                            var data = {
                                title: title,
                                desc: document.getElementById('form-desc').value.trim(),
                                date: date,
                                time: document.getElementById('form-time').value || '09:00',
                                category: document.getElementById('form-category').value,
                                priority: document.getElementById('form-priority').value,
                                repeat: selectedRepeat,
                                done: false
                            };

                            if (editingId) {
                                // 编辑：保留 done 状态
                                var r = reminders.find(function (x) { return x.id === editingId; });
                                if (r) data.done = r.done;
                                apiUpdate(editingId, data).then(function (res) {
                                    if (res.success) {
                                        showToast('提醒已更新');
                                        closeModal();
                                        loadReminders();
                                    } else {
                                        showToast(res.error || '更新失败');
                                    }
                                }).catch(function (err) {
                                    console.error('更新失败:', err);
                                    showToast('更新失败');
                                });
                            } else {
                                apiCreate(data).then(function (res) {
                                    if (res.success) {
                                        showToast('提醒已创建');
                                        closeModal();
                                        loadReminders();
                                    } else {
                                        showToast(res.error || '创建失败');
                                    }
                                }).catch(function (err) {
                                    console.error('创建失败:', err);
                                    showToast('创建失败');
                                });
                            }
                        }

                        // ========== 删除 ==========
                        function openDeleteModal(id) {
                            deletingId = id;
                            var r = reminders.find(function (x) { return x.id === id; });
                            var text = document.getElementById('delete-text');
                            if (r && text) text.textContent = '确定要删除「' + r.title + '」吗？删除后无法恢复。';
                            var modal = document.getElementById('delete-modal');
                            if (modal) modal.classList.remove('hidden');
                        }

                        function confirmDelete() {
                            if (!deletingId) return;
                            apiDelete(deletingId).then(function (res) {
                                if (res.success) {
                                    showToast('提醒已删除');
                                    loadReminders();
                                } else {
                                    showToast(res.error || '删除失败');
                                }
                            }).catch(function (err) {
                                console.error('删除失败:', err);
                                showToast('删除失败');
                            });
                            var modal = document.getElementById('delete-modal');
                            if (modal) modal.classList.add('hidden');
                            deletingId = null;
                        }

                        // ========== 完成/取消完成 ==========
                        function toggleDone(id) {
                            var r = reminders.find(function (x) { return x.id === id; });
                            if (!r) return;

                            apiToggle(id).then(function (res) {
                                if (res.success) {
                                    var updated = res.data;
                                    // 如果是重复提醒且刚完成，创建下一次
                                    if (updated.done && r.repeat !== 'none') {
                                        var nextDate = calcNextRepeatDate(r.date, r.repeat);
                                        apiCreate({
                                            title: r.title,
                                            desc: r.desc,
                                            date: nextDate,
                                            time: r.time,
                                            category: r.category,
                                            priority: r.priority,
                                            repeat: r.repeat,
                                            done: false
                                        }).then(function () {
                                            showToast('已完成，已生成下一次提醒');
                                            loadReminders();
                                        });
                                    } else {
                                        showToast(updated.done ? '已完成' : '已恢复');
                                        loadReminders();
                                    }
                                } else {
                                    showToast(res.error || '操作失败');
                                }
                            }).catch(function (err) {
                                console.error('操作失败:', err);
                                showToast('操作失败');
                            });
                        }

                        // ========== 分类管理 ==========
                        function openCategoryModal() {
                            var input = document.getElementById('cat-form-name');
                            if (input) input.value = '';
                            selectedCatColor = { color: 'blue', cls: 'cat-work' };
                            updateColorPicker();
                            var modal = document.getElementById('category-modal');
                            if (modal) modal.classList.remove('hidden');
                        }

                        function updateColorPicker() {
                            document.querySelectorAll('.cat-color-btn').forEach(function (btn) {
                                if (btn.dataset.color === selectedCatColor.color) {
                                    btn.classList.add('ring-2', 'ring-offset-2');
                                    btn.classList.add(ringColorClass(btn.dataset.color));
                                } else {
                                    btn.classList.remove('ring-2', 'ring-offset-2');
                                    btn.classList.remove(ringColorClass(btn.dataset.color));
                                }
                            });
                        }

                        function ringColorClass(color) {
                            var map = {
                                blue: 'ring-blue-400', purple: 'ring-purple-400', cyan: 'ring-cyan-400',
                                amber: 'ring-amber-400', red: 'ring-red-400', green: 'ring-green-400',
                                pink: 'ring-pink-400', indigo: 'ring-indigo-400'
                            };
                            return map[color] || 'ring-gray-400';
                        }

                        function saveCategory() {
                            var name = document.getElementById('cat-form-name').value.trim();
                            if (!name) { showToast('请输入分类名称'); return; }
                            if (categories.find(function (c) { return c.name === name; })) {
                                showToast('分类已存在'); return;
                            }
                            categories.push({
                                name: name,
                                cls: selectedCatColor.cls,
                                color: selectedCatColor.color
                            });
                            saveLocalData();
                            renderCategories();
                            var modal = document.getElementById('category-modal');
                            if (modal) modal.classList.add('hidden');
                            showToast('分类已添加');
                        }

                        function deleteCategory(name) {
                            var count = reminders.filter(function (r) { return r.category === name; }).length;
                            if (count > 0) {
                                showToast('该分类下有 ' + count + ' 个提醒，无法删除');
                                return;
                            }
                            categories = categories.filter(function (c) { return c.name !== name; });
                            saveLocalData();
                            renderCategories();
                            showToast('分类已删除');
                        }

                        // ========== 配置开关 ==========
                        function toggleConfig(key) {
                            config[key] = !config[key];
                            saveLocalData();
                            var el = document.querySelector('[data-config="' + key + '"]');
                            if (el) {
                                if (config[key]) {
                                    el.classList.add('on');
                                    el.classList.remove('off');
                                } else {
                                    el.classList.add('off');
                                    el.classList.remove('on');
                                }
                            }
                        }

                        function applyConfig() {
                            Object.keys(config).forEach(function (key) {
                                var el = document.querySelector('[data-config="' + key + '"]');
                                if (el) {
                                    el.classList.toggle('on', !!config[key]);
                                    el.classList.toggle('off', !config[key]);
                                }
                            });
                            var adv = document.getElementById('advance-time');
                            if (adv) adv.value = String(config.advance_hours || 0);
                        }

                        // ========== 事件绑定 ==========
                        function on(id, evt, handler) {
                            var el = document.getElementById(id);
                            if (el) el.addEventListener(evt, handler);
                            return el;
                        }

                        function bindEvents() {
                            if (eventsBound) return;
                            eventsBound = true;

                            // 筛选按钮
                            document.querySelectorAll('.filter-btn').forEach(function (btn) {
                                btn.addEventListener('click', function () {
                                    currentFilter = btn.dataset.filter;
                                    document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
                                    btn.classList.add('active');
                                    renderList();
                                });
                            });

                            // 添加按钮
                            var addBtn = document.getElementById('add-reminder-btn');
                            if (addBtn) addBtn.addEventListener('click', function () { openModal(null); });

                            // 模态框
                            on('modal-close', 'click', closeModal);
                            on('modal-cancel', 'click', closeModal);
                            on('modal-save', 'click', saveReminder);
                            on('reminder-modal', 'click', function (e) {
                                if (e.target === this) closeModal();
                            });

                            // 重复按钮
                            document.querySelectorAll('.repeat-btn').forEach(function (btn) {
                                btn.addEventListener('click', function () {
                                    selectedRepeat = btn.dataset.repeat;
                                    document.querySelectorAll('.repeat-btn').forEach(function (b) {
                                        b.classList.remove('bg-brand-50', 'text-brand-600', 'border-brand-300');
                                        b.classList.add('text-gray-600');
                                    });
                                    btn.classList.add('bg-brand-50', 'text-brand-600', 'border-brand-300');
                                    btn.classList.remove('text-gray-600');
                                });
                            });

                            // 列表事件委托
                            var list = document.getElementById('reminder-list');
                            if (list) list.addEventListener('click', function (e) {
                                var card = e.target.closest('.reminder-card');
                                if (!card) return;
                                var id = card.dataset.id;

                                if (e.target.closest('.toggle-done-btn')) {
                                    toggleDone(id);
                                } else if (e.target.closest('.edit-btn')) {
                                    openModal(id);
                                } else if (e.target.closest('.delete-btn')) {
                                    openDeleteModal(id);
                                }
                            });

                            // 删除确认
                            on('delete-cancel', 'click', function () {
                                var dm = document.getElementById('delete-modal');
                                if (dm) dm.classList.add('hidden');
                                deletingId = null;
                            });
                            on('delete-confirm', 'click', confirmDelete);
                            on('delete-modal', 'click', function (e) {
                                if (e.target === this) { this.classList.add('hidden'); deletingId = null; }
                            });

                            // 日历导航
                            on('cal-prev', 'click', function () {
                                calMonth--;
                                if (calMonth < 0) { calMonth = 11; calYear--; }
                                renderCalendar();
                            });
                            on('cal-next', 'click', function () {
                                calMonth++;
                                if (calMonth > 11) { calMonth = 0; calYear++; }
                                renderCalendar();
                            });

                            // 日历点击：点击某天滚动到对应提醒
                            on('cal-grid', 'click', function (e) {
                                var cell = e.target.closest('.cal-day');
                                if (!cell || cell.classList.contains('other-month')) return;
                                var date = cell.dataset.date;
                                if (date) {
                                    currentFilter = 'all';
                                    document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
                                    var allBtn = document.querySelector('.filter-btn[data-filter="all"]');
                                    if (allBtn) allBtn.classList.add('active');
                                    renderList();
                                    // 滚动到对应提醒
                                    var cards = document.querySelectorAll('.reminder-card');
                                    for (var i = 0; i < cards.length; i++) {
                                        var r = reminders.find(function (x) { return x.id === cards[i].dataset.id; });
                                        if (r && r.date === date) {
                                            cards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            cards[i].style.transition = 'background 0.5s ease';
                                            cards[i].style.background = 'rgba(59,130,246,0.06)';
                                            setTimeout(function (c) { c.style.background = ''; }, 1500, cards[i]);
                                            break;
                                        }
                                    }
                                }
                            });

                            // 分类管理
                            on('add-category-btn', 'click', openCategoryModal);
                            on('cat-modal-close', 'click', function () {
                                var cm = document.getElementById('category-modal');
                                if (cm) cm.classList.add('hidden');
                            });
                            on('cat-modal-cancel', 'click', function () {
                                var cm = document.getElementById('category-modal');
                                if (cm) cm.classList.add('hidden');
                            });
                            on('cat-modal-save', 'click', saveCategory);
                            on('category-modal', 'click', function (e) {
                                if (e.target === this) this.classList.add('hidden');
                            });

                            // 颜色选择
                            document.querySelectorAll('.cat-color-btn').forEach(function (btn) {
                                btn.addEventListener('click', function () {
                                    selectedCatColor = { color: btn.dataset.color, cls: btn.dataset.cls };
                                    updateColorPicker();
                                });
                            });

                            // 分类删除（事件委托）
                            var catList = document.getElementById('category-list');
                            if (catList) catList.addEventListener('click', function (e) {
                                var delBtn = e.target.closest('.del-cat-btn');
                                if (delBtn) {
                                    deleteCategory(delBtn.dataset.name);
                                }
                            });

                            // 配置开关
                            document.querySelectorAll('.toggle-switch[data-config]').forEach(function (el) {
                                el.addEventListener('click', function () {
                                    toggleConfig(el.dataset.config);
                                });
                            });

                            // 提前提醒时间
                            var adv = document.getElementById('advance-time');
                            if (adv) {
                                adv.addEventListener('change', function () {
                                    config.advance_hours = parseInt(adv.value);
                                    saveLocalData();
                                });
                            }
                        }

                        // ========== 初始化 ==========
                        function init() {
                            var now = new Date();
                            calYear = now.getFullYear();
                            calMonth = now.getMonth();

                            loadLocalData();
                            applyConfig();
                            renderCategories();
                            bindEvents();
                            loadReminders();
                        }

                        // SPA 切换时重新加载数据
                        window.addEventListener('spa:ready', function (e) {
                            var page = (e.detail && e.detail.page) || '';
                            if (page && page.indexOf('reminder') === -1) return;
                            // 重新加载数据（事件已绑定，不重复绑定）
                            loadLocalData();
                            applyConfig();
                            renderCategories();
                            loadReminders();
                        });

                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', init);
                        } else {
                            init();
                        }
                    })();
                    
                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
