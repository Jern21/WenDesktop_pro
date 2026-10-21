'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'frontend', 'js');
let src = fs.readFileSync(path.join(root, '_shiba_legacy_extract.js'), 'utf8');
src = src.replace(/var SHIBA_PALETTE[\s\S]*?var SHIBA_SPRITES[\s\S]*?};\s*\n\s*\n/, '');
src = src.replace(/function drawShibaPixelFrame[\s\S]*?^}\s*\n\s*\n/m, '');

const oldDraw = /    \/\/ ---- 选择精灵帧 ----[\s\S]*?    ctx\.restore\(\);\s*\n/;
const newDraw = `    var breathOffset = 0;
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

`;
if (!oldDraw.test(src)) throw new Error('render block not found');
src = src.replace(oldDraw, newDraw);
src = src.replace(/\n\/\*\*[\s\S]*$/, '');

src = src.replace(
    'function initShibaPet() {',
    'function initShibaPet() {\n    var petArea0 = document.getElementById(\'shiba-pet-area\');\n    if (petArea0 && petArea0.dataset.shibaInited === \'1\') return;'
);
src = src.replace('renderShibaLoop();', 'ensureShibaVectorDom();\n    renderShibaLoop();');
src = src.replace(/    \}, 9000\);\n\}/, '    }, 9000);\n\n    if (petArea) petArea.dataset.shibaInited = \'1\';\n}');

const helpers = fs.readFileSync(path.join(__dirname, 'shiba-svg-helpers.js'), 'utf8');
const out = '(function (global) {\n\'use strict\';\n\n' + helpers + '\n' + src + '\n\nglobal.initShibaPet = initShibaPet;\n})(typeof window !== \'undefined\' ? window : this);\n';
fs.writeFileSync(path.join(root, 'shiba-pet.js'), out);
console.log('OK', out.split('\n').length, 'lines');
