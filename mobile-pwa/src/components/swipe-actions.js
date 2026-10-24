/**
 * 列表项左滑动作（通用组件）
 *
 * 为什么要独立成组件：
 *  「左滑露出操作按钮」是列表的通用交互（订单、客户、提醒…），
 *  手势判定、回弹、互斥这些细节一旦各页面各写一遍，手感就会不一致。
 *
 * 用法：
 *   renderItem 返回：
 *     '<div class="swipe-row">' +
 *     '  <div class="swipe-actions">' +
 *     '    <button type="button" class="swipe-act" data-swipe="edit">编辑</button>' +
 *     '    <button type="button" class="swipe-act is-danger" data-swipe="del">删除</button>' +
 *     '  </div>' +
 *     '  <div class="swipe-content">…卡片…</div>' +
 *     '</div>'
 *   然后 attachSwipeActions(listEl, {
 *       onAction: function (act, row) { … }   // act = data-swipe 值，row = .swipe-row 元素
 *   })
 *
 * 说明：
 *  - 只处理手势与开合，动作语义由调用方决定；
 *  - 一行打开时再滑另一行，前者自动合上；
 *  - 打开状态下点卡片 = 合上（不会误触发 onItemClick），点动作钮才走 onAction。
 */

/** 手指横向位移超过此值才算「在滑」而不是误触 */
var INTENT_PX = 8;
/** 滑过动作区宽度的这个比例就松手定格打开 */
var OPEN_RATIO = 0.4;

export function attachSwipeActions(listEl, opts) {
    var o = opts || {};
    var openEl = null;      // 当前展开的 .swipe-row
    var state = null;       // 进行中的手势
    var suppressClick = false;

    function actionsWidth(row) {
        var acts = row.querySelector('.swipe-actions');
        return acts ? acts.offsetWidth : 0;
    }

    function setX(row, px, animate) {
        var content = row.querySelector('.swipe-content');
        if (!content) return;
        content.style.transition = animate === false ? 'none' : '';
        content.style.transform = 'translateX(' + px + 'px)';
    }

    function closeRow(row) {
        if (!row) return;
        setX(row, 0);
        row.classList.remove('is-open');
        row.classList.remove('is-active');
        if (openEl === row) openEl = null;
    }

    function closeOpen() {
        if (openEl) closeRow(openEl);
    }

    function onStart(e) {
        // 点在动作钮上：别动行。若在 touchstart 就合行，卡片会滑回来盖住按钮，
        // click 落点被内容层抢走 → 「点编辑只触发了回弹」就是这里出的问题。
        if (e.target.closest && e.target.closest('.swipe-actions')) {
            state = null;
            return;
        }
        var content = e.target.closest && e.target.closest('.swipe-content');
        var row = content && content.parentNode.classList.contains('swipe-row')
            ? content.parentNode : null;
        if (!row || !listEl.contains(row)) {
            // 点在别处：有打开的顺手合上
            if (openEl) closeOpen();
            state = null;
            return;
        }
        var t = e.touches[0];
        state = {
            row: row,
            content: content,
            x0: t.clientX,
            y0: t.clientY,
            base: row.classList.contains('is-open') ? -actionsWidth(row) : 0,
            dx: 0,
            intent: null   // null=未判定 'x'=横滑 'y'=纵滚
        };
        // 滑的是另一行时，把已打开的合上（不拦本次手势）
        if (openEl && openEl !== row) closeOpen();
    }

    function onMove(e) {
        if (!state) return;
        var t = e.touches[0];
        var dx = t.clientX - state.x0;
        var dy = t.clientY - state.y0;

        if (state.intent === null && (Math.abs(dx) > INTENT_PX || Math.abs(dy) > INTENT_PX)) {
            state.intent = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (state.intent === 'y') {
                // 纵滚：放弃本次手势，有打开的行也顺势合上
                if (state.row.classList.contains('is-open')) closeRow(state.row);
                state = null;
                return;
            }
            // 判定为横滑才亮出动作区 —— 平时 visibility:hidden，
            // 快速滚动时不会先看到一截按钮（合成层上屏顺序问题）
            state.row.classList.add('is-active');
        }
        if (state.intent !== 'x') return;

        state.dx = dx;
        var w = actionsWidth(state.row);
        // 只允许左滑（dx<0）露出右侧动作；向右最多回到 0（带一点阻尼感）
        var x = Math.min(0, Math.max(-w, state.base + dx));
        setX(state.row, x, false);
        if (e.cancelable) e.preventDefault();   // 横滑进行中：阻止纵滚抢手势
    }

    function onEnd() {
        if (!state) return;
        var row = state.row;
        var w = actionsWidth(row);
        var moved = state.intent === 'x' && Math.abs(state.dx) > INTENT_PX;
        if (moved) suppressClick = true;   // 本次滑动了 → 吃掉随后的 click

        var x = Math.min(0, Math.max(-w, state.base + state.dx));
        if (x <= -w * OPEN_RATIO && w > 0) {
            setX(row, -w);
            row.classList.add('is-open');
            openEl = row;
        } else {
            closeRow(row);
        }
        row.classList.remove('is-active');   // is-open 接管动作区可见性
        state = null;
    }

    function onClick(e) {
        var actBtn = e.target.closest && e.target.closest('[data-swipe]');
        if (actBtn && listEl.contains(actBtn)) {
            var row = actBtn.closest('.swipe-row');
            closeRow(row);
            // 传 .swipe-row 本身 —— 调用方自己决定怎么找回数据（lv-item/data-id 各有打法）
            if (o.onAction) o.onAction(actBtn.getAttribute('data-swipe'), row);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        var row2 = e.target.closest && e.target.closest('.swipe-row');
        if ((suppressClick || (row2 && row2.classList.contains('is-open'))) &&
            row2 && listEl.contains(row2)) {
            // 刚滑完 / 行还开着 → 这次点击只负责合上，不进详情
            suppressClick = false;
            closeRow(row2);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        suppressClick = false;
    }

    listEl.addEventListener('touchstart', onStart, { passive: true });
    listEl.addEventListener('touchmove', onMove, { passive: false });
    listEl.addEventListener('touchend', onEnd);
    listEl.addEventListener('touchcancel', onEnd);
    // capture 阶段拦截：抢在 list-view 的 onItemClick 之前
    listEl.addEventListener('click', onClick, true);

    return {
        close: closeOpen,
        destroy: function () {
            listEl.removeEventListener('touchstart', onStart);
            listEl.removeEventListener('touchmove', onMove);
            listEl.removeEventListener('touchend', onEnd);
            listEl.removeEventListener('touchcancel', onEnd);
            listEl.removeEventListener('click', onClick, true);
        }
    };
}
