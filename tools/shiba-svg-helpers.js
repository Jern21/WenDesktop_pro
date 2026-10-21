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
