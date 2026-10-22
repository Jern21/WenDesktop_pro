/**
 * 从工作台点「今日提醒 / 逾期提醒」时，待办页打开后滚到对应分组。
 * 读一次就清掉，避免之后每次进待办都跳。
 */
export var reminderEntry = { bucket: '' };

export function openReminderBucket(bucket) {
    reminderEntry.bucket = bucket || '';
}

export function takeReminderBucket() {
    var bucket = reminderEntry.bucket;
    reminderEntry.bucket = '';
    return bucket;
}
