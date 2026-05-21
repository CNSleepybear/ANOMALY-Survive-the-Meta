// ==================== RULE ANOMALY SYSTEM ====================
// 25 rules across 7 categories

const RULES = [
    // --- PHYSICS (5) ---
    {
        id: 'gravity_reverse', name: '重力反转', desc: 'Y轴重力反向拖拽',
        category: 'physics', signature: 'G',
        apply() { gravity.y = -0.5; },
        remove() { gravity.y = 0; }
    },
    {
        id: 'zero_friction', name: '零摩擦力', desc: '滑行几乎不停止',
        category: 'physics', signature: 'F',
        apply() { friction = 0.992; },
        remove() { friction = 0.84; }
    },
    {
        id: 'bullet_bounce', name: '子弹反弹', desc: '子弹在边界反弹3次',
        category: 'physics', signature: 'B',
        apply() { bulletBounce = true; },
        remove() { bulletBounce = false; }
    },
    {
        id: 'magnetic_field', name: '磁力场', desc: '子弹受玩家磁力牵引偏转',
        category: 'physics', signature: 'M',
        apply() { magneticField = true; },
        remove() { magneticField = false; },
        update() {
            if (!magneticField) return;
            for (const b of bullets) {
                if (b.isEnemyBullet) continue;
                const mdx = player.x - b.x, mdy = player.y - b.y;
                const md = Math.sqrt(mdx * mdx + mdy * mdy) + 1;
                if (md < 250) { b.vx += (mdx / md) * 0.25; b.vy += (mdy / md) * 0.25; }
            }
        }
    },
    {
        id: 'repulsion_field', name: '斥力场', desc: '敌人靠近时会被弹开',
        category: 'physics', signature: 'P',
        apply() { repulsionField = true; },
        remove() { repulsionField = false; },
        update() {
            if (!repulsionField) return;
            for (const e of enemies) {
                const dx = player.x - e.x, dy = player.y - e.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 100 && d > 1) { e.x -= (dx / d) * 1.5; e.y -= (dy / d) * 1.5; }
            }
        }
    },

    // --- SPACE (5) ---
    {
        id: 'enemy_to_wall', name: '死亡固码', desc: '敌人死亡固化为阻挡源码块',
        category: 'space', signature: 'W',
        apply() {}, remove() {},
        onEnemyDeath(enemy) {
            const errors = ['404_NOT_FOUND', 'NullPointer', 'SEGFAULT', 'UNDEFINED', 'ACCESS_DENIED', 'STACK_OVERFLOW'];
            walls.push({
                x: enemy.x, y: enemy.y,
                width: 26, height: 26,
                life: 320,
                text: errors[Math.floor(Math.random() * errors.length)]
            });
        }
    },
    {
        id: 'screen_rotate', name: '视界偏转', desc: '画面周期性旋转90度',
        category: 'space', signature: 'O',
        apply() { screenRotation = Math.PI / 2; },
        remove() { screenRotation = 0; },
        update() { if (frameCount % 420 === 0) screenRotation += Math.PI / 2; }
    },
    {
        id: 'gravity_well', name: '重力井', desc: '屏幕中心产生强大引力',
        category: 'space', signature: 'WELL',
        apply() { gravityWell = true; },
        remove() { gravityWell = false; },
        update() {
            if (!gravityWell) return;
            const cx = 480, cy = 270;
            const gdx = cx - player.x, gdy = cy - player.y;
            const gd = Math.sqrt(gdx * gdx + gdy * gdy) + 1;
            if (gd < 400) { player.vx += (gdx / gd) * 0.12; player.vy += (gdy / gd) * 0.12; }
            for (const e of enemies) {
                const edx = cx - e.x, edy = cy - e.y;
                const ed = Math.sqrt(edx * edx + edy * edy) + 1;
                if (ed < 400) { e.x += (edx / ed) * 0.06; e.y += (edy / ed) * 0.06; }
            }
        }
    },
    {
        id: 'wormhole', name: '虫洞干扰', desc: '玩家偶尔被随机传送',
        category: 'space', signature: 'HOLE',
        apply() {}, remove() {},
        update() {
            if (frameCount % 200 === 0 && Math.random() < 0.35) {
                player.x = 80 + Math.random() * 800;
                player.y = 60 + Math.random() * 420;
                spawnParticles(player.x, player.y, '#9b59b6', 20);
                screenShake = 12;
            }
        }
    },
    {
        id: 'arena_shrink', name: '空间坍缩', desc: '活动范围逐渐缩小',
        category: 'space', signature: 'COLLAPSE',
        apply() { arenaShrink = 0; },
        remove() { arenaShrink = 0; },
        update() {
            arenaShrink += 0.08;
            const margin = 40 + arenaShrink;
            if (player.x < margin) player.x = margin;
            if (player.x > 960 - margin) player.x = 960 - margin;
            if (player.y < margin) player.y = margin;
            if (player.y > 540 - margin) player.y = 540 - margin;
        }
    },

    // --- INTERACT (4) ---
    {
        id: 'attack_recoil', name: '动能反冲', desc: '射击会产生超强后坐力',
        category: 'interact', signature: 'R',
        apply() {}, remove() {},
        onShoot() {
            const r = 10;
            player.vx -= Math.cos(player.angle) * r;
            player.vy -= Math.sin(player.angle) * r;
        }
    },
    {
        id: 'stationary_damage', name: '静止惩罚', desc: '站着不动持续扣血',
        category: 'interact', signature: 'S',
        apply() {}, remove() {},
        update() {
            if (Math.abs(player.vx) < 0.15 && Math.abs(player.vy) < 0.15 && frameCount % 45 === 0) {
                damagePlayer(3, 'stationary_damage');
            }
        }
    },
    {
        id: 'life_link', name: '生命链接', desc: '玩家受伤时敌人也受伤',
        category: 'interact', signature: 'L',
        apply() {}, remove() {},
        onPlayerDamaged(dmg) { for (const e of enemies) e.hp -= dmg * 0.4; }
    },
    {
        id: 'overclock_mode', name: '系统超频', desc: '射速翻倍但持续掉血',
        category: 'interact', signature: 'OC',
        apply() { overclockActive = true; },
        remove() { overclockActive = false; },
        update() { if (overclockActive && frameCount % 40 === 0) damagePlayer(1.5, 'overclock_mode'); }
    },

    // --- PERCEPTION (3) ---
    {
        id: 'enemy_invisible', name: '隐形入侵', desc: '敌人隐形，靠近才显形',
        category: 'perception', signature: 'I',
        apply() { enemyInvisible = true; },
        remove() { enemyInvisible = false; }
    },
    {
        id: 'mirror_controls', name: '镜像反转', desc: '左右移动方向反转',
        category: 'perception', signature: 'MIRROR',
        apply() { mirrorControls = true; },
        remove() { mirrorControls = false; }
    },
    {
        id: 'shrink_vision', name: '视野缩小', desc: '可视范围大幅缩小',
        category: 'perception', signature: 'V',
        apply() { visionRadius = 160; },
        remove() { visionRadius = 9999; }
    },

    // --- TIME (2) ---
    {
        id: 'time_slow', name: '子弹时间', desc: '全局0.5倍速',
        category: 'time', signature: 'T',
        apply() { timeScale = 0.5; },
        remove() { timeScale = 1; }
    },
    {
        id: 'time_fast', name: '时间加速', desc: '全局1.5倍速',
        category: 'time', signature: 'FAST',
        apply() { timeScale = 1.5; },
        remove() { timeScale = 1; }
    },

    // --- ENTITY (3) ---
    {
        id: 'clone_move', name: '残影复制', desc: '移动留下战斗残影',
        category: 'entity', signature: 'C',
        apply() {}, remove() { player.clones = []; },
        update() {
            if (frameCount % 20 === 0 && (Math.abs(player.vx) > 0.4 || Math.abs(player.vy) > 0.4))
                player.clones.push({ x: player.x, y: player.y, life: 140, angle: player.angle });
        }
    },
    {
        id: 'ghost_mode', name: '幽灵模式', desc: '可穿墙但持续扣血',
        category: 'entity', signature: 'GHOST',
        apply() { ghostMode = true; },
        remove() { ghostMode = false; },
        update() { if (ghostMode && frameCount % 35 === 0) damagePlayer(1.2, 'ghost_mode'); }
    },
    {
        id: 'phoenix', name: '涅槃协议', desc: '死亡时满血复活一次',
        category: 'entity', signature: 'PHX',
        apply() { phoenixReady = true; },
        remove() { phoenixReady = false; }
    },

    // --- CHAOS (5) ---
    {
        id: 'bullet_hell', name: '弹幕地狱', desc: '敌人周期性发射子弹',
        category: 'chaos', signature: 'H',
        apply() {}, remove() {},
        update() {
            if (frameCount % 80 === 0 && enemies.length > 0) {
                for (const e of enemies.slice(0, 3)) {
                    const ba = Math.atan2(player.y - e.y, player.x - e.x);
                    for (let b = 0; b < 5; b++) {
                        bullets.push({
                            x: e.x, y: e.y,
                            vx: Math.cos(ba + b * 1.26 - 2.5) * 3.5,
                            vy: Math.sin(ba + b * 1.26 - 2.5) * 3.5,
                            radius: 4, damage: 8, bounces: 0,
                            color: '#ff5252', pierce: false, pierced: [],
                            isEnemyBullet: true
                        });
                    }
                }
            }
        }
    },
    {
        id: 'entropy', name: '熵增加速', desc: '全场速度逐渐加快',
        category: 'chaos', signature: 'E',
        apply() { entropyBoost = 0; },
        remove() { entropyBoost = 0; },
        update() { entropyBoost += 0.0002; if (entropyBoost > 1.2) entropyBoost = 1.2; }
    },
    {
        id: 'double_damage', name: '双倍伤害', desc: '所有人伤害翻倍',
        category: 'chaos', signature: 'D',
        apply() { globalDmgMult = 2; },
        remove() { globalDmgMult = 1; }
    },
    {
        id: 'enemy_frenzy', name: '狂化潮', desc: '敌人速度暴增50%',
        category: 'chaos', signature: 'FRENZY',
        apply() { enemyFrenzy = true; },
        remove() { enemyFrenzy = false; }
    },
    {
        id: 'chaos_storm', name: '混沌风暴', desc: '随机落雷伤害所有单位',
        category: 'chaos', signature: 'STORM',
        apply() {}, remove() {},
        update() {
            if (frameCount % 120 === 0) {
                const tx = 50 + Math.random() * 860;
                const ty = 50 + Math.random() * 440;
                spawnParticles(tx, ty, '#f1c40f', 25, 5, 40);
                screenShake = 8;
                for (const e of enemies) {
                    const d = Math.sqrt((e.x - tx) ** 2 + (e.y - ty) ** 2);
                    if (d < 80) e.hp -= 30;
                }
                const pd = Math.sqrt((player.x - tx) ** 2 + (player.y - ty) ** 2);
                if (pd < 80) damagePlayer(10, 'chaos_storm');
            }
        }
    }
];

// Rule state variables
let activeRule = null;
let activeRule2 = null;
let ruleTimer = 0;
let ruleDuration = 25 * 60;
let warningDuration = 3.5 * 60;
let cycleTimer = 0;
let cyclePhase = 'normal';
let gravity = { x: 0, y: 0 };
let friction = 0.84;
let screenRotation = 0;
let bulletBounce = false;
let enemyInvisible = false;
let timeScale = 1;
let magneticField = false;
let mirrorControls = false;
let gravityWell = false;
let entropyBoost = 0;
let globalDmgMult = 1;
let visionRadius = 9999;
let ghostMode = false;
let repulsionField = false;
let arenaShrink = 0;
let overclockActive = false;
let enemyFrenzy = false;
let phoenixReady = false;
let canStackRules = false;

function applyRule(rule) {
    if (rule.apply) rule.apply();
    SFX.ruleChange();
    spawnParticles(player.x, player.y, '#fff', 25, 6, 40);
    screenShake = 18;
}

function removeRule(rule) {
    if (rule && rule.remove) rule.remove();
}

function resetAllRules() {
    removeRule(activeRule);
    removeRule(activeRule2);
    activeRule = null;
    activeRule2 = null;
    gravity = { x: 0, y: 0 };
    friction = 0.84;
    screenRotation = 0;
    bulletBounce = false;
    enemyInvisible = false;
    timeScale = 1;
    magneticField = false;
    mirrorControls = false;
    gravityWell = false;
    entropyBoost = 0;
    globalDmgMult = 1;
    visionRadius = 9999;
    ghostMode = false;
    repulsionField = false;
    arenaShrink = 0;
    overclockActive = false;
    enemyFrenzy = false;
    phoenixReady = false;
    canStackRules = false;
}
