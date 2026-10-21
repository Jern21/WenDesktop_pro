(function (global) {
'use strict';

var SHIBA_DOG_W = 54;
var SHIBA_DOG_H = 48;

function shibaSvgInner() {
    return '<svg viewBox="0 0 180 160" class="w-full h-full overflow-visible" aria-hidden="true">' +
        '<g id="shiba-dog-flip" transform="translate(90, 95)">' +
        '<g id="shiba-dog-bounce">' +
        '<g id="shiba-svg-tail" transform="translate(-36, -12)"><path fill="#f59e0b" d="M 4 4 C -18 -2, -28 -26, -8 -34 C 6 -39, 14 -20, 2 -10 Z" stroke="#3b1d0f" stroke-width="4" stroke-linejoin="round"/><path fill="#fffbeb" d="M -14 -20 C -20 -27, -14 -35, -6 -33 C 0 -31, 1 -23, -6 -20 Z" /></g>' +
        '<g id="shiba-leg-bl" transform="translate(-26, 15)"><rect fill="#d97706" x="-7" y="0" width="14" height="27" rx="7" stroke="#3b1d0f" stroke-width="4"/><ellipse fill="#fffbeb" cx="2" cy="24" rx="8" ry="5" stroke="#3b1d0f" stroke-width="3.5"/></g>' +
        '<g id="shiba-leg-fl" transform="translate(20, 15)"><rect fill="#d97706" x="-7" y="0" width="14" height="27" rx="7" stroke="#3b1d0f" stroke-width="4"/><ellipse fill="#fffbeb" cx="2" cy="24" rx="8" ry="5" stroke="#3b1d0f" stroke-width="3.5"/></g>' +
        '<g id="shiba-torso"><path fill="#f59e0b" d="M -38 -10 C -38 -25, 28 -26, 34 -8 C 40 8, 34 24, 18 24 L -24 24 C -38 24, -40 6, -38 -10 Z" stroke="#3b1d0f" stroke-width="4" stroke-linejoin="round"/><path fill="#fffbeb" d="M -18 22 C -6 10, 18 10, 30 16 C 35 7, 36 -2, 30 -6 C 22 0, 16 12, -18 22 Z" /></g>' +
        '<g id="shiba-leg-br" transform="translate(-16, 17)"><path fill="#f59e0b" d="M -9 -4 L -7 24 A 7 7 0 0 0 7 24 L 8 -4" stroke="#3b1d0f" stroke-width="4" stroke-linecap="round"/><ellipse fill="#fffbeb" cx="2" cy="24" rx="8.5" ry="5.5" stroke="#3b1d0f" stroke-width="3.5"/></g>' +
        '<g id="shiba-leg-fr" transform="translate(28, 17)"><path fill="#f59e0b" d="M -8 -4 L -7 24 A 7 7 0 0 0 7 24 L 7 -4" stroke="#3b1d0f" stroke-width="4" stroke-linecap="round"/><ellipse fill="#fffbeb" cx="2" cy="24" rx="8.5" ry="5.5" stroke="#3b1d0f" stroke-width="3.5"/></g>' +
        '<g id="shiba-collar"><path d="M 12 -15 Q 25 0 35 -5" fill="none" stroke="#e11d48" stroke-width="7" stroke-linecap="round"/><circle cx="31" cy="1" r="6.5" fill="#fbbf24" stroke="#3b1d0f" stroke-width="3"/><line x1="28" y1="2" x2="34" y2="2" stroke="#3b1d0f" stroke-width="2" stroke-linecap="round"/></g>' +
        '<g id="shiba-head" transform="translate(24, -26)">' +
        '<g id="shiba-ear-r" transform="translate(14, -22)"><path fill="#d97706" d="M -8 4 L 6 -18 L 16 6 Z" stroke="#3b1d0f" stroke-width="4" stroke-linejoin="round"/></g>' +
        '<path fill="#f59e0b" d="M -24 -6 C -26 -28, 18 -32, 24 -10 C 33 -8, 39 -2, 37 6 C 35 15, 22 18, 6 18 C -14 18, -23 10, -24 -6 Z" stroke="#3b1d0f" stroke-width="4" stroke-linejoin="round"/>' +
        '<path fill="#fffbeb" d="M -8 16 C -10 4, 4 -3, 18 -2 C 28 -4, 36 0, 35 7 C 33 14, 21 17, 6 17 C -2 17, -6 16, -8 16 Z" />' +
        '<ellipse fill="#fffbeb" cx="7" cy="-14" rx="4.2" ry="2.6" transform="rotate(-10 7 -14)"/>' +
        '<ellipse fill="#fffbeb" cx="21" cy="-15" rx="3.2" ry="2.2" transform="rotate(12 21 -15)"/>' +
        '<ellipse id="shiba-blush" cx="5" cy="4" rx="6" ry="3.5" fill="#fb7185" opacity="0.22"/>' +
        '<g id="shiba-tongue" transform="translate(22, 11) scale(0)"><path d="M -4 0 L -4 9 A 5 5 0 0 0 6 9 L 6 0 Z" fill="#fb7185" stroke="#3b1d0f" stroke-width="3" stroke-linejoin="round"/><line x1="1" y1="2" x2="1" y2="9" stroke="#e11d48" stroke-width="2" stroke-linecap="round"/></g>' +
        '<path d="M 16 8 Q 22 13 28 7" fill="none" stroke="#3b1d0f" stroke-width="3.2" stroke-linecap="round"/>' +
        '<ellipse cx="34" cy="-2" rx="5.2" ry="3.8" fill="#271206"/><ellipse cx="35" cy="-3.2" rx="1.8" ry="1" fill="#ffffff" opacity="0.8"/>' +
        '<g id="shiba-eye-open"><circle cx="13" cy="-5" r="4.6" fill="#271206"/><circle cx="14.5" cy="-6.5" r="1.7" fill="#ffffff"/></g>' +
        '<g id="shiba-eye-happy" style="display:none"><path d="M 8 -4 Q 13 -11 18 -4" fill="none" stroke="#271206" stroke-width="3.6" stroke-linecap="round"/></g>' +
        '<g id="shiba-ear-l" transform="translate(-8, -20)"><path fill="#f59e0b" d="M -10 8 L -4 -19 L 12 4 Z" stroke="#3b1d0f" stroke-width="4" stroke-linejoin="round"/><path d="M -5 5 L -2 -10 L 6 3 Z" fill="#fda4af" opacity="0.75"/></g>' +
        '</g></g></g></g></svg>';
}

function ensureShibaVectorDom() {
    if (shibaState && shibaState.svg) return;
    var mount = document.getElementById('shiba-dog-mount');
    if (!mount) return;
    mount.innerHTML = '<div id="shiba-dog-entity"></div>';
    var el = document.getElementById('shiba-dog-entity');
    el.style.width = SHIBA_DOG_W + 'px';
    el.style.height = SHIBA_DOG_H + 'px';
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.willChange = 'transform';
    el.style.pointerEvents = 'none';
    el.innerHTML = shibaSvgInner();
    shibaState.svg = {
        root: el,
        flip: document.getElementById('shiba-dog-flip'),
        bounce: document.getElementById('shiba-dog-bounce'),
        tail: document.getElementById('shiba-svg-tail'),
        legBl: document.getElementById('shiba-leg-bl'),
        legFl: document.getElementById('shiba-leg-fl'),
        legBr: document.getElementById('shiba-leg-br'),
        legFr: document.getElementById('shiba-leg-fr'),
        head: document.getElementById('shiba-head'),
        earL: document.getElementById('shiba-ear-l'),
        earR: document.getElementById('shiba-ear-r'),
        eyeOpen: document.getElementById('shiba-eye-open'),
        eyeHappy: document.getElementById('shiba-eye-happy'),
        blush: document.getElementById('shiba-blush'),
        tongue: document.getElementById('shiba-tongue'),
        tailCycle: 0
    };
}

function updateShibaVectorDog(opts) {
    ensureShibaVectorDom();
    var s = shibaState.svg;
    if (!s) return;
    var isHover = opts.mode === 'HOVERED';
    var isSleep = opts.mode === 'SLEEPING';
    var tailRate = isHover ? 0.14 : (opts.walkSpeed > 0 ? 0.18 : 0.08);
    s.tailCycle += tailRate;
    var legSwing = isSleep ? 0 : opts.legSwing;
    var bodyBobY = isSleep ? Math.sin(s.tailCycle * 0.5) * 1.2 : 0;
    var headTilt = isSleep ? 8 : (isHover ? -6 + Math.sin(s.tailCycle * 0.28) * 2 : Math.sin(opts.ticks * 0.08) * 2.5);
    var earPerk = isHover ? -6 + Math.sin(s.tailCycle * 0.35) * 3 : Math.cos(opts.ticks * 0.08) * 4;
    var scaleX = isHover ? 1 : opts.direction;
    if (opts.isJumping) legSwing = 28;
    var tailAngle = Math.sin(s.tailCycle) * (isHover ? 16 : (isSleep ? 6 : 15));
    if (isHover) {
        s.eyeOpen.style.display = 'none';
        s.eyeHappy.style.display = 'block';
        s.blush.setAttribute('opacity', '0.65');
        var tongueScale = 1 + Math.sin(s.tailCycle * 0.55) * 0.1;
        s.tongue.setAttribute('transform', 'translate(22, 11) scale(1, ' + tongueScale.toFixed(2) + ')');
    } else {
        s.eyeOpen.style.display = 'block';
        s.eyeHappy.style.display = 'none';
        s.blush.setAttribute('opacity', isSleep ? '0.15' : '0.22');
        s.tongue.setAttribute('transform', 'translate(22, 11) scale(0)');
    }
    var left = opts.posX + (SHIBA_SPRITE_W - SHIBA_DOG_W) / 2;
    var top = opts.posY + opts.visualY + (SHIBA_SPRITE_H - SHIBA_DOG_H) / 2;
    s.root.style.transform = 'translate3d(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px,0)' + (isSleep ? ' rotate(-12deg)' : '');
    s.flip.setAttribute('transform', 'translate(90, 95) scale(' + scaleX + ', 1)');
    s.bounce.setAttribute('transform', 'translate(0, ' + bodyBobY.toFixed(2) + ')');
    s.legFr.setAttribute('transform', 'translate(28, 17) rotate(' + legSwing.toFixed(1) + ', 0, 2)');
    s.legBl.setAttribute('transform', 'translate(-26, 15) rotate(' + legSwing.toFixed(1) + ', 0, 2)');
    s.legFl.setAttribute('transform', 'translate(20, 15) rotate(' + (-legSwing).toFixed(1) + ', 0, 2)');
    s.legBr.setAttribute('transform', 'translate(-16, 17) rotate(' + (-legSwing).toFixed(1) + ', 0, 2)');
    s.tail.setAttribute('transform', 'translate(-36, -12) rotate(' + tailAngle.toFixed(1) + ', 4, 4)');
    s.head.setAttribute('transform', 'translate(24, -26) rotate(' + headTilt.toFixed(1) + ', 0, 10)');
    s.earL.setAttribute('transform', 'translate(-8, -20) rotate(' + earPerk.toFixed(1) + ', 0, 5)');
    s.earR.setAttribute('transform', 'translate(14, -22) rotate(' + (-earPerk * 0.8).toFixed(1) + ', 0, 5)');
}

// ========== 柴犬桌宠逻辑 ==========

var SHIBA_SPEECHES = [
    '汪！今天也要开心呀！🐾',
    '贴贴你，继续加油！✨',
    '呼哧呼哧... 一直陪着你！🐕',
    '捏捏我的毛绒小耳朵吧~ 🐶',
    '最喜欢你啦！❤️',
    '累了就伸个懒腰汪！',
    '代码写完了？真棒！🎉',
    '陪你改bug到天亮！💪',
    '摸摸我的头就好啦~',
    '今天接了几个单呀？💰'
];

var SHIBA_IDLE_SPEECHES = [
    '呼噜噜... 好困呀 ~',
    '发呆中... 🤔',
    '今天天气不错汪！☀️',
    '要不要休息一下？',
    '我在看着你哦！👀',
    '喝口水再继续吧~',
    '伸个懒腰~ 啊呜'
];

var SHIBA_SLEEP_SPEECHES = [
    '呼噜... 梦到骨头了...',
    'zzZ... 不要吵我...',
    '梦里在跑酷汪！'
];

var SHIBA_BUTTERFLY_SPEECHES = [
    '好多蝴蝶呀！🦋',
    '别飞走嘛~',
    '蝴蝶好漂亮！',
    '抓蝴蝶咯！汪！'
];

var SHIBA_RAIN_SPEECHES = [
    '下雨了汪... ☔',
    '淋湿了要感冒的！',
    '快躲雨呀~',
    '雨滴滴答答的...'
];

// ========== 场景：蝴蝶 & 雨天 ==========

var BUTTERFLY_COLORS = ['#f472b6', '#a78bfa', '#fbbf24', '#60a5fa', '#fb923c', '#4ade80'];

var SHIBA_PIXEL_SCALE = 2;
var SHIBA_SPRITE_W = 16 * 2;   // 32px
var SHIBA_SPRITE_H = 16 * 2;   // 32px
var SHIBA_CANVAS_W = 200;
var SHIBA_CANVAS_H = 64;
var SHIBA_SPRITE_OFFSET_X = (200 - 32) / 2; // 84px 水平居中
var SHIBA_SPRITE_OFFSET_Y = 64 - 32 - 4;     // 28px 贴底放置，留出跳跃空间
var SHIBA_WALK_BOUND = 76;  // 行走边界（像素）
var shibaState = null;

function initShibaPet() {
    var petArea0 = document.getElementById('shiba-pet-area');
    if (petArea0 && petArea0.dataset.shibaInited === '1') return;
    var canvas = document.getElementById('shiba-canvas');
    var petArea = document.getElementById('shiba-pet-area');
    if (!canvas || !petArea) return;

    canvas.width = SHIBA_CANVAS_W;
    canvas.height = SHIBA_CANVAS_H;

    shibaState = {
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        petArea: petArea,
        mode: 'IDLE',            // IDLE, HOVERED, SLEEPING
        ticks: 0,
        speechTimer: 0,
        vy: 0,
        jumpOffset: 0,
        isJumping: false,
        direction: 1,            // 1=右, -1=左
        walkOffset: 0,
        walkSpeed: 0,
        walkTimer: Math.floor(Math.random() * 200) + 100,
        idleTimer: 0,
        walkAnimPhase: 0,
        // 场景系统
        sceneType: 'butterflies',
        sceneSwitchTimer: 0,
        butterflies: [],
        raindrops: [],
        splashes: []
    };

    // ---- Hover：回头看你 ----
    petArea.addEventListener('mouseenter', function () {
        shibaState.mode = 'HOVERED';
        shibaState.walkSpeed = 0;
        shibaState.idleTimer = 0;
    });
    petArea.addEventListener('mouseleave', function () {
        if (shibaState.mode === 'HOVERED') {
            shibaState.mode = 'IDLE';
            shibaState.walkTimer = Math.floor(Math.random() * 150) + 100;
        }
    });

    if (global.ShibaDialogue && typeof global.ShibaDialogue.setTimerHook === 'function') {
        global.ShibaDialogue.setTimerHook(function (frames) {
            if (shibaState) shibaState.speechTimer = frames;
        });
    }

    // ---- Click：蹦跳 + 对话气泡（Agent 接入点）----
    petArea.addEventListener('click', function () {
        if (shibaState.mode === 'SLEEPING') {
            shibaState.mode = 'IDLE';
            shibaState.idleTimer = 0;
        }
        if (!shibaState.isJumping) {
            shibaState.vy = -4;
            shibaState.isJumping = true;
        }
        var ctx = {
            mode: shibaState.mode,
            path: global.location && global.location.pathname,
            view: global.App && global.App.router && global.App.router.current
                ? global.App.router.current().name
                : null,
            timestamp: Date.now()
        };
        if (global.ShibaDialogue && typeof global.ShibaDialogue.handlePetClick === 'function') {
            global.ShibaDialogue.handlePetClick(ctx);
        } else {
            triggerShibaSpeech(SHIBA_SPEECHES[Math.floor(Math.random() * SHIBA_SPEECHES.length)]);
        }
    });

    // 初始化场景（固定从蝴蝶开始）
    shibaState.sceneType = 'butterflies';
    shibaState.sceneSwitchTimer = Math.floor(Math.random() * 600) + 900;
    initButterflies();

    // 启动渲染循环
    ensureShibaVectorDom();
    renderShibaLoop();

    // 初次打招呼
    setTimeout(function () {
        triggerShibaSpeech('汪！你好呀，我是小柴~ 🐶');
    }, 1200);

    // 随机闲聊（每 9 秒检查一次）
    setInterval(function () {
        if (!shibaState || shibaState.speechTimer > 0) return;
        if (global.ShibaDialogue && global.ShibaDialogue.isPanelOpen && global.ShibaDialogue.isPanelOpen()) return;
        if (shibaState.mode === 'IDLE' && Math.random() < 0.35) {
            var msg = SHIBA_IDLE_SPEECHES[Math.floor(Math.random() * SHIBA_IDLE_SPEECHES.length)];
            triggerShibaSpeech(msg);
        } else if (shibaState.mode === 'SLEEPING' && Math.random() < 0.25) {
            var msg2 = SHIBA_SLEEP_SPEECHES[Math.floor(Math.random() * SHIBA_SLEEP_SPEECHES.length)];
            triggerShibaSpeech(msg2);
        }
    }, 9000);

    if (petArea) petArea.dataset.shibaInited = '1';
}

function triggerShibaSpeech(text) {
    if (global.ShibaDialogue && typeof global.ShibaDialogue.show === 'function') {
        global.ShibaDialogue.show({ text: text, kind: 'chat' });
        return;
    }
    var bubble = document.getElementById('shiba-bubble');
    var bText = document.getElementById('shiba-bubble-text');
    if (!bubble || !bText || !shibaState) return;
    bText.innerText = text;
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    shibaState.speechTimer = 160;
}

function drawPixelHeart(ctx, cx, cy) {
    var heart = [
        [0,1,1,0,1,1,0],
        [1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1],
        [0,1,1,1,1,1,0],
        [0,0,1,1,1,0,0],
        [0,0,0,1,0,0,0]
    ];
    ctx.fillStyle = '#ef4444';
    for (var r = 0; r < heart.length; r++) {
        for (var c = 0; c < heart[r].length; c++) {
            if (heart[r][c]) {
                ctx.fillRect(cx + c, cy + r, 1, 1);
            }
        }
    }
}

// ========== 场景系统函数 ==========

function initButterflies() {
    shibaState.butterflies = [];
    var count = 4 + Math.floor(Math.random() * 2);
    for (var i = 0; i < count; i++) {
        shibaState.butterflies.push({
            x: Math.random() * (SHIBA_CANVAS_W - 20) + 10,
            y: Math.random() * 28 + 4,
            vx: (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2),
            vy: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.1),
            t: Math.floor(Math.random() * 100),
            color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
            fade: 0
        });
    }
}

function initRaindrops() {
    shibaState.raindrops = [];
    var count = 35 + Math.floor(Math.random() * 15);
    for (var i = 0; i < count; i++) {
        shibaState.raindrops.push({
            x: Math.random() * SHIBA_CANVAS_W,
            y: Math.random() * SHIBA_CANVAS_H - SHIBA_CANVAS_H,
            speed: 2 + Math.random() * 2,
            length: 3 + Math.floor(Math.random() * 3),
            opacity: 0.25 + Math.random() * 0.35
        });
    }
    shibaState.splashes = [];
}

function switchShibaScene() {
    // 固定交替：蝴蝶 → 下雨 → 蝴蝶 → 下雨
    shibaState.sceneType = shibaState.sceneType === 'butterflies' ? 'rain' : 'butterflies';
    shibaState.sceneSwitchTimer = Math.floor(Math.random() * 600) + 900;
    // 彻底清空上一个场景的数据，确保互不干扰
    shibaState.butterflies = [];
    shibaState.raindrops = [];
    shibaState.splashes = [];
    if (shibaState.sceneType === 'butterflies') {
        initButterflies();
    } else {
        initRaindrops();
    }
    // 不触发台词，不干扰柴犬当前状态（睡眠/行走/对话等）
}

function updateAndDrawButterflies(ctx) {
    var butterflies = shibaState.butterflies;
    for (var i = 0; i < butterflies.length; i++) {
        var b = butterflies[i];

        // 运动：基础速度 + 正弦扰动，模拟蝴蝶飘忽不定
        b.t++;
        b.x += b.vx + Math.sin(b.t * 0.05) * 0.1;
        b.y += b.vy + Math.cos(b.t * 0.05) * 0.1;

        // 边界反弹
        if (b.x < 3) b.vx = Math.abs(b.vx);
        else if (b.x > SHIBA_CANVAS_W - 8) b.vx = -Math.abs(b.vx);
        if (b.y < 3) b.vy = Math.abs(b.vy);
        else if (b.y > 34) b.vy = -Math.abs(b.vy);

        if (b.fade < 1) b.fade += 0.03;

        // 翅膀扇动：高度交替变化模拟扇翅
        var wingH = (b.t % 10 < 5) ? 4 : 2;
        var bx = Math.round(b.x);
        var by = Math.round(b.y);

        ctx.globalAlpha = Math.min(1, b.fade);
        // 左翅
        ctx.fillStyle = b.color;
        ctx.fillRect(bx, by, 2, wingH);
        // 右翅
        ctx.fillRect(bx + 3, by, 2, wingH);
        // 身体（中间 1px 深色）
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(bx + 2, by, 1, wingH);
    }
    ctx.globalAlpha = 1;
}

function updateAndDrawRain(ctx) {
    var drops = shibaState.raindrops;

    for (var i = 0; i < drops.length; i++) {
        var d = drops[i];

        // 更新位置（下落 + 微风偏移）
        d.y += d.speed;
        d.x += 0.4;

        // 落地产生水花后重置
        if (d.y >= SHIBA_CANVAS_H - 3) {
            if (Math.random() < 0.35) {
                shibaState.splashes.push({
                    x: d.x,
                    y: SHIBA_CANVAS_H - 3,
                    life: 6
                });
            }
            d.y = -d.length - Math.random() * 15;
            d.x = Math.random() * SHIBA_CANVAS_W;
        }
        if (d.x > SHIBA_CANVAS_W) {
            d.x -= SHIBA_CANVAS_W;
        }

        // 绘制雨滴
        ctx.globalAlpha = d.opacity;
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, d.length);
    }

    // 更新和绘制水花
    var splashes = shibaState.splashes;
    for (var j = splashes.length - 1; j >= 0; j--) {
        var s = splashes[j];
        s.life--;
        if (s.life <= 0) {
            splashes.splice(j, 1);
            continue;
        }
        var radius = (6 - s.life) * 0.8;
        ctx.globalAlpha = (s.life / 6) * 0.5;
        ctx.fillStyle = '#bfdbfe';
        ctx.fillRect(Math.round(s.x - radius), Math.round(s.y), 1, 1);
        ctx.fillRect(Math.round(s.x + radius), Math.round(s.y), 1, 1);
    }

    ctx.globalAlpha = 1;
}

function renderShibaLoop() {
    if (!shibaState || !shibaState.canvas) return;

    var ctx = shibaState.ctx;
    var canvas = shibaState.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    shibaState.ticks++;

    // ---- 场景切换计时 ----
    if (shibaState.sceneSwitchTimer > 0) {
        shibaState.sceneSwitchTimer--;
        if (shibaState.sceneSwitchTimer <= 0) {
            switchShibaScene();
        }
    }

    // ---- 对话气泡倒计时 ----
    if (shibaState.speechTimer > 0) {
        shibaState.speechTimer--;
        if (shibaState.speechTimer === 0) {
            var bubble = document.getElementById('shiba-bubble');
            if (bubble) {
                bubble.style.opacity = '0';
                bubble.style.transform = 'translateX(-50%) translateY(4px) scale(0.85)';
            }
        }
    }

    // ---- 跳跃物理 ----
    if (shibaState.isJumping) {
        shibaState.vy += 0.3;
        shibaState.jumpOffset += shibaState.vy;
        if (shibaState.jumpOffset >= 0) {
            shibaState.jumpOffset = 0;
            shibaState.vy = 0;
            shibaState.isJumping = false;
        }
    }

    // ---- 闲置行为：行走 + 入睡 ----
    if (shibaState.mode === 'IDLE' && !shibaState.isJumping) {
        shibaState.idleTimer++;

        if (shibaState.walkSpeed > 0) {
            // 行走中
            shibaState.walkOffset += shibaState.walkSpeed * shibaState.direction;
            shibaState.walkAnimPhase += 0.18;
            // 走到边界就转身（钳制在边界，不跳到另一侧）
            if (Math.abs(shibaState.walkOffset) > SHIBA_WALK_BOUND) {
                shibaState.walkOffset = SHIBA_WALK_BOUND * Math.sign(shibaState.walkOffset);
                shibaState.direction *= -1;
            }
            shibaState.walkTimer--;
            if (shibaState.walkTimer <= 0) {
                shibaState.walkSpeed = 0;
                shibaState.walkTimer = Math.floor(Math.random() * 150) + 100;
            }
        } else {
            // 站着不动，可能开始走
            shibaState.walkTimer--;
            if (shibaState.walkTimer <= 0) {
                shibaState.walkSpeed = 0.2 + Math.random() * 0.15;
                shibaState.walkTimer = Math.floor(Math.random() * 150) + 120;
                if (Math.random() < 0.5) shibaState.direction *= -1;
            }
        }

        // 闲置约 20 秒后入睡
        if (shibaState.idleTimer > 1200) {
            shibaState.mode = 'SLEEPING';
            shibaState.walkSpeed = 0;
        }
    }

    // ---- 睡眠中说话会醒来 ----
    if (shibaState.mode === 'SLEEPING') {
        if (shibaState.speechTimer > 155) {
            shibaState.mode = 'IDLE';
            shibaState.idleTimer = 0;
        }
    }

    // ---- 计算位置 ----
    var posX = SHIBA_SPRITE_OFFSET_X + shibaState.walkOffset;
    var posY = SHIBA_SPRITE_OFFSET_Y;

    // ---- 气泡跟随宠物水平位置 ----
    var bubble = document.getElementById('shiba-bubble');
    if (bubble && bubble.style.opacity === '1') {
        var petCenterX = posX + SHIBA_SPRITE_W / 2;
        var bubbleLeftPct = (petCenterX / SHIBA_CANVAS_W) * 100;
        bubble.style.left = bubbleLeftPct + '%';
    }

    // ---- 绘制雨天场景（背景层）----
    if (shibaState.sceneType === 'rain') {
        updateAndDrawRain(ctx);
    }

    // ---- 绘制阴影 ----
    var shadowScale = 1;
    if (shibaState.isJumping) {
        shadowScale = Math.max(0.4, 1 + shibaState.jumpOffset / 30);
    }
    ctx.fillStyle = 'rgba(28, 25, 23, 0.08)';
    ctx.beginPath();
    ctx.ellipse(
        posX + SHIBA_SPRITE_W / 2,
        SHIBA_CANVAS_H - 5,
        8 * shadowScale,
        2 * shadowScale,
        0, 0, Math.PI * 2
    );
    ctx.fill();

    var breathOffset = 0;
    if (!shibaState.isJumping) {
        if (shibaState.mode === 'SLEEPING') {
            breathOffset = Math.sin(shibaState.ticks * 0.04) * 1.2;
        } else {
            breathOffset = Math.sin(shibaState.ticks * 0.08) * 0.5;
        }
    }
    var walkBob = 0;
    if (shibaState.walkSpeed > 0 && !shibaState.isJumping) {
        walkBob = Math.abs(Math.sin(shibaState.walkAnimPhase)) * 1.5;
    }

    // ---- 矢量柴犬（仅替换形象，位置/交互沿用原逻辑）----
    var legSwing = 0;
    if (shibaState.walkSpeed > 0 && !shibaState.isJumping && shibaState.mode !== 'SLEEPING') {
        legSwing = Math.sin(shibaState.walkAnimPhase) * 22;
    }
    var visualY = shibaState.jumpOffset + breathOffset - walkBob;
    updateShibaVectorDog({
        posX: posX,
        posY: posY,
        visualY: visualY,
        direction: shibaState.direction,
        mode: shibaState.mode,
        isJumping: shibaState.isJumping,
        legSwing: legSwing,
        ticks: shibaState.ticks,
        walkSpeed: shibaState.walkSpeed
    });

    if (shibaState.mode === 'HOVERED') {
        var heartBob = Math.sin(shibaState.ticks * 0.12) * 2;
        drawPixelHeart(ctx, posX + SHIBA_SPRITE_W / 2 - 3, posY - 8 + heartBob + visualY);
    }

    if (shibaState.mode === 'SLEEPING') {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'left';
        var p1 = (shibaState.ticks % 120) / 120;
        ctx.globalAlpha = 1 - p1 * 0.7;
        ctx.fillText('Z', posX + SHIBA_SPRITE_W - 4 + p1 * 6, posY - 1 - p1 * 8 + visualY);
        var p2 = ((shibaState.ticks + 40) % 120) / 120;
        ctx.globalAlpha = 1 - p2 * 0.7;
        ctx.fillText('z', posX + SHIBA_SPRITE_W + p2 * 5, posY + 3 - p2 * 6 + visualY);
        ctx.globalAlpha = 1;
    }

    // ---- 绘制蝴蝶场景（前景层）----
    if (shibaState.sceneType === 'butterflies') {
        updateAndDrawButterflies(ctx);
    }

    requestAnimationFrame(renderShibaLoop);
}


global.initShibaPet = initShibaPet;
})(typeof window !== 'undefined' ? window : this);
