// ==================== RULE ANOMALY SYSTEM ====================
// 54 rules across 9 categories with synergy/conflict/opposite system

// Delta-time globals (used by both rules.js and engine.js)
let _dt = 1;
const _everyAccums = {};
function every(key, interval) {
    if (!_everyAccums[key] || _everyAccums[key] >= interval) _everyAccums[key] = 0;
    _everyAccums[key] += _dt;
    if (_everyAccums[key] >= interval) {
        _everyAccums[key] -= interval;
        return true;
    }
    return false;
}

const RULES = [
    // --- PHYSICS (7) ---
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
    {
        id: 'bullet_gravity', name: '弹道下坠', desc: '子弹受重力影响向下偏移',
        category: 'physics', signature: 'BG',
        apply() { bulletGravity = true; },
        remove() { bulletGravity = false; },
        update() {
            if (!bulletGravity) return;
            for (const b of bullets) { if (!b.isEnemyBullet) { b.vy += 0.08; } }
        }
    },
    {
        id: 'ricochet_boost', name: '动能回收', desc: '子弹每次反弹伤害+25%',
        category: 'physics', signature: 'RB',
        apply() { ricochetBoost = true; },
        remove() { ricochetBoost = false; }
    },

    // --- SPACE (8) ---
    {
        id: 'enemy_to_wall', name: '死亡固码', desc: '敌人死亡固化为阻挡源码块',
        category: 'space', signature: 'W',
        apply() {}, remove() {},
        onEnemyDeath(enemy) {
            const errors = ['404_NOT_FOUND', 'NullPointer', 'SEGFAULT', 'UNDEFINED', 'ACCESS_DENIED', 'STACK_OVERFLOW', 'INDEX_OOB', 'TYPE_ERR', 'TIMEOUT'];
            walls.push({
                x: enemy.x, y: enemy.y, width: 26, height: 26, life: 320,
                text: errors[Math.floor(Math.random() * errors.length)]
            });
        }
    },
    {
        id: 'screen_rotate', name: '视界偏转', desc: '画面周期性旋转90度',
        category: 'space', signature: 'O',
        apply() { screenRotation = Math.PI / 2; },
        remove() { screenRotation = 0; },
        update() { if (every('screen_rotate', 420)) screenRotation += Math.PI / 2; }
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
            if (every('wormhole', 200) && Math.random() < 0.35) {
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
            arenaShrink += 0.08 * _dt;
            const margin = 40 + arenaShrink;
            if (player.x < margin) player.x = margin;
            if (player.x > 960 - margin) player.x = 960 - margin;
            if (player.y < margin) player.y = margin;
            if (player.y > 540 - margin) player.y = 540 - margin;
        }
    },
    {
        id: 'portal_loop', name: '边界循环', desc: '穿过边界从对侧出现',
        category: 'space', signature: 'PL',
        apply() { portalLoop = true; },
        remove() { portalLoop = false; }
    },
    {
        id: 'zoom_vision', name: '视界缩放', desc: '视野周期性拉近拉远',
        category: 'space', signature: 'ZV',
        apply() { zoomVision = true; zoomPhase = 0; },
        remove() { zoomVision = false; canvas.style.transform = 'none'; },
        update() {
            if (!zoomVision) return;
            zoomPhase += 0.02 * _dt;
            const scale = 1 + Math.sin(zoomPhase) * 0.25;
            canvas.style.transform = `scale(${scale})`;
        }
    },
    {
        id: 'dimensional_rift', name: '维度裂缝', desc: '随机出现传送裂缝',
        category: 'space', signature: 'DR',
        apply() { dimRifts = []; dimRiftTimer = 0; },
        remove() { dimRifts = []; },
        update() {
            dimRiftTimer += _dt;
            if (dimRiftTimer > 300) {
                dimRiftTimer = 0;
                dimRifts.push({ x: 100 + Math.random() * 760, y: 80 + Math.random() * 380, life: 240, radius: 40 });
            }
            for (let i = dimRifts.length - 1; i >= 0; i--) {
                dimRifts[i].life -= _dt;
                const rdx = dimRifts[i].x - player.x, rdy = dimRifts[i].y - player.y;
                const rd = Math.sqrt(rdx * rdx + rdy * rdy);
                if (rd < dimRifts[i].radius + 100 && rd > 1) {
                    player.vx += (rdx / rd) * 0.15;
                    player.vy += (rdy / rd) * 0.15;
                }
                for (const e of enemies) {
                    const edx = dimRifts[i].x - e.x, edy = dimRifts[i].y - e.y;
                    const ed = Math.sqrt(edx * edx + edy * edy);
                    if (ed < dimRifts[i].radius + 80 && ed > 1) {
                        e.x += (edx / ed) * 0.8;
                        e.y += (edy / ed) * 0.8;
                    }
                }
                if (dimRifts[i].life <= 0) {
                    const targets = [{ obj: player, r: player.radius, isPlayer: true }];
                    for (const e of enemies) targets.push({ obj: e, r: e.radius, isPlayer: false });
                    for (const t of targets) {
                        const tdx = t.obj.x - dimRifts[i].x, tdy = t.obj.y - dimRifts[i].y;
                        if (Math.sqrt(tdx * tdx + tdy * tdy) < dimRifts[i].radius) {
                            t.obj.x = 100 + Math.random() * 760;
                            t.obj.y = 80 + Math.random() * 380;
                            spawnParticles(t.obj.x, t.obj.y, '#9b59b6', 15);
                            screenShake = 10;
                        }
                    }
                    dimRifts.splice(i, 1);
                }
            }
        }
    },

    // --- INTERACT (7) ---
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
            if (Math.abs(player.vx) < 0.15 && Math.abs(player.vy) < 0.15 && every('stationary_dmg', 45)) {
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
        update() { if (overclockActive && every('overclock_dmg', 40)) damagePlayer(1.5, 'overclock_mode'); }
    },
    {
        id: 'ammo_limited', name: '弹药限制', desc: '需要拾取弹药包，弹匣30发',
        category: 'interact', signature: 'AM',
        apply() { ammoLimited = true; currentAmmo = 30; maxAmmo = 30; },
        remove() { ammoLimited = false; currentAmmo = 9999; },
        onShoot() {
            if (!ammoLimited) return;
            currentAmmo--;
            if (currentAmmo <= 0) {
                playerFireCooldown = 120;
                currentAmmo = maxAmmo;
                SFX.upgrade();
            }
        }
    },
    {
        id: 'overheat', name: '过热系统', desc: '连续射击会过热停机',
        category: 'interact', signature: 'OH',
        apply() { overheatSystem = true; overheatValue = 0; },
        remove() { overheatSystem = false; },
        update() {
            if (!overheatSystem) return;
            if (playerFireCooldown > 0 && overheatValue < 100) overheatValue += 3 * _dt;
            else overheatValue = Math.max(0, overheatValue - 1.5 * _dt);
            if (overheatValue >= 100) {
                playerFireCooldown = Math.max(playerFireCooldown, 90);
                overheatValue = 0;
                spawnParticles(player.x, player.y, '#ff6600', 10, 3, 20);
            }
        }
    },
    {
        id: 'vampire', name: '吸血协议', desc: '击杀回血但自然回复失效',
        category: 'interact', signature: 'VMP',
        apply() { vampireMode = true; },
        remove() { vampireMode = false; },
        onEnemyDeath(enemy) {
            const healAmt = enemy.type === 'boss' ? 30 : (enemy.type === 'elite' ? 12 : 5);
            player.hp = Math.min(player.maxHp, player.hp + healAmt);
            spawnParticles(player.x, player.y, '#e74c3c', 6, 2, 15);
            addDamageNumber(player.x, player.y - 20, '+' + healAmt, 'heal');
        }
    },

    // --- PERCEPTION (6) ---
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
    {
        id: 'color_chaos', name: '色彩错乱', desc: '所有颜色周期性反转',
        category: 'perception', signature: 'CC',
        apply() { colorChaos = true; colorPhase = 0; },
        remove() { colorChaos = false; canvas.style.filter = 'none'; },
        update() {
            if (!colorChaos) return;
            colorPhase += 0.03 * _dt;
            const hue = Math.sin(colorPhase) * 180;
            canvas.style.filter = `hue-rotate(${hue}deg) invert(${Math.abs(Math.sin(colorPhase * 0.7)) * 0.3})`;
        }
    },
    {
        id: 'phantom_enemy', name: '幻影入侵', desc: '生成无害幻影敌人干扰视线',
        category: 'perception', signature: 'PE',
        apply() { phantomTimer = 0; },
        remove() {},
        update() {
            phantomTimer += _dt;
            if (phantomTimer > 90 && enemies.length < 40) {
                phantomTimer = 0;
                const side = Math.floor(Math.random() * 4);
                let x, y;
                switch (side) {
                    case 0: x = Math.random() * 960; y = -20; break;
                    case 1: x = 980; y = Math.random() * 540; break;
                    case 2: x = Math.random() * 960; y = 560; break;
                    case 3: x = -20; y = Math.random() * 540; break;
                }
                enemies.push({
                    x, y, radius: 14, speed: 2, hp: 1, maxHp: 1, damage: 0,
                    type: 'phantom', color: 'rgba(255,255,255,0.25)', phantom: true, id: nextEnemyId++
                });
            }
        }
    },
    {
        id: 'fog_of_war', name: '战争迷雾', desc: '未探索区域被黑暗覆盖',
        category: 'perception', signature: 'FoW',
        apply() { fogOfWar = true; fogMap = new Set(); },
        remove() { fogOfWar = false; },
        update() {
            if (!fogOfWar) return;
            const gx = Math.floor(player.x / 48), gy = Math.floor(player.y / 48);
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    if (dx*dx + dy*dy <= 10) fogMap.add(`${gx+dx},${gy+dy}`);
                }
            }
        }
    },

    // --- TIME (4) ---
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
    {
        id: 'time_stutter', name: '时间卡顿', desc: '游戏周期性冻结0.4秒',
        category: 'time', signature: 'TS',
        apply() { timeStutter = true; stutterTimer = 0; },
        remove() { timeStutter = false; },
        update() {
            if (!timeStutter) return;
            stutterTimer += _dt;
            if (stutterTimer > 200 && stutterTimer < 224) { timeScale = 0.05; }
            else if (stutterTimer >= 224) { timeScale = 1; stutterTimer = 0; }
        }
    },
    {
        id: 'time_rewind', name: '回溯残影', desc: '记录位置，玩家可瞬间回溯3秒前',
        category: 'time', signature: 'TR',
        apply() { timeRewind = true; positionHistory = []; },
        remove() { timeRewind = false; positionHistory = []; },
        update() {
            if (!timeRewind) return;
            positionHistory.push({ x: player.x, y: player.y, frame: frameCount });
            if (positionHistory.length > 180) positionHistory.shift();
        }
    },

    // --- ENTITY (6) ---
    {
        id: 'clone_move', name: '残影复制', desc: '移动留下战斗残影',
        category: 'entity', signature: 'C',
        apply() {}, remove() { player.clones = []; },
        update() {
            if (every('clone_move', 20) && (Math.abs(player.vx) > 0.4 || Math.abs(player.vy) > 0.4))
                player.clones.push({ x: player.x, y: player.y, life: 140, angle: player.angle });
        }
    },
    {
        id: 'ghost_mode', name: '幽灵模式', desc: '可穿墙但持续扣血',
        category: 'entity', signature: 'GHOST',
        apply() { ghostMode = true; },
        remove() { ghostMode = false; },
        update() { if (ghostMode && every('ghost_dmg', 35)) damagePlayer(1.2, 'ghost_mode'); }
    },
    {
        id: 'phoenix', name: '涅槃协议', desc: '死亡时满血复活一次',
        category: 'entity', signature: 'PHX',
        apply() { phoenixReady = true; },
        remove() { phoenixReady = false; }
    },
    {
        id: 'summon_turret', name: '自动炮台', desc: '玩家身后生成自动射击炮台',
        category: 'entity', signature: 'ST',
        apply() { turrets = []; turretTimer = 0; },
        remove() { turrets = []; },
        update() {
            if (!turrets) return;
            turretTimer += _dt;
            if (turretTimer > 180) {
                turretTimer = 0;
                if (turrets.length < 2) turrets.push({ x: player.x, y: player.y, life: 600, angle: 0 });
            }
            for (let i = turrets.length - 1; i >= 0; i--) {
                const t = turrets[i];
                t.life -= _dt;
                t.angle += 0.05 * _dt;
                if (every('turret_shot', 20) && enemies.length > 0) {
                    const nearest = enemies.reduce((a, b) => {
                        const da = (a.x - t.x) ** 2 + (a.y - t.y) ** 2;
                        const db = (b.x - t.x) ** 2 + (b.y - t.y) ** 2;
                        return da < db ? a : b;
                    });
                    const ta = Math.atan2(nearest.y - t.y, nearest.x - t.x);
                    bullets.push({
                        x: t.x + Math.cos(ta) * 10, y: t.y + Math.sin(ta) * 10,
                        vx: Math.cos(ta) * 7, vy: Math.sin(ta) * 7,
                        radius: 3, damage: 15 * playerDamageMult, color: '#00ff66',
                        pierce: false, pierced: [], isEnemyBullet: false
                    });
                }
                if (t.life <= 0) turrets.splice(i, 1);
            }
        }
    },
    {
        id: 'enemy_merge', name: '聚合进化', desc: '敌人靠近时合并成巨型敌人',
        category: 'entity', signature: 'EM',
        apply() { enemyMerge = true; },
        remove() { enemyMerge = false; },
        update() {
            if (!enemyMerge) return;
            for (let i = 0; i < enemies.length; i++) {
                for (let j = i + 1; j < enemies.length; j++) {
                    const e1 = enemies[i], e2 = enemies[j];
                    if (e1.type === 'boss' || e2.type === 'boss') continue;
                    if (e1.phantom || e2.phantom) continue;
                    const dx = e1.x - e2.x, dy = e1.y - e2.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < e1.radius + e2.radius + 5) {
                        e1.hp += e2.hp;
                        e1.maxHp += e2.maxHp;
                        e1.radius = Math.min(50, e1.radius + e2.radius * 0.4);
                        e1.speed *= 0.85;
                        e1.damage += e2.damage * 0.5;
                        e1.x = (e1.x + e2.x) / 2;
                        e1.y = (e1.y + e2.y) / 2;
                        enemies.splice(j, 1);
                        spawnParticles(e1.x, e1.y, e1.color, 12);
                        j--;
                    }
                }
            }
        }
    },
    {
        id: 'magnet_pickup', name: '拾取磁铁', desc: '道具自动飞向玩家',
        category: 'entity', signature: 'MAG',
        apply() { pickupMagnet = true; },
        remove() { pickupMagnet = false; }
    },

    // --- CHAOS (8) ---
    {
        id: 'bullet_hell', name: '弹幕地狱', desc: '敌人周期性发射子弹',
        category: 'chaos', signature: 'H',
        apply() {}, remove() {},
        update() {
            if (every('bullet_hell', 80) && enemies.length > 0) {
                for (const e of enemies.slice(0, 3)) {
                    const ba = Math.atan2(player.y - e.y, player.x - e.x);
                    for (let b = 0; b < 5; b++) {
                        bullets.push({
                            x: e.x, y: e.y,
                            vx: Math.cos(ba + b * 1.26 - 2.5) * 3.5,
                            vy: Math.sin(ba + b * 1.26 - 2.5) * 3.5,
                            radius: 4, damage: 8, bounces: 0,
                            color: '#ff5252', pierce: false, pierced: [], isEnemyBullet: true
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
        update() { entropyBoost += 0.0002 * _dt; if (entropyBoost > 1.2) entropyBoost = 1.2; }
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
            if (every('chaos_storm', 120)) {
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
    },
    {
        id: 'random_teleport_enemy', name: '量子跃迁', desc: '敌人随机瞬移',
        category: 'chaos', signature: 'QE',
        apply() { enemyTeleport = true; teleportTimer = 0; },
        remove() { enemyTeleport = false; },
        update() {
            if (!enemyTeleport) return;
            teleportTimer += _dt;
            if (teleportTimer > 120) {
                teleportTimer = 0;
                for (const e of enemies) {
                    if (e.type === 'boss' || e.phantom) continue;
                    if (Math.random() < 0.15) {
                        e.x = 50 + Math.random() * 860;
                        e.y = 50 + Math.random() * 440;
                        spawnParticles(e.x, e.y, e.color, 8);
                    }
                }
            }
        }
    },
    {
        id: 'reverse_bullet', name: '逆弹道', desc: '子弹从鼠标反方向射出',
        category: 'chaos', signature: 'REV',
        apply() { reverseBullet = true; },
        remove() { reverseBullet = false; }
    },
    {
        id: 'terrain_lava', name: '熔岩地形', desc: '地面随机出现熔岩池',
        category: 'chaos', signature: 'LV',
        apply() { lavaPools = []; lavaTimer = 0; },
        remove() { lavaPools = []; },
        update() {
            lavaTimer += _dt;
            if (lavaTimer > 360) {
                lavaTimer = 0;
                lavaPools.push({ x: 80 + Math.random() * 800, y: 60 + Math.random() * 420, radius: 40 + Math.random() * 50, life: 400 });
            }
            for (let i = lavaPools.length - 1; i >= 0; i--) {
                const l = lavaPools[i];
                l.life -= _dt;
                const pdx = player.x - l.x, pdy = player.y - l.y;
                if (Math.sqrt(pdx * pdx + pdy * pdy) < l.radius) damagePlayer(0.8, 'terrain_lava');
                for (const e of enemies) {
                    const edx = e.x - l.x, edy = e.y - l.y;
                    if (Math.sqrt(edx * edx + edy * edy) < l.radius) { e.hp -= 1.5; e.speed *= 0.95; }
                }
                if (l.life <= 0) lavaPools.splice(i, 1);
            }
        }
    },

    // --- META (8) - New category for Steam demo ---
    {
        id: 'score_decay', name: '数据衰变', desc: '分数持续流失，击杀补充',
        category: 'meta', signature: 'DECAY',
        apply() { scoreDecay = true; },
        remove() { scoreDecay = false; },
        update() {
            if (!scoreDecay) return;
            if (every('score_decay', 60) && score > 0) {
                score = Math.max(0, score - 5);
                addDamageNumber(480, 30, '-5', 'score');
            }
        },
        onEnemyDeath() { score += 8; }
    },
    {
        id: 'level_drain', name: '等级侵蚀', desc: '受伤有概率降级',
        category: 'meta', signature: 'LVDR',
        apply() {}, remove() {},
        onPlayerDamaged() {
            if (Math.random() < 0.15 && playerLevel > 1) {
                playerLevel--;
                playerDamageMult = Math.max(1, playerDamageMult - 0.1);
                showAchievement('等级侵蚀', `降级至 LV.${playerLevel}`);
                spawnParticles(player.x, player.y, '#9b59b6', 20, 4, 30);
            }
        }
    },
    {
        id: 'weapon_scramble', name: '武器乱序', desc: '武器属性随机重排',
        category: 'meta', signature: 'SCRM',
        apply() {
            for (const w of weapons) {
                w._origDmg = w.damage;
                w._origSpd = w.speed;
                w.damage = w.damage * (0.5 + Math.random());
                w.speed = w.speed * (0.7 + Math.random() * 0.6);
            }
        },
        remove() {
            for (const w of weapons) {
                if (w._origDmg !== undefined) { w.damage = w._origDmg; w.speed = w._origSpd; }
            }
        }
    },
    {
        id: 'xp_magnet', name: '经验风暴', desc: '击杀经验翻倍但升级所需也翻倍',
        category: 'meta', signature: 'XPM',
        apply() { xpMultBonus = 2; xpToNextMult = 2; },
        remove() { xpMultBonus = 1; xpToNextMult = 1; }
    },
    {
        id: 'curse_of_greed', name: '贪婪诅咒', desc: '拾取道具有30%概率反噬',
        category: 'meta', signature: 'GRD',
        apply() { greedCurse = true; },
        remove() { greedCurse = false; }
    },
    {
        id: 'fragile_shield', name: '脆弱屏障', desc: '护盾值上限变为1但吸收效率x3',
        category: 'meta', signature: 'FRG',
        apply() { fragileShield = true; shieldEfficiency = 3; },
        remove() { fragileShield = false; shieldEfficiency = 1; }
    },
    {
        id: 'combo_decay', name: '连击衰减', desc: '连击超时后爆炸伤害玩家',
        category: 'meta', signature: 'CMB',
        apply() { comboExpire = true; },
        remove() { comboExpire = false; }
    },
    {
        id: 'enemy_adapt', name: '适者生存', desc: '敌人被同种武器击杀后获得抗性',
        category: 'meta', signature: 'ADPT',
        apply() { enemyAdapt = true; enemyAdaptMap = {}; },
        remove() { enemyAdapt = false; enemyAdaptMap = {}; }
    }
];

// ==================== RULE RELATIONSHIPS ====================
const RULE_RELATIONSHIPS = {
    synergies: [
        { pair: ['bullet_bounce', 'ricochet_boost'], effect: 'bounce_dmg_up', desc: '反弹伤害+50%' },
        { pair: ['enemy_invisible', 'phantom_enemy'], effect: 'invisible_horde', desc: '幻影敌人获得真实伤害' },
        { pair: ['entropy', 'enemy_frenzy'], effect: 'frenzy_boost', desc: '狂化额外+30%速度' },
        { pair: ['gravity_well', 'dimensional_rift'], effect: 'gravity_rift', desc: '裂缝引力范围+50%' },
        { pair: ['vampire', 'ghost_mode'], effect: 'ghost_vampire', desc: '幽灵击杀回血x2' },
        { pair: ['clone_move', 'bullet_hell'], effect: 'clone_shoot', desc: '残影也会发射弹幕' },
        { pair: ['score_decay', 'xp_magnet'], effect: 'data_storm', desc: '分数和经验同时翻倍' },
        { pair: ['fog_of_war', 'wormhole'], effect: 'blind_jump', desc: '传送后短暂全图可见' },
    ],
    conflicts: [
        { pair: ['time_slow', 'time_fast'], effect: 'time_chaos', desc: '时间混乱：随机0.3x-2.5x速度' },
        { pair: ['gravity_reverse', 'gravity_well'], effect: 'gravity_cancel', desc: '重力互相抵消' },
        { pair: ['repulsion_field', 'magnetic_field'], effect: 'field_cancel', desc: '力场互相抵消' },
        { pair: ['ghost_mode', 'phoenix'], effect: 'ghost_phoenix', desc: '幽灵模式禁用复活' },
        { pair: ['vampire', 'overclock_mode'], effect: 'blood_overclock', desc: '每秒扣血加倍' },
        { pair: ['fragile_shield', 'ammo_limited'], effect: 'resource_crisis', desc: '弹药获取减半' },
    ],
    opposites: [
        { pair: ['time_slow', 'time_fast'], effect: 'time_cancel', desc: '时间规则冲突' },
        { pair: ['bullet_bounce', 'portal_loop'], effect: 'space_cancel', desc: '空间规则冲突' },
    ]
};

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
let friendlyFire = false;

// Extended rule state variables
let bulletGravity = false;
let ricochetBoost = false;
let frictionSwap = false;
let portalLoop = false;
let zoomVision = false;
let dimRifts = [];
let dimRiftTimer = 0;
let ammoLimited = false;
let currentAmmo = 9999;
let maxAmmo = 30;
let overheatSystem = false;
let overheatValue = 0;
let colorChaos = false;
let colorPhase = 0;
let phantomTimer = 0;
let timeStutter = false;
let stutterTimer = 0;
let timeRewind = false;
let positionHistory = [];
let turrets = [];
let turretTimer = 0;
let enemyMerge = false;
let enemyTeleport = false;
let teleportTimer = 0;
let reverseBullet = false;
let lavaPools = [];
let lavaTimer = 0;
let zoomPhase = 0;

// New rule variables (Steam demo)
let vampireMode = false;
let fogOfWar = false;
let fogMap = new Set();
let pickupMagnet = false;
let scoreDecay = false;
let xpMultBonus = 1;
let xpToNextMult = 1;
let greedCurse = false;
let fragileShield = false;
let shieldEfficiency = 1;
let comboExpire = false;
let enemyAdapt = false;
let enemyAdaptMap = {};

function applyRule(rule) {
    if (rule.apply) rule.apply();
    SFX.ruleChange();
    spawnParticles(player.x, player.y, '#fff', 25, 6, 40);
    screenShake = 18;
    checkRuleRelationships();
}

function removeRule(rule) {
    if (rule && rule.remove) rule.remove();
}

function checkRuleRelationships() {
    const activeIds = [activeRule?.id, activeRule2?.id].filter(Boolean);
    if (activeIds.length < 2) return;

    for (const syn of RULE_RELATIONSHIPS.synergies) {
        if (activeIds.includes(syn.pair[0]) && activeIds.includes(syn.pair[1])) {
            showAchievement(`RULE SYNERGY`, syn.desc);
            applySynergyEffect(syn.effect);
        }
    }

    for (const conf of RULE_RELATIONSHIPS.conflicts) {
        if (activeIds.includes(conf.pair[0]) && activeIds.includes(conf.pair[1])) {
            showAchievement(`RULE CONFLICT`, conf.desc);
            applyConflictEffect(conf.effect);
        }
    }
}

function applySynergyEffect(effect) {
    switch (effect) {
        case 'bounce_dmg_up': break;
        case 'invisible_horde':
            for (const e of enemies) { if (e.phantom) { e.damage = 8; e.color = 'rgba(255,0,0,0.4)'; } }
            break;
        case 'frenzy_boost':
            for (const e of enemies) { e.speed *= 1.3; }
            break;
        case 'gravity_rift': break;
        case 'ghost_vampire': break;
        case 'clone_shoot': break;
        case 'data_storm': break;
        case 'blind_jump': break;
    }
}

function applyConflictEffect(effect) {
    switch (effect) {
        case 'time_chaos': timeScale = 0.3 + Math.random() * 2.2; break;
        case 'gravity_cancel': gravity.y = 0; gravityWell = false; break;
        case 'field_cancel': magneticField = false; repulsionField = false; break;
        case 'ghost_phoenix': phoenixReady = false; break;
        case 'blood_overclock': break;
        case 'resource_crisis': break;
    }
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
    friendlyFire = false;

    bulletGravity = false;
    ricochetBoost = false;
    frictionSwap = false;
    portalLoop = false;
    zoomVision = false;
    dimRifts = [];
    dimRiftTimer = 0;
    ammoLimited = false;
    currentAmmo = 9999;
    overheatSystem = false;
    overheatValue = 0;
    colorChaos = false;
    colorPhase = 0;
    phantomTimer = 0;
    timeStutter = false;
    stutterTimer = 0;
    timeRewind = false;
    positionHistory = [];
    turrets = [];
    turretTimer = 0;
    enemyMerge = false;
    enemyTeleport = false;
    teleportTimer = 0;
    reverseBullet = false;
    lavaPools = [];
    lavaTimer = 0;
    zoomPhase = 0;

    vampireMode = false;
    fogOfWar = false;
    fogMap = new Set();
    pickupMagnet = false;
    scoreDecay = false;
    xpMultBonus = 1;
    xpToNextMult = 1;
    greedCurse = false;
    fragileShield = false;
    shieldEfficiency = 1;
    comboExpire = false;
    enemyAdapt = false;
    enemyAdaptMap = {};

    if (canvas) {
        canvas.style.filter = 'none';
        canvas.style.transform = 'none';
    }
}
