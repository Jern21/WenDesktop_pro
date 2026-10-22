/**
 * 订单编号：DD + YYYYMMDD + 3 位序号。
 * 序号取当天已有编号的最大值加一，不用条数，避免删掉中间一条后又生成同一个号。
 */
'use strict';

function nextOrderNo(orderNos, now) {
    now = now || new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var prefix = 'DD' + y + m + d;
    var max = 0;
    var seen = {};

    (orderNos || []).forEach(function (no) {
        if (typeof no !== 'string' || no.indexOf(prefix) !== 0) return;
        seen[no] = true;
        var n = parseInt(no.slice(prefix.length), 10);
        if (n > max) max = n;
    });

    var seq = max + 1;
    var candidate = prefix + String(seq).padStart(3, '0');
    while (seen[candidate]) {
        seq += 1;
        candidate = prefix + String(seq).padStart(3, '0');
    }
    return candidate;
}

module.exports = {
    nextOrderNo: nextOrderNo
};
