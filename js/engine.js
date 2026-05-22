// ==================== CORE GAME ENGINE ====================

const GameState = { MENU: 'menu', PLAYING: 'playing', WARNING: 'warning', RULE_ACTIVE: 'rule_active', UPGRADE: 'upgrade', GAME_OVER: 'game_over', DIFFICULTY_SELECT: 'difficulty_select', EVENT: 'event' };
let state = GameState.MENU;
let frameCount = 0;
let score = 0;
let wave = 1;
let survivalTime = 0;
let totalKills = 0;
let comboCount = 0;
let comboTimer = 0;
let maxCombo = 0;
let eliteKills = 0;
let screenShake = 0;
let screenShakeX = 0;
let screenShakeY = 0;
let playerInvincible = 0;
let playerFireCooldown = 0;
let lastDamageSource = '';
let autoFireEnabled = false;
let killStreakCount = 0;
let killStreakTimer = 0;

// ==================== GAME SETTINGS ====================
const gameSettings = {
    stressTest: false, spawnMult: 1, maxEnemies: 200,
    godMode: false, autoFire: false, showPerf: true, timeScaleOverride: 1.0
};
let stressTestSpawnAccumulator = 0;

// ==================== DIFFICULTY SYSTEM ====================
const DIFFICULTY = {
    EASY: { id: 'easy', name: '简单', spawnRateMod: 1.4, enemyHpMod: 0.6, enemyDmgMod: 0.5, enemySpdMod: 0.7, xpMult: 1.3, scoreMult: 0.7 },
    NORMAL: { id: 'normal', name: '普通', spawnRateMod: 1.0, enemyHpMod: 1.0, enemyDmgMod: 1.0, enemySpdMod: 1.0, xpMult: 1.0, scoreMult: 1.0 },
    HARD: { id: 'hard', name: '困难', spawnRateMod: 0.7, enemyHpMod: 1.6, enemyDmgMod: 1.5, enemySpdMod: 1.3, xpMult: 0.85, scoreMult: 1.5 },
    NIGHTMARE: { id: 'nightmare', name: '炼狱', spawnRateMod: 0.5, enemyHpMod: 2.5, enemyDmgMod: 2.2, enemySpdMod: 1.6, xpMult: 0.6, scoreMult: 2.5 }
};
let currentDifficulty = DIFFICULTY.NORMAL;

function setDifficulty(diffId) {
    currentDifficulty = Object.values(DIFFICULTY).find(d => d.id === diffId) || DIFFICULTY.NORMAL;
}

// ==================== STATUS EFFECT SYSTEM ====================
const STATUS_TYPES = {
    BURN: { id: 'burn', name: '灼烧', color: '#e74c3c', tickDmg: 2, tickRate: 45, duration: 300, stackMax: 5 },
    FREEZE: { id: 'freeze', name: '冻结', color: '#3498db', slowPct: 0.6, duration: 180, stackMax: 3 },
    POISON: { id: 'poison', name: '中毒', color: '#2ecc71', tickDmg: 1.5, tickRate: 30, duration: 360, stackMax: 5 },
    SHOCK: { id: 'shock', name: '感电', color: '#f1c40f', tickDmg: 3, tickRate: 20, duration: 120, stackMax: 3, chainRadius: 80 },
    BLEED: { id: 'bleed', name: '流血', color: '#c0392b', tickDmg: 2.5, tickRate: 25, duration: 200, stackMax: 5 }
};

let activeStatusEffects = [];
let nextEnemyId = 0;

function applyStatus(targetType, targetId, statusId, stacks = 1) {
    const def = Object.values(STATUS_TYPES).find(s => s.id === statusId);
    if (!def) return;
    const existing = activeStatusEffects.find(e => e.target === targetType && e.targetId === targetId && e.type === statusId);
    if (existing) {
        existing.stacks = Math.min(def.stackMax, existing.stacks + stacks);
        existing.duration = def.duration;
    } else {
        activeStatusEffects.push({ target: targetType, targetId, type: statusId, stacks, timer: 0, duration: def.duration });
    }
}

function updateStatusEffects() {
    for (let i = activeStatusEffects.length - 1; i >= 0; i--) {
        const eff = activeStatusEffects[i];
        const def = Object.values(STATUS_TYPES).find(s => s.id === eff.type);
        eff.duration--;
        eff.timer++;

        if (eff.target === 'player') {
            if (eff.timer >= def.tickRate) {
                eff.timer = 0;
                if (eff.type === 'burn') damagePlayer(def.tickDmg * eff.stacks, 'status_burn');
                if (eff.type === 'poison') damagePlayer(def.tickDmg * eff.stacks, 'status_poison');
                if (eff.type === 'shock') {
                    damagePlayer(def.tickDmg * eff.stacks, 'status_shock');
                    for (const e of enemies) {
                        const d = Math.sqrt((e.x - player.x)**2 + (e.y - player.y)**2);
                        if (d < def.chainRadius * eff.stacks) { e.hp -= def.tickDmg * eff.stacks; spawnLineParticles(player.x, player.y, e.x, e.y, def.color, 2); }
                    }
                }
                if (eff.type === 'bleed') damagePlayer(def.tickDmg * eff.stacks, 'status_bleed');
            }
            if (eff.type === 'freeze') playerSpeedMult *= (1 - def.slowPct * eff.stacks / def.stackMax);
        } else if (eff.target === 'enemy') {
            const enemy = enemies.find(e => e.id === eff.targetId);
            if (!enemy) { activeStatusEffects.splice(i, 1); continue; }
            if (eff.timer >= def.tickRate) {
                eff.timer = 0;
                enemy.hp -= def.tickDmg * eff.stacks;
                if (eff.type === 'shock') {
                    for (const other of enemies) {
                        if (other.id === enemy.id) continue;
                        const d = Math.sqrt((other.x - enemy.x)**2 + (other.y - enemy.y)**2);
                        if (d < def.chainRadius * eff.stacks) { other.hp -= def.tickDmg * eff.stacks; spawnLineParticles(enemy.x, enemy.y, other.x, other.y, def.color, 2); }
                    }
                }
            }
            if (eff.type === 'freeze') enemy.speed *= (1 - def.slowPct * eff.stacks / def.stackMax);
        }
        if (eff.duration <= 0) activeStatusEffects.splice(i, 1);
    }
}

// ==================== SKILL SYSTEM ====================
const SKILLS = [
    {
        id: 'dash', name: '相位冲刺', icon: 'DASH', cooldown: 180, duration: 15,
        desc: '瞬间冲刺并无敌',
        activate() {
            player.vx += Math.cos(player.angle) * 18;
            player.vy += Math.sin(player.angle) * 18;
            playerInvincible = 25;
            spawnParticles(player.x, player.y, '#00ffff', 20, 4, 30);
            screenShake = 8;
        }
    },
    {
        id: 'nova', name: '脉冲新星', icon: 'NOVA', cooldown: 360, duration: 0,
        desc: '环形冲击波击退并伤害敌人',
        activate() {
            for (const e of enemies) {
                const dx = e.x - player.x, dy = e.y - player.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 180 && d > 0) {
                    e.hp -= 45 * playerDamageMult;
                    e.x += (dx / d) * 60;
                    e.y += (dy / d) * 60;
                    applyStatus('enemy', e.id, 'shock', 1);
                }
            }
            spawnParticles(player.x, player.y, '#00ffff', 40, 6, 40);
            screenShake = 20;
            SFX.bossDie();
        }
    },
    {
        id: 'time_warp', name: '时间裂隙', icon: 'WARP', cooldown: 600, duration: 180,
        desc: '3秒内时间流速减半（仅影响敌人）',
        activate() { timeWarpActive = true; timeWarpTimer = 180; SFX.ruleChange(); },
        update() { if (timeWarpActive) { timeWarpTimer--; if (timeWarpTimer <= 0) timeWarpActive = false; } }
    },
    {
        id: 'turret_drop', name: '紧急部署', icon: 'TURRET', cooldown: 480, duration: 0,
        desc: '部署一个持续10秒的自动炮台',
        activate() {
            if (!turrets) turrets = [];
            turrets.push({ x: player.x, y: player.y, life: 600, angle: 0, emergency: true });
            spawnParticles(player.x, player.y, '#00ff66', 15, 4, 25);
        }
    }
];

let skillCooldowns = [0, 0, 0, 0];
let timeWarpActive = false;
let timeWarpTimer = 0;

function activateSkill(index) {
    if (index < 0 || index >= SKILLS.length) return;
    if (skillCooldowns[index] > 0) return;
    SKILLS[index].activate();
    skillCooldowns[index] = SKILLS[index].cooldown;
}

function updateSkills() {
    for (let i = 0; i < skillCooldowns.length; i++) { if (skillCooldowns[i] > 0) skillCooldowns[i]--; }
    for (const skill of SKILLS) { if (skill.update) skill.update(); }
}

// ==================== ELITE SYSTEM ====================
const ELITE_MODS = [
    { id: 'fast', name: '迅捷', icon: '⚡', apply(e) { e.speed *= 1.8; e.color = '#f39c12'; } },
    { id: 'tank', name: '坚固', icon: '🛡️', apply(e) { e.hp *= 2.5; e.maxHp = e.hp; e.radius *= 1.3; e.color = '#3498db'; } },
    { id: 'regen', name: '再生', icon: '💚', apply(e) { e.regenRate = 0.5; } },
    { id: 'explode', name: '爆裂', icon: '💥', apply(e) { e.explodeOnDeath = true; } },
    { id: 'shield', name: '护盾', icon: '🔰', apply(e) { e.shield = e.maxHp * 0.5; } },
    { id: 'vampiric', name: '吸血', icon: '🧛', apply(e) { e.vampiric = true; } },
    { id: 'splitting', name: '分裂', icon: '💫', apply(e) { e.splitOnDeath = 3; } },
    { id: 'frost', name: '寒冰', icon: '❄️', apply(e) { e.frostAura = true; } },
];

function spawnElite(baseEnemy) {
    const modCount = Math.min(1 + Math.floor(wave / 4), 3);
    const mods = [];
    const available = [...ELITE_MODS];
    for (let i = 0; i < modCount; i++) {
        const idx = Math.floor(Math.random() * available.length);
        mods.push(available.splice(idx, 1)[0]);
    }
    baseEnemy.elite = true;
    baseEnemy.eliteMods = mods;
    baseEnemy.eliteColor = mods[0].color || '#ffd700';
    baseEnemy.hp *= 2;
    baseEnemy.maxHp = baseEnemy.hp;
    baseEnemy.damage *= 1.5;
    baseEnemy.speed *= 1.2;
    for (const mod of mods) mod.apply(baseEnemy);
    return baseEnemy;
}

// ==================== BOSS SYSTEM ====================
const BOSS_TEMPLATES = [
    {
        id: 'overseer', name: '监视者·OVERSEER', color: '#ff1744', radius: 38, hpMult: 1.0, speedBase: 0.8,
        mechanisms: {
            init(boss) { boss.phase = 0; boss.phaseTimer = 0; boss.minions = []; },
            update(boss) {
                boss.phaseTimer++;
                if (boss.phaseTimer < 300) {
                    if (boss.phaseTimer % 40 === 0) {
                        const ba = Math.atan2(player.y - boss.y, player.x - boss.x);
                        for (let i = 0; i < 12; i++) {
                            const angle = ba + (i * Math.PI * 2) / 12;
                            bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5, radius: 5, damage: 12, color: '#ff5252', isEnemyBullet: true, pierce: false });
                        }
                    }
                } else if (boss.phaseTimer < 600) {
                    if (boss.phaseTimer % 90 === 0 && boss.minions.length < 4) {
                        const angle = Math.random() * Math.PI * 2;
                        boss.minions.push({ x: boss.x + Math.cos(angle) * 60, y: boss.y + Math.sin(angle) * 60, hp: 40, maxHp: 40, radius: 12, speed: 2.5, damage: 8, type: 'minion', color: '#ff8a80', id: nextEnemyId++ });
                    }
                } else {
                    boss.speed = boss.baseSpeed * 1.8;
                    if (boss.phaseTimer % 25 === 0) {
                        const ba = Math.atan2(player.y - boss.y, player.x - boss.x);
                        bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(ba) * 5, vy: Math.sin(ba) * 5, radius: 6, damage: 18, color: '#ff1744', isEnemyBullet: true, pierce: true });
                    }
                    if (boss.phaseTimer > 900) boss.phaseTimer = 0;
                }
                for (let i = boss.minions.length - 1; i >= 0; i--) {
                    const m = boss.minions[i];
                    const md = Math.sqrt((player.x - m.x)**2 + (player.y - m.y)**2);
                    if (md > 0) { m.x += ((player.x - m.x) / md) * m.speed * timeScale; m.y += ((player.y - m.y) / md) * m.speed * timeScale; }
                    if (md < player.radius + m.radius) { damagePlayer(m.damage, 'boss_overseer'); boss.minions.splice(i, 1); }
                }
            },
            onDeath(boss) { for (const m of boss.minions) spawnParticles(m.x, m.y, '#ff8a80', 10); }
        }
    },
    {
        id: 'juggernaut', name: '重装机兵·JUGGERNAUT', color: '#e91e63', radius: 45, hpMult: 1.8, speedBase: 0.5,
        mechanisms: {
            init(boss) { boss.chargeTimer = 0; boss.charging = false; boss.chargeDir = 0; boss.armor = 0.5; },
            update(boss) {
                boss.chargeTimer++;
                if (!boss.charging && boss.chargeTimer > 180) {
                    boss.charging = true; boss.chargeDir = Math.atan2(player.y - boss.y, player.x - boss.x); boss.chargeTimer = 0;
                    screenShake = 15; SFX.bossAppear();
                }
                if (boss.charging) {
                    boss.x += Math.cos(boss.chargeDir) * 7 * timeScale;
                    boss.y += Math.sin(boss.chargeDir) * 7 * timeScale;
                    if (frameCount % 5 === 0) { spawnParticles(boss.x, boss.y, '#ff5722', 3, 4, 40); lavaPools.push({ x: boss.x, y: boss.y, radius: 25, life: 120 }); }
                    if (boss.x < 50 || boss.x > 910) { boss.chargeDir = Math.PI - boss.chargeDir; boss.x = Math.max(50, Math.min(910, boss.x)); }
                    if (boss.y < 50 || boss.y > 490) { boss.chargeDir = -boss.chargeDir; boss.y = Math.max(50, Math.min(490, boss.y)); }
                    if (boss.chargeTimer > 90) { boss.charging = false; boss.chargeTimer = 0; }
                } else {
                    const d = Math.sqrt((player.x - boss.x)**2 + (player.y - boss.y)**2);
                    if (d > 0) { boss.x += ((player.x - boss.x) / d) * boss.speed * timeScale; boss.y += ((player.y - boss.y) / d) * boss.speed * timeScale; }
                }
            },
            onDeath(boss) { for (const e of enemies) { if (Math.sqrt((e.x - boss.x)**2 + (e.y - boss.y)**2) < 200) e.hp -= 80; } spawnParticles(boss.x, boss.y, '#e91e63', 60, 15, 60); }
        }
    },
    {
        id: 'specter', name: '虚空幽魂·SPECTER', color: '#9c27b0', radius: 32, hpMult: 0.8, speedBase: 1.2,
        mechanisms: {
            init(boss) { boss.teleportTimer = 0; boss.clones = []; },
            update(boss) {
                boss.teleportTimer++;
                if (boss.teleportTimer > 120) {
                    boss.teleportTimer = 0;
                    boss.clones.push({ x: boss.x, y: boss.y, life: 90, radius: boss.radius });
                    const angle = Math.random() * Math.PI * 2;
                    boss.x = Math.max(60, Math.min(900, player.x + Math.cos(angle) * (120 + Math.random() * 100)));
                    boss.y = Math.max(60, Math.min(480, player.y + Math.sin(angle) * (120 + Math.random() * 100)));
                    spawnParticles(boss.x, boss.y, '#9c27b0', 20); screenShake = 10;
                }
                for (let i = boss.clones.length - 1; i >= 0; i--) {
                    const c = boss.clones[i]; c.life--;
                    if (c.life <= 0) {
                        if (Math.sqrt((player.x - c.x)**2 + (player.y - c.y)**2) < 80) damagePlayer(20, 'boss_specter');
                        for (const e of enemies) { if (Math.sqrt((e.x - c.x)**2 + (e.y - c.y)**2) < 80) e.hp -= 30; }
                        spawnParticles(c.x, c.y, '#9c27b0', 25); boss.clones.splice(i, 1);
                    }
                }
                if (boss.teleportTimer % 30 === 0) {
                    const ba = Math.atan2(player.y - boss.y, player.x - boss.x);
                    bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(ba) * 2.5, vy: Math.sin(ba) * 2.5, radius: 5, damage: 14, color: '#ce93d8', isEnemyBullet: true, homing: true, homingStrength: 0.08 });
                }
            },
            onDeath(boss) { for (const c of boss.clones) spawnParticles(c.x, c.y, '#9c27b0', 15); }
        }
    },
    {
        id: 'titan', name: '泰坦核心·TITAN', color: '#ff9800', radius: 50, hpMult: 2.2, speedBase: 0.35,
        mechanisms: {
            init(boss) { boss.growth = 0; boss.satellites = []; for (let i = 0; i < 3; i++) boss.satellites.push({ angle: i * 2.09, radius: 70 }); },
            update(boss) {
                boss.growth += 0.0005; boss.radius = 50 + boss.growth * 20;
                for (const sat of boss.satellites) {
                    sat.angle += 0.03;
                    if (frameCount % 45 === 0) {
                        const ba = Math.atan2(player.y - (boss.y + Math.sin(sat.angle) * sat.radius), player.x - (boss.x + Math.cos(sat.angle) * sat.radius));
                        bullets.push({ x: boss.x + Math.cos(sat.angle) * sat.radius, y: boss.y + Math.sin(sat.angle) * sat.radius, vx: Math.cos(ba) * 4, vy: Math.sin(ba) * 4, radius: 4, damage: 10, color: '#ff9800', isEnemyBullet: true });
                    }
                    const sd = Math.sqrt((player.x - (boss.x + Math.cos(sat.angle) * sat.radius))**2 + (player.y - (boss.y + Math.sin(sat.angle) * sat.radius))**2);
                    if (sd < 12) damagePlayer(8, 'boss_titan');
                }
                if (frameCount % 200 === 0) {
                    screenShake = 25; spawnParticles(boss.x, boss.y, '#ff9800', 50, 10, 50);
                    const pd = Math.sqrt((player.x - boss.x)**2 + (player.y - boss.y)**2);
                    if (pd < 200) damagePlayer(25, 'boss_titan');
                }
            },
            onDeath(boss) { spawnParticles(boss.x, boss.y, '#ff9800', 80, 20, 70); }
        }
    },
    {
        id: 'entropy_lord', name: '熵增领主·ENTROPY', color: '#00bcd4', radius: 36, hpMult: 1.0, speedBase: 0.9,
        mechanisms: {
            init(boss) { boss.entropyField = 0; },
            update(boss) {
                boss.entropyField += 0.01;
                for (let i = bullets.length - 1; i >= 0; i--) {
                    const b = bullets[i];
                    if (b.isEnemyBullet) continue;
                    const bd = Math.sqrt((b.x - boss.x)**2 + (b.y - boss.y)**2);
                    if (bd < 150) { b.vx *= -0.8; b.vy *= -0.8; b.isEnemyBullet = true; b.color = '#00bcd4'; spawnParticles(b.x, b.y, '#00bcd4', 3); }
                }
                if (frameCount % 60 === 0) {
                    const angle = Math.random() * Math.PI * 2;
                    bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, radius: 8, damage: 16, color: '#00bcd4', isEnemyBullet: true, entropyOrb: true });
                }
                for (const b of bullets) { if (b.entropyOrb && Math.sqrt((player.x - b.x)**2 + (player.y - b.y)**2) < 60) playerSpeedMult *= 0.95; }
            },
            onDeath(boss) { for (let i = 0; i < 16; i++) { const a = (i * Math.PI * 2) / 16; bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, radius: 5, damage: 20, color: '#00bcd4', isEnemyBullet: true }); } }
        }
    },
    // === NEW BOSSES (Steam demo) ===
    {
        id: 'glitch_queen', name: '故障女王·GLITCH', color: '#ff00ff', radius: 34, hpMult: 1.2, speedBase: 1.0,
        mechanisms: {
            init(boss) { boss.glitchTimer = 0; boss.mirrorActive = false; },
            update(boss) {
                boss.glitchTimer++;
                if (boss.glitchTimer % 150 === 0) {
                    boss.mirrorActive = !boss.mirrorActive;
                    if (boss.mirrorActive) showAchievement('GLITCH', '镜像模式激活');
                }
                if (boss.mirrorActive) {
                    if (frameCount % 30 === 0) {
                        const ba = Math.atan2(player.y - boss.y, player.x - boss.x);
                        for (let i = -1; i <= 1; i++) {
                            bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(ba + i * 0.3) * 4, vy: Math.sin(ba + i * 0.3) * 4, radius: 5, damage: 12, color: '#ff00ff', isEnemyBullet: true });
                        }
                    }
                } else {
                    if (frameCount % 50 === 0) {
                        for (let i = 0; i < 8; i++) {
                            const a = Math.random() * Math.PI * 2;
                            bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, radius: 4, damage: 8, color: '#ff80ff', isEnemyBullet: true });
                        }
                    }
                }
                const d = Math.sqrt((player.x - boss.x)**2 + (player.y - boss.y)**2);
                if (d > 0) { boss.x += ((player.x - boss.x) / d) * boss.speed * timeScale; boss.y += ((player.y - boss.y) / d) * boss.speed * timeScale; }
            },
            onDeath(boss) { spawnParticles(boss.x, boss.y, '#ff00ff', 50, 10, 50); }
        }
    },
    {
        id: 'swarm_king', name: '虫群之王·SWARM', color: '#4caf50', radius: 42, hpMult: 1.5, speedBase: 0.4,
        mechanisms: {
            init(boss) { boss.swarm = []; boss.spawnTimer = 0; },
            update(boss) {
                boss.spawnTimer++;
                if (boss.spawnTimer % 60 === 0 && boss.swarm.length < 15) {
                    const a = Math.random() * Math.PI * 2;
                    const spawn = { x: boss.x + Math.cos(a) * 30, y: boss.y + Math.sin(a) * 30, hp: 15, maxHp: 15, radius: 8, speed: 3, damage: 5, type: 'swarm', color: '#81c784', id: nextEnemyId++, isSwarm: true };
                    boss.swarm.push(spawn);
                    enemies.push(spawn);
                }
                // Swarm members orbit boss
                for (let i = 0; i < boss.swarm.length; i++) {
                    const s = boss.swarm[i];
                    if (!enemies.includes(s)) { boss.swarm.splice(i, 1); i--; continue; }
                    const orbitAngle = (i / boss.swarm.length) * Math.PI * 2 + frameCount * 0.03;
                    const targetX = boss.x + Math.cos(orbitAngle) * 60;
                    const targetY = boss.y + Math.sin(orbitAngle) * 60;
                    s.x += (targetX - s.x) * 0.05;
                    s.y += (targetY - s.y) * 0.05;
                }
                const d = Math.sqrt((player.x - boss.x)**2 + (player.y - boss.y)**2);
                if (d > 0) { boss.x += ((player.x - boss.x) / d) * boss.speed * timeScale; boss.y += ((player.y - boss.y) / d) * boss.speed * timeScale; }
            },
            onDeath(boss) { for (const s of boss.swarm) { if (enemies.includes(s)) s.hp -= 50; } spawnParticles(boss.x, boss.y, '#4caf50', 60, 12, 60); }
        }
    }
];

let nextBossIndex = 0;

function spawnBoss() {
    bossActive = true;
    const template = BOSS_TEMPLATES[nextBossIndex % BOSS_TEMPLATES.length];
    nextBossIndex++;
    const boss = {
        x: 480, y: -45, radius: template.radius,
        speed: template.speedBase + wave * 0.05, baseSpeed: template.speedBase,
        hp: (200 + wave * 55) * template.hpMult * currentDifficulty.enemyHpMod,
        maxHp: (200 + wave * 55) * template.hpMult * currentDifficulty.enemyHpMod,
        damage: 28 * currentDifficulty.enemyDmgMod,
        type: 'boss', bossType: template.id, bossName: template.name,
        color: template.color, bossTimer: 0, mechanisms: template.mechanisms, id: nextEnemyId++
    };
    if (boss.mechanisms.init) boss.mechanisms.init(boss);
    enemies.push(boss);
    SFX.bossAppear();
    spawnParticles(boss.x, boss.y, template.color, 50, 10, 60);
    screenShake = 30;
    triggerEvent('boss_appear', { bossName: template.name });
}

// ==================== ENEMY TYPES ====================
const ENEMY_TYPES = {
    normal: { color: '#e74c3c', radius: 14, hpMult: 1, spdMult: 1, dmgMult: 1 },
    fast: { color: '#f39c12', radius: 10, hpMult: 0.55, spdMult: 1.8, dmgMult: 0.6 },
    tank: { color: '#c0392b', radius: 21, hpMult: 3.2, spdMult: 0.5, dmgMult: 2 },
    elite: { color: '#e91e63', radius: 16, hpMult: 2.2, spdMult: 1.25, dmgMult: 1.5 },
    splitter: { color: '#ff7043', radius: 16, hpMult: 1.5, spdMult: 0.8, dmgMult: 1, splitOnDeath: 2 },
    shielded: { color: '#42a5f5', radius: 15, hpMult: 1.8, spdMult: 0.9, dmgMult: 1.2, hasShield: true },
    parasite: { color: '#66bb6a', radius: 9, hpMult: 0.3, spdMult: 2.5, dmgMult: 0.4, lifesteal: true },
};

// ==================== EVENT SYSTEM ====================
const EVENTS = [
    { id: 'rescue_signal', name: '求救信号', desc: '检测到未知求救信号...可能是陷阱', weight: 8, condition: () => wave >= 2 },
    { id: 'supply_drop', name: '补给空投', desc: '一个补给箱从天而降', weight: 10, condition: () => wave >= 1 },
    { id: 'system_glitch', name: '系统故障', desc: 'UI界面开始闪烁不稳定', weight: 6, condition: () => wave >= 3 },
    { id: 'stranger', name: '神秘访客', desc: '一个中立实体出现在战场边缘', weight: 5, condition: () => wave >= 4 },
    { id: 'black_market', name: '黑市商人', desc: '可以用分数交换升级', weight: 4, condition: () => wave >= 5 && score >= 200 },
    { id: 'time_anomaly', name: '时间裂隙', desc: '周围的时间流速变得不稳定', weight: 5, condition: () => wave >= 3 },
    { id: 'memory_fragment', name: '记忆碎片', desc: '你看到了不属于这个轮回的画面', weight: 3, condition: () => wave >= 6 },
    { id: 'overclock_surge', name: '超频浪涌', desc: '所有武器射速临时翻倍', weight: 6, condition: () => wave >= 2 },
    { id: 'gravity_spike', name: '重力尖峰', desc: '局部重力异常增强', weight: 5, condition: () => wave >= 3 },
    { id: 'enemy_civil_war', name: '内乱', desc: '敌人开始互相攻击', weight: 4, condition: () => wave >= 4 && enemies.length > 5 },
    { id: 'phantom_past', name: '往昔残影', desc: '你看到了自己的尸体', weight: 3, condition: () => wave >= 5 && totalKills > 50 },
    { id: 'core_breach', name: '核心 breach', desc: '系统防火墙出现漏洞', weight: 4, condition: () => wave >= 6 },
    { id: 'data_overflow', name: '数据溢出', desc: '经验值获取翻倍，但敌人也翻倍', weight: 5, condition: () => wave >= 3 },
    { id: 'weapon_malfunction', name: '武器故障', desc: '当前武器随机切换并锁定10秒', weight: 5, condition: () => wave >= 2 },
    { id: 'shield_surge', name: '护盾浪涌', desc: '获得临时无限护盾', weight: 4, condition: () => wave >= 3 && playerShield < 20 },
    { id: 'enemy_evolution', name: '强制进化', desc: '所有存活的敌人升级', weight: 3, condition: () => wave >= 5 && enemies.length > 3 },
    { id: 'void_whisper', name: '虚空低语', desc: '你听到了...某种指引', weight: 2, condition: () => wave >= 7 },
    { id: 'clone_army', name: '克隆军团', desc: '生成3个玩家克隆协助战斗', weight: 3, condition: () => wave >= 6 },
    { id: 'rule_override', name: '规则覆盖', desc: '强制激活一个额外规则', weight: 3, condition: () => wave >= 5 },
    { id: 'final_stand', name: '最后防线', desc: '生成一圈墙壁保护玩家', weight: 4, condition: () => player.hp < player.maxHp * 0.3 },
    { id: 'score_jackpot', name: '分数头奖', desc: '立即获得500分', weight: 3, condition: () => score < 500 },
    { id: 'boss_rush', name: 'Boss Rush', desc: '立即生成一个Boss', weight: 2, condition: () => wave >= 8 && !bossActive },
    { id: 'weapon_cache', name: '武器库', desc: '所有武器伤害+50%', weight: 4, condition: () => wave >= 4 },
    { id: 'elite_hunter', name: '精英猎场', desc: '生成3个精英敌人', weight: 3, condition: () => wave >= 5 },
    { id: 'xp_rain', name: '经验雨', desc: '全屏掉落经验道具', weight: 4, condition: () => wave >= 3 },
    { id: 'boss_appear', name: 'Boss出现', desc: 'Boss战开始', weight: 0, condition: () => false }
];

let activeEvent = null;
let eventTimer = 0;
let eventCooldown = 0;
let eventTriggerCount = 0;

function triggerEvent(eventId, data = {}) {
    if (activeEvent && eventId !== 'boss_appear') return;
    let event;
    if (eventId) {
        event = EVENTS.find(e => e.id === eventId);
    } else {
        const available = EVENTS.filter(e => e.condition && e.condition() && e.weight > 0);
        if (available.length === 0) return;
        const totalWeight = available.reduce((s, e) => s + e.weight, 0);
        let r = Math.random() * totalWeight;
        for (const e of available) { r -= e.weight; if (r <= 0) { event = e; break; } }
    }
    if (!event) return;
    activeEvent = { ...event, data, timer: 360 };
    showEventPopup(event.name, event.desc);
    applyEventEffect(event.id, data);
    eventTriggerCount++;
}

function applyEventEffect(id, data) {
    switch (id) {
        case 'rescue_signal': for (let i = 0; i < 5; i++) spawnEnemy(); break;
        case 'supply_drop':
            pickups.push({ x: 400 + Math.random() * 200, y: 200 + Math.random() * 140, type: 'health', life: 600 });
            pickups.push({ x: 400 + Math.random() * 200, y: 200 + Math.random() * 140, type: 'shield', life: 600 });
            pickups.push({ x: 400 + Math.random() * 200, y: 200 + Math.random() * 140, type: 'ammo', life: 600 });
            break;
        case 'system_glitch': screenShake = 50; canvas.style.filter = 'hue-rotate(90deg) blur(2px)'; setTimeout(() => canvas.style.filter = 'none', 3000); break;
        case 'stranger': turrets.push({ x: 100, y: 100, life: 900, angle: 0, stranger: true }); break;
        case 'time_anomaly': timeScale = 0.5 + Math.random(); setTimeout(() => timeScale = 1, 5000); break;
        case 'memory_fragment': score += 100; showAchievement('记忆恢复', '获得100分'); break;
        case 'overclock_surge': playerFireRate = Math.max(2, Math.floor(playerFireRate * 0.5)); setTimeout(() => playerFireRate = Math.floor(playerFireRate * 2), 8000); break;
        case 'gravity_spike': gravity.y = 1.5; setTimeout(() => gravity.y = 0, 4000); break;
        case 'enemy_civil_war': for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) if (Math.random() < 0.3) { enemies[i].hp -= 10; enemies[j].hp -= 10; } break;
        case 'phantom_past': spawnParticles(player.x, player.y, '#fff', 30); break;
        case 'core_breach': { const tr = RULES[Math.floor(Math.random() * RULES.length)]; applyRule(tr); setTimeout(() => removeRule(tr), 10000); break; }
        case 'data_overflow': playerXP *= 2; for (let i = 0; i < 3; i++) spawnEnemy(); break;
        case 'weapon_malfunction': player.currentWeapon = Math.floor(Math.random() * 4); updateWeaponHUD(); break;
        case 'shield_surge': playerShield = 9999; setTimeout(() => playerShield = Math.min(200, playerShield), 5000); break;
        case 'enemy_evolution': for (const e of enemies) { if (e.type === 'boss') continue; e.hp *= 1.5; e.speed *= 1.3; e.damage *= 1.3; e.radius *= 1.2; } break;
        case 'void_whisper': showAchievement('虚空低语', '某种存在正在观察你...'); break;
        case 'clone_army': for (let i = 0; i < 3; i++) player.clones.push({ x: player.x, y: player.y, life: 300, angle: player.angle, attack: true }); break;
        case 'rule_override': { const er = RULES.filter(r => r.id !== activeRule?.id && r.id !== activeRule2?.id); if (er.length > 0) applyRule(er[Math.floor(Math.random() * er.length)]); break; }
        case 'final_stand': for (let i = 0; i < 8; i++) { const a = (i * Math.PI * 2) / 8; walls.push({ x: player.x + Math.cos(a) * 60, y: player.y + Math.sin(a) * 60, width: 20, height: 20, life: 300 }); } break;
        case 'score_jackpot': score += 500; updateHUD(); break;
        case 'boss_rush': spawnBoss(); break;
        case 'weapon_cache': for (const w of weapons) w.damage *= 1.5; break;
        case 'elite_hunter': for (let i = 0; i < 3; i++) { const e = createEnemy('normal'); spawnElite(e); enemies.push(e); } break;
        case 'xp_rain': for (let i = 0; i < 12; i++) pickups.push({ x: 60 + Math.random() * 840, y: 60 + Math.random() * 420, type: 'xp', life: 480 }); break;
        case 'boss_appear': showAchievement(`WARNING: ${data.bossName}`, 'Boss战开始！'); break;
    }
}

function updateEvents() {
    if (activeEvent) {
        activeEvent.timer--;
        if (activeEvent.timer <= 0) { hideEventPopup(); activeEvent = null; }
    }
    eventCooldown--;
    if (!activeEvent && eventCooldown <= 0 && Math.random() < 0.003) {
        triggerEvent();
        eventCooldown = 600;
    }
}

// ==================== BUILD SIGNATURE ====================
function generateBuildSignature() {
    const parts = [];
    parts.push(playerLevel.toString(36));
    parts.push(Math.floor(playerDamageMult * 10).toString(36));
    parts.push(Math.floor(playerSpeedMult * 10).toString(36));
    parts.push(Math.floor(playerFireRate).toString(36));
    parts.push(Math.floor(player.maxHp / 10).toString(36));
    parts.push(currentDifficulty.id.substring(0, 2));
    const weaponSpec = weapons.map(w => Math.floor(w.damage).toString(36)).join('');
    parts.push(weaponSpec);
    const upgradeHash = Object.entries(upgradePickCounts).map(([k, v]) => k.substring(0, 2) + v).join('');
    parts.push(upgradeHash.substring(0, 8));
    return 'ANM-' + parts.join('-').toUpperCase();
}

// Player
const player = {
    x: 480, y: 270, radius: 12, speed: 4, hp: 100, maxHp: 100,
    vx: 0, vy: 0, angle: 0, clones: [], currentWeapon: 0
};

// Weapons
const weapons = [
    { name: '脉冲手枪', icon: '', desc: '标准弹', damage: 20, speed: 9.5, radius: 3, cooldown: 13, color: '#f39c12', count: 1, spread: 0, pierce: false },
    { name: '散弹爆裂', icon: '', desc: '散射弹', damage: 11, speed: 7.5, radius: 3, cooldown: 34, color: '#e74c3c', count: 6, spread: 0.22, pierce: false },
    { name: '速射风暴', icon: '⚡', desc: '高速弹', damage: 10, speed: 12, radius: 2.5, cooldown: 5, color: '#3498db', count: 1, spread: 0.05, pierce: false },
    { name: '穿透狙击', icon: '', desc: '穿透弹', damage: 32, speed: 6.5, radius: 4.5, cooldown: 27, color: '#2ecc71', count: 1, spread: 0, pierce: true },
];

// Collections
let bullets = [];
let enemies = [];
let particles = [];
let walls = [];
let pickups = [];
let bossActive = false;

// Input
const keys = {};
const mouse = { x: 480, y: 270, down: false };
let isMobile = false;
let joystickActive = false;
let joystickDX = 0, joystickDY = 0;
let mobileShooting = false;

// Achievements
const achievements = {
    'first_blood': { name: '初尝血腥', desc: '首次击杀敌人', unlocked: false },
    'wave_5': { name: '规则适应者', desc: '存活至第5波', unlocked: false },
    'wave_10': { name: '异常免疫', desc: '存活至第10波', unlocked: false },
    'combo_20': { name: '连锁毁灭', desc: '达成20连击', unlocked: false },
    'boss_slayer': { name: 'Boss猎手', desc: '首次击杀Boss', unlocked: false },
    'upgrade_master': { name: '强化大师', desc: '升至10级', unlocked: false },
    'nightmare_survivor': { name: '炼狱行者', desc: '炼狱难度存活5波', unlocked: false },
    'event_master': { name: '事件专家', desc: '触发10个随机事件', unlocked: false },
    'elite_slayer': { name: '精英猎手', desc: '击杀10个精英敌人', unlocked: false },
    'combo_50': { name: '连击之王', desc: '达成50连击', unlocked: false },
    'wave_20': { name: '不朽传说', desc: '存活至第20波', unlocked: false },
};

function spawnParticles(x, y, color, count = 8, size = 3, life = 25) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: life + Math.random() * 15, color, size: size + Math.random() * 2 });
    }
}

function spawnLineParticles(x1, y1, x2, y2, color, count = 4) {
    for (let i = 0; i < count; i++) {
        const t = Math.random();
        particles.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, x2: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20, y2: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20, vx: 0, vy: 0, life: 15 + Math.random() * 10, color, size: 2, isLine: true });
    }
}

function damagePlayer(amount, source) {
    if (gameSettings.godMode) return;
    if (playerInvincible > 0) return;
    if (phoenixReady && player.hp - amount <= 0) {
        player.hp = player.maxHp; playerShield = 50; phoenixReady = false;
        spawnParticles(player.x, player.y, '#ff6600', 40, 6, 50); screenShake = 25;
        SFX.achievement(); showAchievement('涅槃重生', '凤凰协议触发，满血复活！');
        return;
    }
    amount *= globalDmgMult;
    if (playerShield > 0) {
        const absorbed = Math.min(playerShield, amount * shieldEfficiency);
        playerShield -= absorbed / shieldEfficiency;
        amount -= absorbed;
        spawnParticles(player.x, player.y, '#3498db', 6, 2, 15);
    }
    if (amount > 0) {
        player.hp -= amount; lastDamageSource = source; playerInvincible = 30;
        screenShake = Math.max(screenShake, amount * 1.8);
        spawnParticles(player.x, player.y, '#ff0055', 12, 4, 30);
        SFX.playerHit();
        addDamageNumber(player.x, player.y - 20, '-' + Math.ceil(amount), 'normal');
        if (activeRule && activeRule.onPlayerDamaged) activeRule.onPlayerDamaged(amount);
        if (activeRule2 && activeRule2.onPlayerDamaged) activeRule2.onPlayerDamaged(amount);
    }
    if (player.hp <= 0) { player.hp = 0; gameOver(); }
    updateHUD();
}

function gameOver() {
    state = GameState.GAME_OVER;
    stopBGM();
    const buildSig = generateBuildSignature();
    document.getElementById('deathReason').textContent = lastDamageSource ? `被「${lastDamageSource}」规则抹除` : '在数据洪流中彻底消散';
    document.getElementById('finalTime').textContent = Math.floor(survivalTime);
    document.getElementById('finalWave').textContent = wave;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLvl').textContent = playerLevel;
    document.getElementById('finalKills').textContent = totalKills;
    document.getElementById('finalCombo').textContent = maxCombo;
    document.getElementById('finalElites').textContent = eliteKills;
    document.getElementById('buildSignature').textContent = buildSig;

    // 先显示界面，再处理存盘（存盘失败不能阻断界面）
    const goScreen = document.getElementById('gameOverScreen');
    goScreen.style.display = '';        // ← 清除内联 display:none，让 CSS 类生效
    goScreen.classList.add('active');
    document.getElementById('gameContainer').classList.remove('rule-active');

    // 存盘和碎片计算放到最后，包 try-catch
    try {
        const shardsEarned = Math.floor(score / 100) + wave * 2 + eliteKills * 3;
        earnShards(shardsEarned);
        document.getElementById('shardsEarned').textContent = shardsEarned;
        saveBuild();  // 顺手把 Build 存档也做了
    } catch (e) {
        console.warn('[ANOMALY] Game over save failed:', e);
        document.getElementById('shardsEarned').textContent = '0';
    }
}

function updateHUD() {
    document.getElementById('hpValue').textContent = Math.ceil(player.hp);
    document.getElementById('hpBar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('hpBar').className = playerShield > 0 ? 'hp-fill shield' : 'hp-fill';
    document.getElementById('xpBar').style.width = `${(playerXP / playerXPToNext) * 100}%`;
    document.getElementById('lvlValue').textContent = playerLevel;
    document.getElementById('waveValue').textContent = wave;
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('difficultyDisplay').textContent = currentDifficulty.name;

    // Kill streak
    const streakEl = document.getElementById('killStreak');
    if (killStreakCount > 3) {
        streakEl.classList.add('active');
        document.getElementById('streakCount').textContent = killStreakCount;
    } else {
        streakEl.classList.remove('active');
    }

    // Skill cooldowns
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`skill${i}`);
        if (el) {
            const pct = skillCooldowns[i] > 0 ? (skillCooldowns[i] / SKILLS[i].cooldown) * 100 : 0;
            el.querySelector('.skill-cd-fill').style.width = `${pct}%`;
            el.querySelector('.skill-key').textContent = skillCooldowns[i] > 0 ? Math.ceil(skillCooldowns[i] / 60) : ['Z','X','C','V'][i];
            el.classList.toggle('skill-ready', skillCooldowns[i] <= 0);
        }
    }
}

function updateWeaponHUD() {
    document.querySelectorAll('.weapon-slot').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.w) === player.currentWeapon);
    });
}

function showAchievement(name, desc) {
    const toast = document.getElementById('achievementToast');
    if (!toast) return;
    toast.querySelector('.ach-name').textContent = name;
    toast.querySelector('.ach-desc').textContent = desc;
    toast.classList.add('show');
    SFX.achievement();
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showEventPopup(name, desc) {
    const popup = document.getElementById('eventPopup');
    if (!popup) return;
    popup.querySelector('.event-name').textContent = name;
    popup.querySelector('.event-desc').textContent = desc;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 4000);
}

function hideEventPopup() {
    const popup = document.getElementById('eventPopup');
    if (popup) popup.classList.remove('show');
}

function addNotifLog(icon, text) {
    const log = document.getElementById('notifLog');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'notif-entry';
    entry.innerHTML = `<span class="notif-icon">${icon}</span>${text}`;
    log.appendChild(entry);
    setTimeout(() => entry.classList.add('fading'), 3000);
    setTimeout(() => entry.remove(), 4000);
    if (log.children.length > 6) log.firstChild.remove();
}

function checkAchievements() {
    if (totalKills >= 1 && !achievements.first_blood.unlocked) { achievements.first_blood.unlocked = true; showAchievement(achievements.first_blood.name, achievements.first_blood.desc); }
    if (wave >= 5 && !achievements.wave_5.unlocked) { achievements.wave_5.unlocked = true; showAchievement(achievements.wave_5.name, achievements.wave_5.desc); }
    if (wave >= 10 && !achievements.wave_10.unlocked) { achievements.wave_10.unlocked = true; showAchievement(achievements.wave_10.name, achievements.wave_10.desc); }
    if (wave >= 20 && !achievements.wave_20.unlocked) { achievements.wave_20.unlocked = true; showAchievement(achievements.wave_20.name, achievements.wave_20.desc); }
    if (comboCount >= 20 && !achievements.combo_20.unlocked) { achievements.combo_20.unlocked = true; showAchievement(achievements.combo_20.name, achievements.combo_20.desc); }
    if (comboCount >= 50 && !achievements.combo_50.unlocked) { achievements.combo_50.unlocked = true; showAchievement(achievements.combo_50.name, achievements.combo_50.desc); }
    if (playerLevel >= 10 && !achievements.upgrade_master.unlocked) { achievements.upgrade_master.unlocked = true; showAchievement(achievements.upgrade_master.name, achievements.upgrade_master.desc); }
    if (currentDifficulty.id === 'nightmare' && wave >= 5 && !achievements.nightmare_survivor.unlocked) { achievements.nightmare_survivor.unlocked = true; showAchievement(achievements.nightmare_survivor.name, achievements.nightmare_survivor.desc); }
    if (eventTriggerCount >= 10 && !achievements.event_master.unlocked) { achievements.event_master.unlocked = true; showAchievement(achievements.event_master.name, achievements.event_master.desc); }
    if (eliteKills >= 10 && !achievements.elite_slayer.unlocked) { achievements.elite_slayer.unlocked = true; showAchievement(achievements.elite_slayer.name, achievements.elite_slayer.desc); }
}

// ==================== SPAWNING ====================

function createEnemy(type) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = Math.random() * 960; y = -20; break;
        case 1: x = 980; y = Math.random() * 540; break;
        case 2: x = Math.random() * 960; y = 560; break;
        case 3: x = -20; y = Math.random() * 540; break;
    }
    const diff = currentDifficulty;
    const frenzyMult = enemyFrenzy ? 1.5 : 1;
    const t = ENEMY_TYPES[type] || ENEMY_TYPES.normal;
    return {
        x, y, radius: t.radius,
        speed: (1.5 + wave * 0.16) * frenzyMult * diff.enemySpdMod * t.spdMult,
        hp: (20 + wave * 5) * diff.enemyHpMod * t.hpMult,
        maxHp: (20 + wave * 5) * diff.enemyHpMod * t.hpMult,
        damage: 10 * diff.enemyDmgMod * t.dmgMult,
        type, invisible: false, revealTimer: 0,
        color: t.color, id: nextEnemyId++, statusEffects: [],
        shield: t.hasShield ? (20 + wave * 5) * diff.enemyHpMod * 0.5 : 0,
        splitOnDeath: t.splitOnDeath || 0
    };
}

function spawnEnemy() {
    // Determine type based on wave
    const types = ['normal', 'normal', 'normal', 'fast', 'fast'];
    if (wave >= 3) types.push('splitter');
    if (wave >= 4) types.push('tank');
    if (wave >= 5) types.push('shielded');
    if (wave >= 6) types.push('parasite');
    if (wave >= 7) types.push('tank', 'elite', 'fast');
    if (wave >= 10) types.push('elite');
    const type = types[Math.floor(Math.random() * types.length)];
    const enemy = createEnemy(type);

    // Elite chance increases with wave
    const eliteChance = Math.min(0.02 + wave * 0.008, 0.2);
    if (wave >= 4 && type !== 'boss' && Math.random() < eliteChance) {
        spawnElite(enemy);
    }

    enemies.push(enemy);
}

// ==================== SHOOTING ====================

function shoot() {
    if (playerFireCooldown > 0) return;
    const w = weapons[player.currentWeapon];
    let cd = Math.max(3, Math.floor(w.cooldown * (playerFireRate / 14)));
    if (overclockActive) cd = Math.max(1, Math.floor(cd * 0.4));
    playerFireCooldown = cd;

    if (ammoLimited && currentAmmo <= 0) { playerFireCooldown = 60; return; }

    let baseAngle = player.angle;
    if (reverseBullet) baseAngle += Math.PI;

    for (let i = 0; i < w.count; i++) {
        const spreadAngle = w.count > 1 ? (i - (w.count - 1) / 2) * w.spread : (Math.random() - 0.5) * w.spread;
        const angle = baseAngle + spreadAngle;
        const dmg = w.damage * playerDamageMult * globalDmgMult;
        const isCrit = playerCritChance && Math.random() < playerCritChance;
        const bullet = {
            x: player.x + Math.cos(angle) * 16, y: player.y + Math.sin(angle) * 16,
            vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed,
            radius: w.radius, damage: isCrit ? dmg * critMultiplier : dmg,
            bounces: 0, color: w.color, pierce: w.pierce, pierced: [],
            isEnemyBullet: false, isCrit
        };
        // Homing
        if (bulletHoming) { bullet.homing = true; bullet.homingStrength = bulletHomingStr; }
        bullets.push(bullet);
    }

    if (ammoLimited) currentAmmo--;

    if (player.currentWeapon === 0) SFX.shoot();
    else if (player.currentWeapon === 1) SFX.shootSpread();
    else if (player.currentWeapon === 2) SFX.shootRapid();
    else SFX.shootPierce();

    if (activeRule && activeRule.onShoot) activeRule.onShoot();
    if (activeRule2 && activeRule2.onShoot) activeRule2.onShoot();
}

// ==================== MAIN UPDATE ====================

function update() {
    if (state === GameState.MENU || state === GameState.GAME_OVER || state === GameState.DIFFICULTY_SELECT) return;

    if (gameSettings.timeScaleOverride !== 1.0) timeScale = gameSettings.timeScaleOverride;

    if (state === GameState.UPGRADE) {
        upgradeTimeout--;
        if (upgradeTimeout <= 0 && showingUpgrade) selectUpgrade(Math.floor(Math.random() * upgradeOptions.length));
        if (playerFireCooldown > 0) playerFireCooldown--;
        if (playerInvincible > 0) playerInvincible--;
        return;
    }

    frameCount++;
    survivalTime += 1 / 60 * timeScale;

    if (playerFireCooldown > 0) playerFireCooldown--;
    if (playerInvincible > 0) playerInvincible--;

    if (screenShake > 0) { screenShake *= 0.88; if (screenShake < 0.3) screenShake = 0; }
    screenShakeX = (Math.random() - 0.5) * screenShake * 2;
    screenShakeY = (Math.random() - 0.5) * screenShake * 2;

    // Combo
    if (comboTimer > 0) comboTimer--;
    else {
        if (comboExpire && comboCount > 10) { damagePlayer(comboCount * 0.3, 'combo_expire'); spawnParticles(player.x, player.y, '#f39c12', 15, 3, 20); }
        comboCount = 0;
        document.getElementById('comboBlock').style.opacity = '0';
    }

    // Kill streak
    if (killStreakTimer > 0) killStreakTimer--;
    else killStreakCount = 0;

    // Regen
    if (playerRegen > 0 && frameCount % 30 === 0 && player.hp < player.maxHp && !vampireMode) {
        player.hp = Math.min(player.maxHp, player.hp + playerRegen);
    }

    // Shield regen
    if (shieldRegenRate > 0 && frameCount % 60 === 0) {
        playerShield += shieldRegenRate;
    }

    // Pickup magnet
    if (pickupMagnet) {
        for (const pk of pickups) {
            const d = Math.sqrt((player.x - pk.x)**2 + (player.y - pk.y)**2);
            if (d < 150 && d > 1) { pk.x += ((player.x - pk.x) / d) * 3; pk.y += ((player.y - pk.y) / d) * 3; }
        }
    }

    updateSkills();
    updateStatusEffects();
    updateEvents();

    // ==================== RULE CYCLE ====================
    cycleTimer++;
    if (cyclePhase === 'normal' && cycleTimer >= 10 * 60) {
        cyclePhase = 'warning'; cycleTimer = 0; state = GameState.WARNING;
        document.getElementById('ruleWarning').textContent = '⚠ RULE ANOMALY ⚠';
        document.getElementById('ruleName').textContent = '规则突变即将发生...';
        document.getElementById('ruleDescSmall').textContent = '';
        document.getElementById('ruleDisplay').classList.add('active');
        document.getElementById('glitchOverlay').classList.add('active');
        SFX.ruleChange();
    } else if (cyclePhase === 'warning' && cycleTimer >= warningDuration) {
        cyclePhase = 'active'; cycleTimer = 0; state = GameState.RULE_ACTIVE;
        const candidates = RULES.filter(r => r.id !== (activeRule?.id));
        const rule1 = candidates[Math.floor(Math.random() * candidates.length)];
        applyRule(rule1); activeRule = rule1; activeRule2 = null;
        canStackRules = wave >= 6;
        if (canStackRules && Math.random() < 0.4) {
            const remaining = candidates.filter(r => r.id !== rule1.id);
            const rule2 = remaining[Math.floor(Math.random() * remaining.length)];
            applyRule(rule2); activeRule2 = rule2;
        }
        document.getElementById('ruleWarning').textContent = 'RULE ACTIVE';
        document.getElementById('ruleName').textContent = activeRule2 ? `${rule1.name} + ${activeRule2.name}` : rule1.name;
        document.getElementById('ruleDescSmall').textContent = activeRule2 ? `${rule1.desc} | ${activeRule2.desc}` : rule1.desc;
        document.getElementById('ruleTimer').style.display = 'block';
        document.getElementById('ruleTimer').classList.add('active');
        const sig = document.getElementById('ruleSignature');
        sig.textContent = activeRule2 ? '!!' : rule1.signature;
        sig.className = `rule-signature active sig-${rule1.category}`;
        document.getElementById('gameContainer').classList.add('rule-active');
        document.getElementById('glitchOverlay').classList.remove('active');
        document.getElementById('ruleDisplay').classList.remove('active');
        screenShake = 15;
        addNotifLog('⚠', `规则: ${rule1.name}`);
    } else if (cyclePhase === 'active' && cycleTimer >= ruleDuration) {
        cyclePhase = 'normal'; cycleTimer = 0; state = GameState.PLAYING;
        removeRule(activeRule); removeRule(activeRule2);
        activeRule = null; activeRule2 = null;
        document.getElementById('ruleDisplay').classList.remove('active');
        document.getElementById('ruleTimer').style.display = 'none';
        document.getElementById('ruleTimer').classList.remove('active');
        document.getElementById('ruleSignature').className = 'rule-signature';
        document.getElementById('gameContainer').classList.remove('rule-active');
        wave++; score += 100 * currentDifficulty.scoreMult;

        // Wave banner
        const banner = document.getElementById('waveBanner');
        document.getElementById('waveBannerNum').textContent = wave;
        banner.classList.add('active');
        setTimeout(() => banner.classList.remove('active'), 2000);

        updateHUD();
        if (wave % 5 === 0 && !bossActive) spawnBoss();
    }
    if (cyclePhase === 'active') {
        document.getElementById('ruleTimerBar').style.width = `${(1 - cycleTimer / ruleDuration) * 100}%`;
    }

    // ==================== PLAYER MOVEMENT ====================
    let ax = 0, ay = 0;
    if (keys['w'] || keys['arrowup']) ay -= 1;
    if (keys['s'] || keys['arrowdown']) ay += 1;
    if (keys['a'] || keys['arrowleft']) ax -= 1;
    if (keys['d'] || keys['arrowright']) ax += 1;
    if (isMobile && joystickActive) { ax = joystickDX; ay = joystickDY; }
    if (mirrorControls) ax *= -1;

    if (screenRotation) {
        const cos = Math.cos(-screenRotation), sin = Math.sin(-screenRotation);
        const nax = ax * cos - ay * sin, nay = ax * sin + ay * cos;
        ax = nax; ay = nay;
    }

    const len = Math.sqrt(ax * ax + ay * ay);
    if (len > 0) { ax /= len; ay /= len; }

    const accel = overclockActive ? 0.85 : 0.72;
    player.vx += ax * accel * playerSpeedMult;
    player.vy += ay * accel * playerSpeedMult;
    player.vy += gravity.y;
    player.vx *= friction;
    player.vy *= friction;

    if (entropyBoost > 0) { player.vx *= (1 + entropyBoost * 0.015); player.vy *= (1 + entropyBoost * 0.015); }

    player.x += player.vx * timeScale;
    player.y += player.vy * timeScale;

    if (!ghostMode) {
        player.x = Math.max(player.radius, Math.min(960 - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(540 - player.radius, player.y));
        for (const w of walls) {
            if (rectCircleCollision(w, player)) {
                player.x -= player.vx * timeScale; player.y -= player.vy * timeScale;
                player.vx *= -0.3; player.vy *= -0.3;
            }
        }
    } else {
        if (player.x < -30) player.x = 990; if (player.x > 990) player.x = -30;
        if (player.y < -30) player.y = 570; if (player.y > 570) player.y = -30;
    }

    if (portalLoop) {
        if (player.x < 0) player.x = 960; if (player.x > 960) player.x = 0;
        if (player.y < 0) player.y = 540; if (player.y > 540) player.y = 0;
    }

    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // Clones
    for (let i = player.clones.length - 1; i >= 0; i--) { player.clones[i].life--; if (player.clones[i].life <= 0) player.clones.splice(i, 1); }

    // Mobile shooting
    if (isMobile && mobileShooting && playerFireCooldown <= 0 && (state === GameState.PLAYING || state === GameState.RULE_ACTIVE)) shoot();

    // ==================== ENEMY SPAWNING ====================
    if (!bossActive) {
        if (gameSettings.stressTest) {
            stressTestSpawnAccumulator += gameSettings.spawnMult;
            while (stressTestSpawnAccumulator >= 1) { spawnEnemy(); stressTestSpawnAccumulator -= 1; }
        } else {
            const spawnRate = Math.max(22, Math.floor((100 - wave * 5) * currentDifficulty.spawnRateMod));
            if (frameCount % spawnRate === 0) spawnEnemy();
        }
        const maxE = gameSettings.stressTest ? gameSettings.maxEnemies : 500;
        if (enemies.length > maxE) {
            const removable = enemies.filter(e => e.type !== 'boss').sort((a, b) => ((b.x - player.x)**2 + (b.y - player.y)**2) - ((a.x - player.x)**2 + (a.y - player.y)**2));
            for (let k = 0; k < Math.min(enemies.length - maxE, removable.length); k++) { const idx = enemies.indexOf(removable[k]); if (idx !== -1) enemies.splice(idx, 1); }
        }
    }

    // ==================== UPDATE ENEMIES ====================
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        if (e.type === 'boss' && e.mechanisms && e.mechanisms.update) e.mechanisms.update(e);

        // Elite regen
        if (e.elite && e.regenRate && frameCount % 30 === 0) e.hp = Math.min(e.maxHp, e.hp + e.regenRate);

        const edx = player.x - e.x, edy = player.y - e.y;
        const edist = Math.sqrt(edx * edx + edy * edy);

        if (edist > 0 && e.type !== 'boss') {
            let spd = e.speed * (entropyBoost > 0 ? (1 + entropyBoost * 0.8) : 1);
            if (timeWarpActive) spd *= 0.5;
            if (repulsionField && edist < 100) spd *= 0.5;
            // Frost aura
            if (e.frostAura && edist < 100) playerSpeedMult *= 0.98;
            e.x += (edx / edist) * spd * timeScale;
            e.y += (edy / edist) * spd * timeScale;
        }

        if (enemyInvisible) {
            e.invisible = true;
            if (edist < 85) { e.invisible = false; e.revealTimer = 25; }
            if (e.revealTimer > 0) { e.revealTimer--; e.invisible = false; }
        } else { e.invisible = false; }

        if (edist < player.radius + e.radius && playerInvincible <= 0 && !ghostMode) {
            damagePlayer(e.damage, activeRule ? activeRule.id : 'enemy');
            if (e.vampiric) e.hp = Math.min(e.maxHp, e.hp + e.damage * 0.3);
            if (e.type !== 'boss') { enemies.splice(i, 1); continue; }
        }

        if (!ghostMode) {
            for (const w of walls) {
                if (e.x > w.x - w.width / 2 && e.x < w.x + w.width / 2 && e.y > w.y - w.height / 2 && e.y < w.y + w.height / 2) {
                    e.x -= (edx / edist) * e.speed * timeScale; e.y -= (edy / edist) * e.speed * timeScale;
                }
            }
        }

        if (portalLoop && e.type !== 'boss') {
            if (e.x < -20) e.x = 980; if (e.x > 980) e.x = -20;
            if (e.y < -20) e.y = 560; if (e.y > 560) e.y = -20;
        }

        if (e.x < -60 || e.x > 1020 || e.y < -60 || e.y > 600) {
            if (e.type === 'boss') { if (e.mechanisms && e.mechanisms.onDeath) e.mechanisms.onDeath(e); enemies.splice(i, 1); bossActive = false; }
        }
    }

    // ==================== UPDATE BULLETS ====================
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;

        // Homing for player bullets
        if (b.homing && !b.isEnemyBullet) {
            let nearest = null, nearDist = 300;
            for (const e of enemies) {
                const d = Math.sqrt((e.x - b.x)**2 + (e.y - b.y)**2);
                if (d < nearDist) { nearest = e; nearDist = d; }
            }
            if (nearest) {
                const hdx = nearest.x - b.x, hdy = nearest.y - b.y;
                const hd = Math.sqrt(hdx * hdx + hdy * hdy);
                if (hd > 0) { b.vx += (hdx / hd) * (b.homingStrength || 0.05); b.vy += (hdy / hd) * (b.homingStrength || 0.05); }
            }
        }

        // Homing for enemy bullets
        if (b.homing && b.isEnemyBullet) {
            const hdx = player.x - b.x, hdy = player.y - b.y;
            const hd = Math.sqrt(hdx * hdx + hdy * hdy);
            if (hd > 0) { b.vx += (hdx / hd) * (b.homingStrength || 0.05); b.vy += (hdy / hd) * (b.homingStrength || 0.05); }
        }

        if (bulletBounce && !b.isEnemyBullet) {
            if (b.x < 0 || b.x > 960) { b.vx *= -1; b.bounces++; b.x = Math.max(0, Math.min(960, b.x)); }
            if (b.y < 0 || b.y > 540) { b.vy *= -1; b.bounces++; b.y = Math.max(0, Math.min(540, b.y)); }
            if (b.bounces > 5) { bullets.splice(i, 1); continue; }
        } else {
            if (b.x < -30 || b.x > 990 || b.y < -30 || b.y > 570) { bullets.splice(i, 1); continue; }
        }

        if (ricochetBoost && b.bounces > 0) b.damage *= 1.25;

        // Enemy bullet → player
        if (b.isEnemyBullet && playerInvincible <= 0 && !ghostMode) {
            if (Math.sqrt((b.x - player.x)**2 + (b.y - player.y)**2) < player.radius + b.radius) {
                damagePlayer(b.damage, 'enemy_bullet');
                if (Math.random() < 0.15) applyStatus('player', 0, 'burn', 1);
                bullets.splice(i, 1); continue;
            }
        }

        // Player bullet → enemies
        if (!b.isEnemyBullet) {
            if (friendlyFire && b.bounces > 0 && Math.sqrt((b.x - player.x)**2 + (b.y - player.y)**2) < player.radius + b.radius) {
                damagePlayer(b.damage * 0.5, 'friendly_fire'); bullets.splice(i, 1); continue;
            }

            let hitWall = false;
            for (const w of walls) {
                if (b.x > w.x - w.width / 2 && b.x < w.x + w.width / 2 && b.y > w.y - w.height / 2 && b.y < w.y + w.height / 2) {
                    if (!b.pierce) { bullets.splice(i, 1); hitWall = true; break; }
                }
            }
            if (hitWall) continue;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (b.pierce && b.pierced && b.pierced.includes(e.id)) continue;
                const bd = Math.sqrt((b.x - e.x)**2 + (b.y - e.y)**2);
                if (bd < b.radius + e.radius) {
                    let dmg = b.damage;
                    if (b.isCrit) dmg *= critMultiplier;

                    // Shield absorption
                    if (e.shield > 0) {
                        const absorbed = Math.min(e.shield, dmg);
                        e.shield -= absorbed;
                        dmg -= absorbed;
                        spawnParticles(b.x, b.y, '#3498db', 3, 2, 10);
                        if (dmg <= 0) { if (!b.pierce) { bullets.splice(i, 1); } break; }
                    }

                    e.hp -= dmg;
                    if (Math.random() < 0.1) applyStatus('enemy', e.id, 'burn', 1);
                    if (Math.random() < 0.08) applyStatus('enemy', e.id, 'freeze', 1);

                    SFX.hit();
                    spawnParticles(b.x, b.y, '#fff', 3, 2, 10);

                    // Damage number
                    addDamageNumber(e.x, e.y - e.radius - 8, Math.ceil(dmg).toString(), b.isCrit ? 'crit' : 'normal');

                    if (chainLightning) {
                        let nearest = null, nearDist = 120;
                        for (let k = 0; k < enemies.length; k++) {
                            if (k === j) continue;
                            const ld = Math.sqrt((enemies[k].x - e.x)**2 + (enemies[k].y - e.y)**2);
                            if (ld < nearDist) { nearest = enemies[k]; nearDist = ld; }
                        }
                        if (nearest) { nearest.hp -= dmg * 0.4; spawnLineParticles(e.x, e.y, nearest.x, nearest.y, '#9b59b6', 3); }
                    }

                    if (explosiveRounds) {
                        for (const ne of enemies) { if (Math.sqrt((ne.x - e.x)**2 + (ne.y - e.y)**2) < 60 && ne !== e) ne.hp -= dmg * 0.3; }
                        spawnParticles(e.x, e.y, '#f39c12', 8, 3, 15); screenShake = Math.max(screenShake, 3);
                    }

                    // Bullet split
                    if (bulletSplit && !b._split) {
                        for (let s = -1; s <= 1; s += 2) {
                            const sa = Math.atan2(b.vy, b.vx) + s * 0.4;
                            bullets.push({ x: e.x, y: e.y, vx: Math.cos(sa) * 6, vy: Math.sin(sa) * 6, radius: 2, damage: b.damage * 0.4, color: b.color, pierce: false, pierced: [], isEnemyBullet: false, _split: true });
                        }
                    }

                    // Bullet chain bounce
                    if (bulletChainBounce && !b._chained) {
                        let chainTarget = null, chainDist = 150;
                        for (const oe of enemies) {
                            if (oe.id === e.id) continue;
                            const cd = Math.sqrt((oe.x - e.x)**2 + (oe.y - e.y)**2);
                            if (cd < chainDist) { chainTarget = oe; chainDist = cd; }
                        }
                        if (chainTarget) {
                            const ca = Math.atan2(chainTarget.y - e.y, chainTarget.x - e.x);
                            bullets.push({ x: e.x, y: e.y, vx: Math.cos(ca) * 8, vy: Math.sin(ca) * 8, radius: b.radius, damage: b.damage * 0.6, color: '#9b59b6', pierce: false, pierced: [], isEnemyBullet: false, _chained: true });
                            spawnLineParticles(e.x, e.y, chainTarget.x, chainTarget.y, '#9b59b6', 3);
                        }
                    }

                    if (b.pierce) { b.pierced.push(e.id); }
                    else { bullets.splice(i, 1); }

                    if (e.hp <= 0) {
                        // Enemy adaptation
                        if (enemyAdapt && b.color) {
                            const key = e.type + '_' + b.color;
                            enemyAdaptMap[key] = (enemyAdaptMap[key] || 0) + 1;
                        }

                        const scoreGain = e.type === 'boss' ? 150 * currentDifficulty.scoreMult : (e.elite ? 50 : (e.type === 'elite' ? 35 : 12));
                        score += scoreGain;
                        totalKills++;
                        comboCount++; comboTimer = 100;
                        if (comboCount > maxCombo) maxCombo = comboCount;
                        killStreakCount++; killStreakTimer = 180;
                        document.getElementById('comboBlock').style.opacity = '1';
                        document.getElementById('comboValue').textContent = 'x' + comboCount;
                        if (comboCount >= 10) score += comboCount * 2;

                        if (e.elite) {
                            eliteKills++;
                            SFX.bossDie();
                            addNotifLog('⭐', `精英击杀: ${e.eliteMods.map(m => m.name).join('+')}`);
                            // Elite drops
                            for (let d = 0; d < 3; d++) {
                                pickups.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y + (Math.random() - 0.5) * 40, type: Math.random() < 0.4 ? 'health' : (Math.random() < 0.5 ? 'shield' : 'xp'), life: 400 });
                            }
                            // Elite explode on death
                            if (e.explodeOnDeath) {
                                for (const ne of enemies) { if (Math.sqrt((ne.x - e.x)**2 + (ne.y - e.y)**2) < 100) ne.hp -= 30; }
                                spawnParticles(e.x, e.y, '#ff6600', 20, 5, 30); screenShake = 12;
                            }
                            // Elite split
                            if (e.splitOnDeath > 0) {
                                for (let s = 0; s < e.splitOnDeath; s++) {
                                    const child = createEnemy('fast');
                                    child.x = e.x + (Math.random() - 0.5) * 30;
                                    child.y = e.y + (Math.random() - 0.5) * 30;
                                    child.hp = e.maxHp * 0.3; child.maxHp = child.hp;
                                    enemies.push(child);
                                }
                            }
                        }

                        if (e.type === 'boss') {
                            SFX.bossDie(); bossActive = false;
                            score += 250 * currentDifficulty.scoreMult;
                            addXP(70 * currentDifficulty.xpMult);
                            if (!achievements.boss_slayer.unlocked) { achievements.boss_slayer.unlocked = true; showAchievement(achievements.boss_slayer.name, achievements.boss_slayer.desc); }
                            if (e.mechanisms && e.mechanisms.onDeath) e.mechanisms.onDeath(e);
                            for (let d = 0; d < 6; d++) pickups.push({ x: e.x + (Math.random() - 0.5) * 70, y: e.y + (Math.random() - 0.5) * 70, type: Math.random() < 0.5 ? 'health' : 'shield', life: 450 });
                            spawnParticles(e.x, e.y, '#ffd700', 60, 12, 60); screenShake = 35;
                        } else {
                            SFX.enemyDie();
                            addXP((e.elite ? 25 : (e.type === 'elite' ? 18 : 6)) * currentDifficulty.xpMult);
                            if (Math.random() < 0.2) pickups.push({ x: e.x, y: e.y, type: Math.random() < 0.55 ? 'health' : 'shield', life: 380 });
                            if (ammoLimited && Math.random() < 0.15) pickups.push({ x: e.x, y: e.y, type: 'ammo', life: 380 });
                            if (vampiricHeal > 0) {
                                const healAmt = Math.floor(player.maxHp * vampiricHeal);
                                player.hp = Math.min(player.maxHp, player.hp + healAmt);
                                addDamageNumber(player.x, player.y - 20, '+' + healAmt, 'heal');
                            }
                        }

                        spawnParticles(e.x, e.y, e.color, 18, 5, 30);
                        if (activeRule && activeRule.onEnemyDeath) activeRule.onEnemyDeath(e);
                        if (activeRule2 && activeRule2.onEnemyDeath) activeRule2.onEnemyDeath(e);

                        // Splitter
                        if (e.splitOnDeath > 0 && !e.elite) {
                            for (let s = 0; s < e.splitOnDeath; s++) {
                                const child = createEnemy('normal');
                                child.x = e.x + (Math.random() - 0.5) * 20;
                                child.y = e.y + (Math.random() - 0.5) * 20;
                                child.hp = e.maxHp * 0.4; child.maxHp = child.hp;
                                child.radius = e.radius * 0.7; child.color = e.color;
                                enemies.push(child);
                            }
                        }

                        enemies.splice(j, 1);
                    }
                    if (!b.pierce) break;
                    if (b.pierce && b.pierced.length >= 5) { bullets.splice(i, 1); break; }
                }
            }
        }
    }

    // ==================== UPDATE WALLS / PICKUPS / PARTICLES ====================
    for (let i = walls.length - 1; i >= 0; i--) { walls[i].life--; if (walls[i].life <= 0) walls.splice(i, 1); }

    for (let i = pickups.length - 1; i >= 0; i--) {
        pickups[i].life--;
        if (pickups[i].life <= 0) { pickups.splice(i, 1); continue; }
        const pd = Math.sqrt((player.x - pickups[i].x)**2 + (player.y - pickups[i].y)**2);
        if (pd < player.radius + 16) {
            // Greed curse
            if (greedCurse && Math.random() < 0.3) {
                damagePlayer(5, 'greed_curse');
                addDamageNumber(player.x, player.y - 20, '诅咒!', 'normal');
            } else {
                if (pickups[i].type === 'health') { player.hp = Math.min(player.maxHp, player.hp + 22); spawnParticles(pickups[i].x, pickups[i].y, '#2ecc71', 8, 3, 20); }
                else if (pickups[i].type === 'shield') { playerShield += 18; spawnParticles(pickups[i].x, pickups[i].y, '#3498db', 8, 3, 20); }
                else if (pickups[i].type === 'ammo') { currentAmmo = Math.min(maxAmmo, currentAmmo + 10); spawnParticles(pickups[i].x, pickups[i].y, '#f39c12', 8, 3, 20); }
                else if (pickups[i].type === 'xp') { addXP(15); spawnParticles(pickups[i].x, pickups[i].y, '#9b59b6', 8, 3, 20); }
            }
            SFX.pickup();
            pickups.splice(i, 1); updateHUD();
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * timeScale; p.y += p.vy * timeScale;
        if (p.vx !== undefined) { p.vx *= 0.97; p.vy *= 0.97; }
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    if (activeRule && activeRule.update) activeRule.update();
    if (activeRule2 && activeRule2.update) activeRule2.update();

    checkAchievements();
    updateHUD();
}

function rectCircleCollision(rect, circle) {
    const closestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
    const closestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));
    return ((circle.x - closestX)**2 + (circle.y - closestY)**2) < (circle.radius * circle.radius);
}

function initGame() {
    player.x = 480; player.y = 270;
    player.hp = 100; player.maxHp = 100;
    player.vx = 0; player.vy = 0;
    player.clones = []; player.currentWeapon = 0; player.speed = 4;

    bullets = []; enemies = []; particles = []; walls = []; pickups = [];
    bossActive = false; score = 0; wave = 1; survivalTime = 0; totalKills = 0;
    comboCount = 0; comboTimer = 0; maxCombo = 0; eliteKills = 0;
    frameCount = 0; screenShake = 0; playerInvincible = 0; playerFireCooldown = 0;
    lastDamageSource = ''; nextEnemyId = 0; nextBossIndex = 0;
    killStreakCount = 0; killStreakTimer = 0;
    damageNumbers = [];

    activeStatusEffects = []; skillCooldowns = [0, 0, 0, 0];
    timeWarpActive = false; timeWarpTimer = 0;
    activeEvent = null; eventTimer = 0; eventCooldown = 0; eventTriggerCount = 0;

    resetAllRules(); cyclePhase = 'normal'; cycleTimer = 0;
    resetUpgrades();

    // Apply meta bonuses
    applyMetaBonuses();

    document.getElementById('ruleDisplay').classList.remove('active');
    document.getElementById('ruleTimer').style.display = 'none';
    document.getElementById('ruleTimer').classList.remove('active');
    document.getElementById('ruleSignature').className = 'rule-signature';
    document.getElementById('glitchOverlay').classList.remove('active');
    document.getElementById('gameContainer').classList.remove('rule-active');
    document.getElementById('gameOverScreen').classList.remove('active');
    document.getElementById('gameOverScreen').style.display = '';   // 清内联样式
    // document.getElementById('startScreen').style.display = 'none';
    // document.getElementById('difficultyScreen').style.display = 'none';
    document.getElementById('comboBlock').style.opacity = '0';
    document.getElementById('upgradePopup').classList.remove('active');
    document.getElementById('upgradePopup').innerHTML = '';
    document.getElementById('eventPopup').classList.remove('show');
    document.getElementById('killStreak').classList.remove('active');
    document.getElementById('notifLog').innerHTML = '';
    updateHUD(); syncSettingsToUI(); updateWeaponHUD();
}
