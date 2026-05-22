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
let currentBuildPath = 'none'; // 'attack', 'defense', 'speed', 'none'
let buildSynergies = {}; // Track upgrade combinations
let weaponSpecializations = [0, 0, 0, 0]; // Specialization points per weapon
let lastUpgradeSelections = []; // Track last 5 selections
const MAX_SELECTIONS_TRACK = 5;
let buildMemory = JSON.parse(localStorage.getItem('anomaly_builds') || '[]');

// ==================== WEAPON SPECIALIZATION TREE ====================
const WEAPON_TREES = {
    0: [ // 脉冲手枪
        { id: 'pistol_precision', name: '精准射手', desc: '冷却-10%', cost: 1, bonus: () => { playerFireRate = Math.max(3, Math.floor(playerFireRate * 0.9)); } },
        { id: 'pistol_dualshot', name: '连射模式', desc: '发射2发', cost: 2, bonus: () => { weapons[0].count = 2; } },
        { id: 'pistol_piercing', name: '能量弹', desc: '自动穿透', cost: 3, bonus: () => { weapons[0].pierce = true; weapons[0].damage += 8; } }
    ],
    1: [ // 散弹枪
        { id: 'shotgun_spread', name: '弹丸增强', desc: '散弹+4', cost: 1, bonus: () => { weapons[1].count += 4; } },
        { id: 'shotgun_wide', name: '广角扩散', desc: '角度扩大50%', cost: 2, bonus: () => { weapons[1].spread *= 1.5; } },
        { id: 'shotgun_converge', name: '聚合弹幕', desc: '远距聚集', cost: 3, bonus: () => { weapons[1].converge = true; } }
    ],
    2: [ // 速射风暴
        { id: 'rapid_speed', name: '射速狂飙', desc: '冷却-25%', cost: 1, bonus: () => { playerFireRate = Math.max(2, Math.floor(playerFireRate * 0.75)); } },
        { id: 'rapid_accuracy', name: '稳定性', desc: '偏差-30%', cost: 2, bonus: () => { weapons[2].spread *= 0.7; } },
        { id: 'rapid_ammo', name: '过载弹夹', desc: '子弹速度+40%', cost: 3, bonus: () => { weapons[2].speed *= 1.4; } }
    ],
    3: [ // 穿透狙击
        { id: 'sniper_damage', name: '威力强化', desc: '伤害+30%', cost: 1, bonus: () => { weapons[3].damage *= 1.3; } },
        { id: 'sniper_penetrate', name: '深度穿透', desc: '可穿5个敌人', cost: 2, bonus: () => { weapons[3].maxPierce = 5; } },
        { id: 'sniper_explosive', name: '爆裂弹头', desc: '穿透时爆炸', cost: 3, bonus: () => { weapons[3].explosive = true; } }
    ]
};

// ==================== BUILD SYNERGY SYSTEM ====================
const BUILD_SYNERGIES = [
    {
        id: 'attack_master',
        name: '攻击大师',
        requires: ['伤害强化', '伤害强化', '伤害强化'],
        bonus: { damageMult: 0.15, desc: '额外伤害+15%' }
    },
    {
        id: 'speed_master',
        name: '速度大师',
        requires: ['机动加速', '射速超频', '机动加速'],
        bonus: { speedMult: 0.25, desc: '移动速度翻倍+25%' }
    },
    {
        id: 'survivor',
        name: '生存专家',
        requires: ['生命扩容', '护盾发生器', '纳米修复'],
        bonus: { regenMult: 2, shieldRegen: 0.05, desc: '护盾恢复+0.05/秒' }
    },
    {
        id: 'crit_master',
        name: '暴击大师',
        requires: ['暴击系统', '爆裂弹', '链式闪电'],
        bonus: { critMult: 0.2, desc: '暴击伤害倍数+20%' }
    },
    {
        id: 'glass_cannon',
        name: '玻璃大炮',
        requires: ['伤害强化', '伤害强化', '伤害强化', '伤害强化', '伤害强化'],
        bonus: { damageMult: 0.5, hpPenalty: 0.8, desc: '伤害翻倍 但最大生命-20%' }
    }
];

// ==================== RISKIER UPGRADES ====================
const RISKY_UPGRADES = [
    {
        name: '极限超载',
        icon: '⚡',
        desc: '射速+30% 但每秒-0.3血',
        weight: 3,
        maxPick: 2,
        canPick() { return playerFireRate > 5; },
        apply() {
            playerFireRate = Math.max(2, Math.floor(playerFireRate * 0.7));
            playerRegen -= 0.3;
        }
    },
    {
        name: '献祭强化',
        icon: '💀',
        desc: '伤害+40% 但最大血-50',
        weight: 2,
        maxPick: 1,
        canPick() { return player.maxHp > 100; },
        apply() {
            playerDamageMult += 0.4;
            player.maxHp -= 50;
            player.hp = Math.min(player.hp, player.maxHp);
        }
    },
    {
        name: '狂暴模式',
        icon: '🔥',
        desc: '移速+50% 但护盾失效',
        weight: 2,
        maxPick: 1,
        canPick() { return playerSpeedMult < 3; },
        apply() {
            playerSpeedMult += 0.5;
            playerShield = 0; // 失效当前护盾
        }
    }
];

const ALL_UPGRADES = [
    {
        name: '生命扩容', icon: '❤️', desc: '最大生命+25',
        weight: 12, maxPick: 8, buildPath: 'defense',
        canPick() { return player.maxHp < 400; },
        apply() {
            player.maxHp += 25;
            player.hp = Math.min(player.hp + 25, player.maxHp);
            recordUpgradeSelection('生命扩容');
        }
    },
    {
        name: '伤害强化', icon: '💥', desc: '武器伤害+20%',
        weight: 12, maxPick: 10, buildPath: 'attack',
        apply() {
            playerDamageMult += 0.2;
            recordUpgradeSelection('伤害强化');
        }
    },
    {
        name: '机动加速', icon: '➡️', desc: '移动速度+12%',
        weight: 10, maxPick: 6, buildPath: 'speed',
        apply() {
            playerSpeedMult += 0.12;
            player.speed = 4 * playerSpeedMult;
            recordUpgradeSelection('机动加速');
        }
    },
    {
        name: '射速超频', icon: '⚙️', desc: '射击冷却-20%',
        weight: 10, maxPick: 6, buildPath: 'speed',
        apply() {
            playerFireRate = Math.max(3, Math.floor(playerFireRate * 0.8));
            recordUpgradeSelection('射速超频');
        }
    },
    {
        name: '护盾发生器', icon: '🛡️', desc: '获得45护盾',
        weight: 10, maxPick: 5, buildPath: 'defense',
        canPick() { return playerShield < 200; },
        apply() {
            playerShield += 45;
            recordUpgradeSelection('护盾发生器');
        }
    },
    {
        name: '纳米修复', icon: '🔧', desc: '生命恢复+0.1/秒',
        weight: 8, maxPick: 5, buildPath: 'defense',
        apply() {
            playerRegen += 0.1;
            recordUpgradeSelection('纳米修复');
        }
    },
    {
        name: '扩容弹匣', icon: '📦', desc: '霰弹枪+2弹丸',
        weight: 6, maxPick: 4, buildPath: 'attack',
        apply() {
            weapons[1].count += 2;
            recordUpgradeSelection('扩容弹匣');
        }
    },
    {
        name: '穿甲改造', icon: '✨', desc: '非穿透武器获得穿透',
        weight: 6, maxPick: 3, buildPath: 'attack',
        canPick() { return !weapons[0].pierce || !weapons[2].pierce; },
        apply() {
            weapons.forEach(w => { if (!w.pierce) w.pierce = true; else w.damage += 5; });
            recordUpgradeSelection('穿甲改造');
        }
    },
    {
        name: '暴击系统', icon: '🎯', desc: '25%概率3倍伤害',
        weight: 5, maxPick: 3, buildPath: 'attack',
        canPick() { return !playerCritChance; },
        apply() {
            playerCritChance = 0.25;
            recordUpgradeSelection('暴击系统');
        }
    },
    {
        name: '链式闪电', icon: '⚡', desc: '命中时电弧传导',
        weight: 4, maxPick: 2, buildPath: 'attack',
        canPick() { return !chainLightning; },
        apply() {
            chainLightning = true;
            recordUpgradeSelection('链式闪电');
        }
    },
    {
        name: '爆裂弹', icon: '💣', desc: '子弹命中产生爆炸',
        weight: 4, maxPick: 2, buildPath: 'attack',
        canPick() { return !explosiveRounds; },
        apply() {
            explosiveRounds = true;
            recordUpgradeSelection('爆裂弹');
        }
    },
    {
        name: '系统超频', icon: '🚀', desc: '极限射速模式解锁',
        weight: 3, maxPick: 1, buildPath: 'speed',
        canPick() { return !overclockUnlocked; },
        apply() {
            overclockUnlocked = true;
            recordUpgradeSelection('系统超频');
        }
    },
    {
        name: '凤凰协议', icon: '🔥', desc: '死亡时满血复活一次',
        weight: 3, maxPick: 2, buildPath: 'defense',
        apply() {
            phoenixReady = true;
            recordUpgradeSelection('凤凰协议');
        }
    },
    {
        name: '全面回复', icon: '✨', desc: '回复50%最大生命',
        weight: 8, maxPick: 99, buildPath: 'defense',
        canPick() { return player.hp < player.maxHp * 0.8; },
        apply() {
            player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.5));
            recordUpgradeSelection('全面回复');
        }
    }
];

let upgradePickCounts = {};
let playerCritChance = 0;
let critMultiplier = 3; // 暴击倍数
let shieldRegenRate = 0; // 护盾自动恢复

// ==================== HELPER FUNCTIONS ====================

function recordUpgradeSelection(name) {
    lastUpgradeSelections.push(name);
    if (lastUpgradeSelections.length > MAX_SELECTIONS_TRACK) {
        lastUpgradeSelections.shift();
    }
}

function detectBuildPath() {
    // 根据升级历史自动检测Build路线
    if (lastUpgradeSelections.length === 0) return 'none';
    
    let attackCount = 0, defenseCount = 0, speedCount = 0;
    const allUpgrades = [...ALL_UPGRADES, ...RISKY_UPGRADES];
    
    for (const selection of lastUpgradeSelections) {
        const upgrade = allUpgrades.find(u => u.name === selection);
        if (upgrade?.buildPath === 'attack') attackCount++;
        else if (upgrade?.buildPath === 'defense') defenseCount++;
        else if (upgrade?.buildPath === 'speed') speedCount++;
    }
    
    if (attackCount > defenseCount && attackCount > speedCount) return 'attack';
    if (defenseCount > attackCount && defenseCount > speedCount) return 'defense';
    if (speedCount > attackCount && speedCount > defenseCount) return 'speed';
    return 'none';
}

function checkBuildSynergies() {
    const activeSynergies = [];
    
    for (const synergy of BUILD_SYNERGIES) {
        const required = synergy.requires;
        let matched = true;
        
        for (const req of required) {
            const count = upgradePickCounts[req] || 0;
            if (count === 0) { matched = false; break; }
        }
        
        if (matched) {
            // 应用synergy效果
            if (synergy.bonus.damageMult) playerDamageMult += synergy.bonus.damageMult;
            if (synergy.bonus.speedMult) playerSpeedMult *= (1 + synergy.bonus.speedMult);
            if (synergy.bonus.regenMult) playerRegen *= synergy.bonus.regenMult;
            if (synergy.bonus.shieldRegen) shieldRegenRate += synergy.bonus.shieldRegen;
            if (synergy.bonus.critMult) critMultiplier += synergy.bonus.critMult;
            if (synergy.bonus.hpPenalty) player.maxHp = Math.floor(player.maxHp * synergy.bonus.hpPenalty);
            
            activeSynergies.push(synergy);
            showAchievement(`BUILD SYNERGY: ${synergy.name}`, synergy.bonus.desc);
        }
    }
    
    return activeSynergies;
}

function scalingObsolescence() {
    // Level 15+ 不再提供基础升级
    return ALL_UPGRADES.map(u => {
        if (playerLevel >= 15 && u.name === '生命扩容') {
            return {
                ...u,
                name: '生命极限突破',
                desc: '最大生命+50',
                apply() {
                    player.maxHp += 50;
                    player.hp = Math.min(player.hp + 50, player.maxHp);
                }
            };
        }
        if (playerLevel >= 15 && u.name === '伤害强化') {
            return {
                ...u,
                name: '伤害爆发',
                desc: '伤害+35%',
                apply() {
                    playerDamageMult += 0.35;
                }
            };
        }
        return u;
    });
}

function resetUpgrades() {
    playerLevel = 1;
    playerXP = 0;
    playerXPToNext = 35;
    playerDamageMult = 1;
    playerSpeedMult = 1;
    playerFireRate = 14;
    playerShield = 0;
    playerRegen = 0;
    upgradeOptions = [];
    showingUpgrade = false;
    upgradeTimeout = 0;
    overclockUnlocked = false;
    chainLightning = false;
    explosiveRounds = false;
    playerCritChance = 0;
    critMultiplier = 3;
    shieldRegenRate = 0;
    currentBuildPath = 'none';
    buildSynergies = {};
    upgradePickCounts = {};
    lastUpgradeSelections = [];
}

function addXP(amount) {
    playerXP += amount;
    while (playerXP >= playerXPToNext && playerLevel < 25) {
        playerXP -= playerXPToNext;
        playerLevel++;
        playerXPToNext = Math.floor(playerXPToNext * 1.38);
        triggerUpgrade();
    }
    updateHUD();
}

function triggerUpgrade() {
    if (showingUpgrade) return;
    
    // 检测Build路线
    currentBuildPath = detectBuildPath();
    
    // 应用scaling obsolescence
    const scaledUpgrades = scalingObsolescence();
    const pool = [...scaledUpgrades];
    
    // 加入风险升级（Level 8+）
    if (playerLevel >= 8) {
        pool.push(...RISKY_UPGRADES);
    }
    
    // 优先同Build路线的升级
    let available = pool.filter(u => {
        const picked = upgradePickCounts[u.name] || 0;
        if (picked >= (u.maxPick || 99)) return false;
        if (u.canPick && !u.canPick()) return false;
        return true;
    });
    
    if (available.length === 0) {
        player.hp = Math.min(player.maxHp, player.hp + 20);
        return;
    }
    
    // 加权抽取，优先同路线升级
    const preferredUpgrades = available.filter(u => u.buildPath === currentBuildPath);
    let selectionPool = available;
    
    if (preferredUpgrades.length > 0 && currentBuildPath !== 'none') {
        // 70% 概率选择同路线升级
        if (Math.random() < 0.7) {
            selectionPool = preferredUpgrades;
        }
    }
    
    // 加权洗牌
    const weightedPool = [];
    selectionPool.forEach(u => {
        const w = u.weight || 5;
        for (let i = 0; i < w; i++) weightedPool.push(u);
    });
    
    const shuffled = [];
    while (shuffled.length < Math.min(3, selectionPool.length) && weightedPool.length > 0) {
        const idx = Math.floor(Math.random() * weightedPool.length);
        const item = weightedPool.splice(idx, 1)[0];
        if (!shuffled.includes(item)) shuffled.push(item);
        for (let i = weightedPool.length - 1; i >= 0; i--) {
            if (weightedPool[i].name === item.name) weightedPool.splice(i, 1);
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
    
    // 显示当前Build路线
    if (currentBuildPath !== 'none') {
        const buildLabel = document.createElement('div');
        buildLabel.className = 'build-path-label';
        const pathNames = { attack: '⚔️ 攻击路线', defense: '🛡️ 防守路线', speed: '⚡ 速度路线' };
        buildLabel.textContent = `当前: ${pathNames[currentBuildPath]}`;
        popup.appendChild(buildLabel);
    }
    
    upgradeOptions.forEach((opt, i) => {
        const btn = document.createElement('div');
        btn.className = 'upgrade-option';
        
        // 高亮同Build路线的选项
        if (opt.buildPath === currentBuildPath && currentBuildPath !== 'none') {
            btn.classList.add('preferred-upgrade');
        }
        
        btn.innerHTML = `<span class="upgrade-icon">${opt.icon}</span><span class="upgrade-name">${opt.name}</span><span class="upgrade-desc">${opt.desc}</span>`;
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
    
    // 检查Build synergies
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
        level: playerLevel,
        score: score,
        wave: wave,
        time: Math.floor(survivalTime),
        upgrades: { ...upgradePickCounts },
        stats: {
            hp: player.maxHp,
            damage: playerDamageMult,
            speed: playerSpeedMult,
            fireRate: playerFireRate,
            shield: playerShield
        },
        buildPath: currentBuildPath,
        timestamp: new Date().toLocaleString()
    };
    
    buildMemory.push(build);
    if (buildMemory.length > 10) buildMemory.shift(); // 只保留最新10个
    
    localStorage.setItem('anomaly_builds', JSON.stringify(buildMemory));
    showAchievement('BUILD SAVED', `Level ${playerLevel} Build 已保存`);
}

function loadBuildHistory() {
    return buildMemory;
}
