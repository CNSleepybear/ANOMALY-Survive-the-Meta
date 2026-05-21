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

const ALL_UPGRADES = [
    {
        name: '生命扩容', icon: '❤️', desc: '最大生命+25',
        weight: 12, maxPick: 8,
        canPick() { return player.maxHp < 400; },
        apply() { player.maxHp += 25; player.hp = Math.min(player.hp + 25, player.maxHp); }
    },
    {
        name: '伤害强化', icon: '', desc: '武器伤害+20%',
        weight: 12, maxPick: 10,
        apply() { playerDamageMult += 0.2; }
    },
    {
        name: '机动加速', icon: '', desc: '移动速度+12%',
        weight: 10, maxPick: 6,
        apply() { playerSpeedMult += 0.12; player.speed = 4 * playerSpeedMult; }
    },
    {
        name: '射速超频', icon: '', desc: '射击冷却-20%',
        weight: 10, maxPick: 6,
        apply() { playerFireRate = Math.max(3, Math.floor(playerFireRate * 0.8)); }
    },
    {
        name: '护盾发生器', icon: '️', desc: '获得45护盾',
        weight: 10, maxPick: 5,
        canPick() { return playerShield < 200; },
        apply() { playerShield += 45; }
    },
    {
        name: '纳米修复', icon: '', desc: '生命恢复+0.1/秒',
        weight: 8, maxPick: 5,
        apply() { playerRegen += 0.1; }
    },
    {
        name: '扩容弹匣', icon: '', desc: '霰弹枪+2弹丸',
        weight: 6, maxPick: 4,
        apply() { weapons[1].count += 2; }
    },
    {
        name: '穿甲改造', icon: '✨', desc: '非穿透武器获得穿透',
        weight: 6, maxPick: 3,
        canPick() { return !weapons[0].pierce || !weapons[2].pierce; },
        apply() {
            weapons.forEach(w => { if (!w.pierce) w.pierce = true; else w.damage += 5; });
        }
    },
    {
        name: '暴击系统', icon: '', desc: '25%概率3倍伤害',
        weight: 5, maxPick: 3,
        canPick() { return !playerCritChance; },
        apply() { playerCritChance = 0.25; }
    },
    {
        name: '链式闪电', icon: '⚡', desc: '命中时电弧传导',
        weight: 4, maxPick: 2,
        canPick() { return !chainLightning; },
        apply() { chainLightning = true; }
    },
    {
        name: '爆裂弹', icon: '', desc: '子弹命中产生爆炸',
        weight: 4, maxPick: 2,
        canPick() { return !explosiveRounds; },
        apply() { explosiveRounds = true; }
    },
    {
        name: '系统超频', icon: '', desc: '极限射速模式解锁',
        weight: 3, maxPick: 1,
        canPick() { return !overclockUnlocked; },
        apply() { overclockUnlocked = true; }
    },
    {
        name: '凤凰协议', icon: '', desc: '死亡时满血复活一次',
        weight: 3, maxPick: 2,
        apply() { phoenixReady = true; }
    },
    {
        name: '全面回复', icon: '', desc: '回复50%最大生命',
        weight: 8, maxPick: 99,
        canPick() { return player.hp < player.maxHp * 0.8; },
        apply() { player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.5)); }
    },
];

let upgradePickCounts = {};
let playerCritChance = 0;

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
    upgradePickCounts = {};
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
    const available = ALL_UPGRADES.filter(u => {
        const picked = upgradePickCounts[u.name] || 0;
        if (picked >= (u.maxPick || 99)) return false;
        if (u.canPick && !u.canPick()) return false;
        return true;
    });
    if (available.length === 0) {
        // Fallback: heal
        player.hp = Math.min(player.maxHp, player.hp + 20);
        return;
    }
    // Weighted shuffle
    const pool = [];
    available.forEach(u => {
        const w = u.weight || 5;
        for (let i = 0; i < w; i++) pool.push(u);
    });
    const shuffled = [];
    while (shuffled.length < Math.min(3, available.length) && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        const item = pool.splice(idx, 1)[0];
        if (!shuffled.includes(item)) shuffled.push(item);
        // Remove all instances of this item from pool
        for (let i = pool.length - 1; i >= 0; i--) {
            if (pool[i].name === item.name) pool.splice(i, 1);
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
    upgradeOptions.forEach((opt, i) => {
        const btn = document.createElement('div');
        btn.className = 'upgrade-option';
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
    upgradeOptions = [];
    showingUpgrade = false;
    const popup = document.getElementById('upgradePopup');
    popup.classList.remove('active');
    popup.innerHTML = '';
    state = (cyclePhase === 'active') ? GameState.RULE_ACTIVE : GameState.PLAYING;
    updateHUD();
}
