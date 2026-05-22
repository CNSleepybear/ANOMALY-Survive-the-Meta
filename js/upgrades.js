// ==================== UPGRADE SYSTEM ====================
let playerLevel = 1;
let playerXP = 0;
let playerXPToNext = 35;
let playerDamageMult = 1;
let playerSpeedMult = 1;
let playerFireRate = 14;
let playerShield = 0;
let playerRegen = 0;
let upgradeOptions = [];
let showingUpgrade = false;
let upgradeTimeout = 0;
let overclockUnlocked = false;
let chainLightning = false;
let explosiveRounds = false;

// ==================== BUILD SYSTEM ====================
let currentBuildPath = 'none';
let buildSynergies = {};
let weaponSpecializations = [0, 0, 0, 0];
let lastUpgradeSelections = [];
const MAX_SELECTIONS_TRACK = 5;


let metaShards = 0;
let metaUnlocks = {};
let buildMemory = [];
try {
    metaShards = parseInt(localStorage.getItem('anomaly_shards') || '0');
    metaUnlocks = JSON.parse(localStorage.getItem('anomaly_meta') || '{}');
    buildMemory = JSON.parse(localStorage.getItem('anomaly_builds') || '[]');
} catch (e) {
    console.warn('[ANOMALY] localStorage blocked, using memory fallback');
}

const META_UPGRADES = [
    { id: 'meta_hp', name: '核心强化', icon: '❤️', desc: '初始生命+20', cost: 10, max: 5, effect(lvl) { return { hpBonus: lvl * 20 }; } },
    { id: 'meta_dmg', name: '武器校准', icon: '💥', desc: '初始伤害+10%', cost: 15, max: 5, effect(lvl) { return { dmgBonus: lvl * 0.1 }; } },
    { id: 'meta_speed', name: '机动模块', icon: '⚡', desc: '初始移速+5%', cost: 12, max: 5, effect(lvl) { return { spdBonus: lvl * 0.05 }; } },
    { id: 'meta_xp', name: '数据加速', icon: '📊', desc: '经验获取+15%', cost: 20, max: 3, effect(lvl) { return { xpBonus: lvl * 0.15 }; } },
    { id: 'meta_shield', name: '初始护盾', icon: '🛡️', desc: '开局获得25护盾', cost: 18, max: 3, effect(lvl) { return { shieldStart: lvl * 25 }; } },
    { id: 'meta_regen', name: '纳米修复', icon: '🔧', desc: '每秒回血+0.2', cost: 25, max: 3, effect(lvl) { return { regenBonus: lvl * 0.2 }; } },
    { id: 'meta_crit', name: '暴击芯片', icon: '🎯', desc: '初始暴击率+5%', cost: 30, max: 3, effect(lvl) { return { critBonus: lvl * 0.05 }; } },
    { id: 'meta_luck', name: '幸运协议', icon: '🍀', desc: '升级选项+1', cost: 40, max: 2, effect(lvl) { return { upgradeChoices: lvl }; } },
    { id: 'meta_reroll', name: '重编译器', icon: '🔄', desc: '可花费碎片重roll升级', cost: 35, max: 1, effect(lvl) { return { reroll: lvl > 0 }; } },
];

function getMetaLevel(id) { return metaUnlocks[id] || 0; }

function buyMetaUpgrade(id) {
    const upg = META_UPGRADES.find(u => u.id === id);
    if (!upg) return;
    const lvl = getMetaLevel(id);
    if (lvl >= upg.max) return;
    const cost = upg.cost * (lvl + 1);
    if (metaShards < cost) return;
    metaShards -= cost;
    metaUnlocks[id] = lvl + 1;
    try {
        localStorage.setItem('anomaly_shards', metaShards.toString());
        localStorage.setItem('anomaly_meta', JSON.stringify(metaUnlocks));
    } catch (e) {
        console.warn('[ANOMALY] Failed to save meta:', e);
    }
    renderMetaPanel();
}

function applyMetaBonuses() {
    let hpBonus = 0, dmgBonus = 0, spdBonus = 0, shieldStart = 0, regenBonus = 0, critBonus = 0;
    for (const upg of META_UPGRADES) {
        const lvl = getMetaLevel(upg.id);
        if (lvl <= 0) continue;
        const fx = upg.effect(lvl);
        if (fx.hpBonus) hpBonus += fx.hpBonus;
        if (fx.dmgBonus) dmgBonus += fx.dmgBonus;
        if (fx.spdBonus) spdBonus += fx.spdBonus;
        if (fx.shieldStart) shieldStart += fx.shieldStart;
        if (fx.regenBonus) regenBonus += fx.regenBonus;
        if (fx.critBonus) critBonus += fx.critBonus;
    }
    player.maxHp += hpBonus;
    player.hp = player.maxHp;
    playerDamageMult += dmgBonus;
    playerSpeedMult += spdBonus;
    playerShield += shieldStart;
    playerRegen += regenBonus;
    playerCritChance += critBonus;
}

function renderMetaPanel() {
    const grid = document.getElementById('metaGrid');
    const curr = document.getElementById('metaCurrency');
    if (!grid || !curr) return;
    curr.textContent = metaShards;
    grid.innerHTML = '';
    for (const upg of META_UPGRADES) {
        const lvl = getMetaLevel(upg.id);
        const cost = upg.cost * (lvl + 1);
        const maxed = lvl >= upg.max;
        const canBuy = metaShards >= cost && !maxed;
        const el = document.createElement('div');
        el.className = `meta-item ${maxed ? 'owned' : (canBuy ? '' : 'locked')}`;
        el.innerHTML = `
            <div class="meta-icon">${upg.icon}</div>
            <div class="meta-name">${upg.name}</div>
            <div class="meta-desc">${upg.desc}</div>
            <div class="meta-cost">${maxed ? 'MAX' : `${cost} 💎 (Lv.${lvl}/${upg.max})`}</div>
        `;
        if (canBuy) el.addEventListener('click', () => buyMetaUpgrade(upg.id));
        grid.appendChild(el);
    }
}

function earnShards(amount) {
    metaShards += amount;
    try {
        localStorage.setItem('anomaly_shards', metaShards.toString());
    } catch (e) {
        console.warn('[ANOMALY] Failed to save shards:', e);
    }
}

// ==================== WEAPON SPECIALIZATION TREE ====================
const WEAPON_TREES = {
    0: [
        { id: 'pistol_precision', name: '精准射手', desc: '冷却-10%', cost: 1, bonus() { playerFireRate = Math.max(3, Math.floor(playerFireRate * 0.9)); } },
        { id: 'pistol_dualshot', name: '连射模式', desc: '发射2发', cost: 2, bonus() { weapons[0].count = 2; } },
        { id: 'pistol_piercing', name: '能量弹', desc: '自动穿透', cost: 3, bonus() { weapons[0].pierce = true; weapons[0].damage += 8; } }
    ],
    1: [
        { id: 'shotgun_spread', name: '弹丸增强', desc: '散弹+4', cost: 1, bonus() { weapons[1].count += 4; } },
        { id: 'shotgun_wide', name: '广角扩散', desc: '角度扩大50%', cost: 2, bonus() { weapons[1].spread *= 1.5; } },
        { id: 'shotgun_converge', name: '聚合弹幕', desc: '远距聚集', cost: 3, bonus() { weapons[1].converge = true; } }
    ],
    2: [
        { id: 'rapid_speed', name: '射速狂飙', desc: '冷却-25%', cost: 1, bonus() { playerFireRate = Math.max(2, Math.floor(playerFireRate * 0.75)); } },
        { id: 'rapid_accuracy', name: '稳定性', desc: '偏差-30%', cost: 2, bonus() { weapons[2].spread *= 0.7; } },
        { id: 'rapid_ammo', name: '过载弹夹', desc: '子弹速度+40%', cost: 3, bonus() { weapons[2].speed *= 1.4; } }
    ],
    3: [
        { id: 'sniper_damage', name: '威力强化', desc: '伤害+30%', cost: 1, bonus() { weapons[3].damage *= 1.3; } },
        { id: 'sniper_penetrate', name: '深度穿透', desc: '可穿5个敌人', cost: 2, bonus() { weapons[3].maxPierce = 5; } },
        { id: 'sniper_explosive', name: '爆裂弹头', desc: '穿透时爆炸', cost: 3, bonus() { weapons[3].explosive = true; } }
    ]
};

// ==================== BUILD SYNERGY SYSTEM ====================
const BUILD_SYNERGIES = [
    {
        id: 'attack_master', name: '攻击大师',
        requires: ['伤害强化', '伤害强化', '伤害强化'],
        bonus: { damageMult: 0.15, desc: '额外伤害+15%' }
    },
    {
        id: 'speed_master', name: '速度大师',
        requires: ['机动加速', '射速超频', '机动加速'],
        bonus: { speedMult: 0.25, desc: '移动速度+25%' }
    },
    {
        id: 'survivor', name: '生存专家',
        requires: ['生命扩容', '护盾发生器', '纳米修复'],
        bonus: { regenMult: 2, shieldRegen: 0.05, desc: '护盾恢复+0.05/秒' }
    },
    {
        id: 'crit_master', name: '暴击大师',
        requires: ['暴击系统', '爆裂弹', '链式闪电'],
        bonus: { critMult: 0.2, desc: '暴击伤害倍数+20%' }
    },
    {
        id: 'glass_cannon', name: '玻璃大炮',
        requires: ['伤害强化', '伤害强化', '伤害强化', '伤害强化', '伤害强化'],
        bonus: { damageMult: 0.5, hpPenalty: 0.8, desc: '伤害翻倍 但最大生命-20%' }
    }
];

// ==================== RISKIER UPGRADES ====================
const RISKY_UPGRADES = [
    {
        name: '极限超载', icon: '⚡', desc: '射速+30% 但每秒-0.3血',
        weight: 3, maxPick: 2, buildPath: 'attack',
        canPick() { return playerFireRate > 5; },
        apply() { playerFireRate = Math.max(2, Math.floor(playerFireRate * 0.7)); playerRegen -= 0.3; }
    },
    {
        name: '献祭强化', icon: '💀', desc: '伤害+40% 但最大血-50',
        weight: 2, maxPick: 1, buildPath: 'attack',
        canPick() { return player.maxHp > 100; },
        apply() { playerDamageMult += 0.4; player.maxHp -= 50; player.hp = Math.min(player.hp, player.maxHp); }
    },
    {
        name: '狂暴模式', icon: '🔥', desc: '移速+50% 但护盾失效',
        weight: 2, maxPick: 1, buildPath: 'speed',
        canPick() { return playerSpeedMult < 3; },
        apply() { playerSpeedMult += 0.5; playerShield = 0; }
    },
    {
        name: '双刃剑', icon: '⚔️', desc: '伤害+60% 但受伤+30%',
        weight: 2, maxPick: 1, buildPath: 'attack',
        canPick() { return playerDamageMult < 5; },
        apply() { playerDamageMult += 0.6; globalDmgMult *= 1.3; }
    },
    {
        name: '时间赌徒', icon: '🎰', desc: '50%概率获得双倍效果或一无所有',
        weight: 1, maxPick: 1, buildPath: 'speed',
        canPick() { return playerLevel >= 10; },
        apply() {
            if (Math.random() < 0.5) {
                playerDamageMult += 0.5; playerSpeedMult += 0.3; playerFireRate = Math.max(2, Math.floor(playerFireRate * 0.7));
                showAchievement('时间赌徒', '运气不错！全属性大幅提升');
            } else {
                player.hp = Math.max(1, player.hp * 0.5);
                showAchievement('时间赌徒', '运气不好...生命减半');
            }
        }
    }
];

const ALL_UPGRADES = [
    {
        name: '生命扩容', icon: '❤️', desc: '最大生命+25',
        weight: 12, maxPick: 8, buildPath: 'defense',
        canPick() { return player.maxHp < 400; },
        apply() { player.maxHp += 25; player.hp = Math.min(player.hp + 25, player.maxHp); recordUpgradeSelection('生命扩容'); }
    },
    {
        name: '伤害强化', icon: '💥', desc: '武器伤害+20%',
        weight: 12, maxPick: 10, buildPath: 'attack',
        apply() { playerDamageMult += 0.2; recordUpgradeSelection('伤害强化'); }
    },
    {
        name: '机动加速', icon: '➡️', desc: '移动速度+12%',
        weight: 10, maxPick: 6, buildPath: 'speed',
        apply() { playerSpeedMult += 0.12; player.speed = 4 * playerSpeedMult; recordUpgradeSelection('机动加速'); }
    },
    {
        name: '射速超频', icon: '⚙️', desc: '射击冷却-20%',
        weight: 10, maxPick: 6, buildPath: 'speed',
        apply() { playerFireRate = Math.max(3, Math.floor(playerFireRate * 0.8)); recordUpgradeSelection('射速超频'); }
    },
    {
        name: '护盾发生器', icon: '🛡️', desc: '获得45护盾',
        weight: 10, maxPick: 5, buildPath: 'defense',
        canPick() { return playerShield < 200; },
        apply() { playerShield += 45; recordUpgradeSelection('护盾发生器'); }
    },
    {
        name: '纳米修复', icon: '🔧', desc: '生命恢复+0.1/秒',
        weight: 8, maxPick: 5, buildPath: 'defense',
        apply() { playerRegen += 0.1; recordUpgradeSelection('纳米修复'); }
    },
    {
        name: '扩容弹匣', icon: '📦', desc: '霰弹枪+2弹丸',
        weight: 6, maxPick: 4, buildPath: 'attack',
        apply() { weapons[1].count += 2; recordUpgradeSelection('扩容弹匣'); }
    },
    {
        name: '穿甲改造', icon: '✨', desc: '非穿透武器获得穿透',
        weight: 6, maxPick: 3, buildPath: 'attack',
        canPick() { return !weapons[0].pierce || !weapons[2].pierce; },
        apply() { weapons.forEach(w => { if (!w.pierce) w.pierce = true; else w.damage += 5; }); recordUpgradeSelection('穿甲改造'); }
    },
    {
        name: '暴击系统', icon: '🎯', desc: '25%概率3倍伤害',
        weight: 5, maxPick: 3, buildPath: 'attack',
        canPick() { return !playerCritChance; },
        apply() { playerCritChance = 0.25; recordUpgradeSelection('暴击系统'); }
    },
    {
        name: '链式闪电', icon: '⚡', desc: '命中时电弧传导',
        weight: 4, maxPick: 2, buildPath: 'attack',
        canPick() { return !chainLightning; },
        apply() { chainLightning = true; recordUpgradeSelection('链式闪电'); }
    },
    {
        name: '爆裂弹', icon: '💣', desc: '子弹命中产生爆炸',
        weight: 4, maxPick: 2, buildPath: 'attack',
        canPick() { return !explosiveRounds; },
        apply() { explosiveRounds = true; recordUpgradeSelection('爆裂弹'); }
    },
    {
        name: '系统超频', icon: '🚀', desc: '极限射速模式解锁',
        weight: 3, maxPick: 1, buildPath: 'speed',
        canPick() { return !overclockUnlocked; },
        apply() { overclockUnlocked = true; recordUpgradeSelection('系统超频'); }
    },
    {
        name: '凤凰协议', icon: '🔥', desc: '死亡时满血复活一次',
        weight: 3, maxPick: 2, buildPath: 'defense',
        apply() { phoenixReady = true; recordUpgradeSelection('凤凰协议'); }
    },
    {
        name: '全面回复', icon: '✨', desc: '回复50%最大生命',
        weight: 8, maxPick: 99, buildPath: 'defense',
        canPick() { return player.hp < player.maxHp * 0.8; },
        apply() { player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.5)); recordUpgradeSelection('全面回复'); }
    },
    // === NEW UPGRADES (Steam demo) ===
    {
        name: '磁力弹丸', icon: '🧲', desc: '子弹自动追踪最近敌人',
        weight: 5, maxPick: 2, buildPath: 'attack',
        canPick() { return !bulletHoming; },
        apply() { bulletHoming = true; bulletHomingStr = 0.06; recordUpgradeSelection('磁力弹丸'); }
    },
    {
        name: '分裂弹头', icon: '💫', desc: '子弹命中后分裂为3发',
        weight: 4, maxPick: 2, buildPath: 'attack',
        canPick() { return !bulletSplit; },
        apply() { bulletSplit = true; recordUpgradeSelection('分裂弹头'); }
    },
    {
        name: '能量护罩', icon: '🔰', desc: '每10秒自动获得10护盾',
        weight: 5, maxPick: 3, buildPath: 'defense',
        apply() { shieldRegenRate += 0.1; recordUpgradeSelection('能量护罩'); }
    },
    {
        name: '吸血本能', icon: '🧛', desc: '击杀回复3%最大生命',
        weight: 4, maxPick: 3, buildPath: 'defense',
        apply() { vampiricHeal += 0.03; recordUpgradeSelection('吸血本能'); }
    },
    {
        name: '弹射风暴', icon: '🌊', desc: '子弹在敌人间弹射1次',
        weight: 3, maxPick: 1, buildPath: 'attack',
        canPick() { return !bulletChainBounce; },
        apply() { bulletChainBounce = true; recordUpgradeSelection('弹射风暴'); }
    },
];

let upgradePickCounts = {};
let playerCritChance = 0;
let critMultiplier = 3;
let shieldRegenRate = 0;

// New upgrade globals
let bulletHoming = false;
let bulletHomingStr = 0;
let bulletSplit = false;
let bulletChainBounce = false;
let vampiricHeal = 0;

// ==================== HELPER FUNCTIONS ====================

function recordUpgradeSelection(name) {
    lastUpgradeSelections.push(name);
    if (lastUpgradeSelections.length > MAX_SELECTIONS_TRACK) lastUpgradeSelections.shift();
}

function detectBuildPath() {
    if (lastUpgradeSelections.length === 0) return 'none';
    let a = 0, d = 0, s = 0;
    const all = [...ALL_UPGRADES, ...RISKY_UPGRADES];
    for (const sel of lastUpgradeSelections) {
        const u = all.find(u => u.name === sel);
        if (u?.buildPath === 'attack') a++;
        else if (u?.buildPath === 'defense') d++;
        else if (u?.buildPath === 'speed') s++;
    }
    if (a > d && a > s) return 'attack';
    if (d > a && d > s) return 'defense';
    if (s > a && s > d) return 'speed';
    return 'none';
}

function checkBuildSynergies() {
    for (const synergy of BUILD_SYNERGIES) {
        let matched = true;
        for (const req of synergy.requires) {
            if ((upgradePickCounts[req] || 0) === 0) { matched = false; break; }
        }
        if (matched) {
            if (synergy.bonus.damageMult) playerDamageMult += synergy.bonus.damageMult;
            if (synergy.bonus.speedMult) playerSpeedMult *= (1 + synergy.bonus.speedMult);
            if (synergy.bonus.regenMult) playerRegen *= synergy.bonus.regenMult;
            if (synergy.bonus.shieldRegen) shieldRegenRate += synergy.bonus.shieldRegen;
            if (synergy.bonus.critMult) critMultiplier += synergy.bonus.critMult;
            if (synergy.bonus.hpPenalty) player.maxHp = Math.floor(player.maxHp * synergy.bonus.hpPenalty);
            showAchievement(`BUILD SYNERGY: ${synergy.name}`, synergy.bonus.desc);
        }
    }
}

function scalingObsolescence() {
    return ALL_UPGRADES.map(u => {
        if (playerLevel >= 15 && u.name === '生命扩容') {
            return { ...u, name: '生命极限突破', desc: '最大生命+50', apply() { player.maxHp += 50; player.hp = Math.min(player.hp + 50, player.maxHp); } };
        }
        if (playerLevel >= 15 && u.name === '伤害强化') {
            return { ...u, name: '伤害爆发', desc: '伤害+35%', apply() { playerDamageMult += 0.35; } };
        }
        return u;
    });
}

function resetUpgrades() {
    playerLevel = 1; playerXP = 0; playerXPToNext = 35;
    playerDamageMult = 1; playerSpeedMult = 1; playerFireRate = 14;
    playerShield = 0; playerRegen = 0;
    upgradeOptions = []; showingUpgrade = false; upgradeTimeout = 0;
    overclockUnlocked = false; chainLightning = false; explosiveRounds = false;
    playerCritChance = 0; critMultiplier = 3; shieldRegenRate = 0;
    currentBuildPath = 'none'; buildSynergies = {};
    upgradePickCounts = {}; lastUpgradeSelections = [];
    bulletHoming = false; bulletHomingStr = 0;
    bulletSplit = false; bulletChainBounce = false; vampiricHeal = 0;
}

function addXP(amount) {
    amount *= (1 + (typeof xpMultBonus !== 'undefined' ? xpMultBonus - 1 : 0));
    const metaBonus = getMetaLevel('meta_xp');
    amount *= (1 + metaBonus * 0.15);
    playerXP += amount;
    const toNext = playerXPToNext * (typeof xpToNextMult !== 'undefined' ? xpToNextMult : 1);
    while (playerXP >= toNext && playerLevel < 30) {
        playerXP -= toNext;
        playerLevel++;
        playerXPToNext = Math.floor(playerXPToNext * 1.35);
        triggerUpgrade();
    }
    updateHUD();
}

function triggerUpgrade() {
    if (showingUpgrade) return;
    currentBuildPath = detectBuildPath();
    const scaledUpgrades = scalingObsolescence();
    const pool = [...scaledUpgrades];
    if (playerLevel >= 8) pool.push(...RISKY_UPGRADES);

    let available = pool.filter(u => {
        const picked = upgradePickCounts[u.name] || 0;
        if (picked >= (u.maxPick || 99)) return false;
        if (u.canPick && !u.canPick()) return false;
        return true;
    });
    if (available.length === 0) { player.hp = Math.min(player.maxHp, player.hp + 20); return; }

    const preferred = available.filter(u => u.buildPath === currentBuildPath);
    let selPool = available;
    if (preferred.length > 0 && currentBuildPath !== 'none' && Math.random() < 0.7) selPool = preferred;

    const weighted = [];
    selPool.forEach(u => { for (let i = 0; i < (u.weight || 5); i++) weighted.push(u); });

    const metaLuck = getMetaLevel('meta_luck');
    const choiceCount = Math.min(3 + metaLuck, selPool.length);
    const shuffled = [];
    while (shuffled.length < choiceCount && weighted.length > 0) {
        const idx = Math.floor(Math.random() * weighted.length);
        const item = weighted.splice(idx, 1)[0];
        if (!shuffled.includes(item)) shuffled.push(item);
        for (let i = weighted.length - 1; i >= 0; i--) {
            if (weighted[i].name === item.name) weighted.splice(i, 1);
        }
    }

    upgradeOptions = shuffled;
    showingUpgrade = true;
    upgradeTimeout = 450;
    state = GameState.UPGRADE;
    renderUpgradePopup();
    SFX.upgrade();
}

function renderUpgradePopup() {
    const popup = document.getElementById('upgradePopup');
    popup.innerHTML = '';
    popup.classList.add('active');

    if (currentBuildPath !== 'none') {
        const bl = document.createElement('div');
        bl.className = 'build-path-label';
        const pn = { attack: '⚔️ 攻击路线', defense: '🛡️ 防守路线', speed: '⚡ 速度路线' };
        bl.textContent = `当前: ${pn[currentBuildPath]}`;
        popup.appendChild(bl);
    }

    upgradeOptions.forEach((opt, i) => {
        const btn = document.createElement('div');
        btn.className = 'upgrade-option' + (opt.buildPath === currentBuildPath && currentBuildPath !== 'none' ? ' preferred-upgrade' : '') + (RISKY_UPGRADES.includes(opt) ? ' risky' : '');
        btn.innerHTML = `<span class="upgrade-icon">${opt.icon}</span><span class="upgrade-name">${opt.name}</span><span class="upgrade-desc">${opt.desc}</span><span class="upgrade-key">[${i + 1}]</span>`;
        btn.addEventListener('click', (e) => { e.stopPropagation(); selectUpgrade(i); });
        btn.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); selectUpgrade(i); });
        popup.appendChild(btn);
    });
}

function selectUpgrade(index) {
    if (!showingUpgrade || index >= upgradeOptions.length) return;
    const opt = upgradeOptions[index];
    opt.apply();
    upgradePickCounts[opt.name] = (upgradePickCounts[opt.name] || 0) + 1;
    checkBuildSynergies();
    upgradeOptions = [];
    showingUpgrade = false;
    const popup = document.getElementById('upgradePopup');
    popup.classList.remove('active');
    popup.innerHTML = '';
    state = (cyclePhase === 'active') ? GameState.RULE_ACTIVE : GameState.PLAYING;
    updateHUD();
}

function saveBuild() {
    const build = {
        level: playerLevel, score, wave, time: Math.floor(survivalTime),
        upgrades: { ...upgradePickCounts },
        stats: { hp: player.maxHp, damage: playerDamageMult, speed: playerSpeedMult, fireRate: playerFireRate, shield: playerShield },
        buildPath: currentBuildPath,
        timestamp: new Date().toLocaleString()
    };
    buildMemory.push(build);
    if (buildMemory.length > 10) buildMemory.shift();
    try {
        localStorage.setItem('anomaly_builds', JSON.stringify(buildMemory));
    } catch (e) {
        console.warn('[ANOMALY] Failed to save build:', e);
    }
}

function loadBuildHistory() { return buildMemory; }
