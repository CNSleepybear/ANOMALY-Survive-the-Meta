// ==================== CORE GAME ENGINE ====================

const GameState = { MENU: 'menu', PLAYING: 'playing', WARNING: 'warning', RULE_ACTIVE: 'rule_active', UPGRADE: 'upgrade', GAME_OVER: 'game_over' };
let state = GameState.MENU;
let frameCount = 0;
let score = 0;
let wave = 1;
let survivalTime = 0;
let totalKills = 0;
let comboCount = 0;
let comboTimer = 0;
let screenShake = 0;
let screenShakeX = 0;
let screenShakeY = 0;
let playerInvincible = 0;
let playerFireCooldown = 0;
let lastDamageSource = '';
let autoFireEnabled = false;

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
};

function spawnParticles(x, y, color, count = 8, size = 3, life = 25) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: life + Math.random() * 15,
            color,
            size: size + Math.random() * 2,
        });
    }
}

function spawnLineParticles(x1, y1, x2, y2, color, count = 4) {
    for (let i = 0; i < count; i++) {
        const t = Math.random();
        particles.push({
            x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t,
            x2: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20,
            y2: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20,
            vx: 0, vy: 0,
            life: 15 + Math.random() * 10,
            color,
            size: 2,
            isLine: true
        });
    }
}

function damagePlayer(amount, source) {
    if (playerInvincible > 0) return;
    if (phoenixReady && player.hp - amount <= 0) {
        player.hp = player.maxHp;
        playerShield = 50;
        phoenixReady = false;
        spawnParticles(player.x, player.y, '#ff6600', 40, 6, 50);
        screenShake = 25;
        SFX.achievement();
        showAchievement('涅槃重生', '凤凰协议触发，满血复活！');
        return;
    }
    amount *= globalDmgMult;
    if (playerShield > 0) {
        const absorbed = Math.min(playerShield, amount);
        playerShield -= absorbed;
        amount -= absorbed;
        spawnParticles(player.x, player.y, '#3498db', 6, 2, 15);
    }
    if (amount > 0) {
        player.hp -= amount;
        lastDamageSource = source;
        playerInvincible = 30;
        screenShake = Math.max(screenShake, amount * 1.8);
        spawnParticles(player.x, player.y, '#ff0055', 12, 4, 30);
        SFX.playerHit();
        if (activeRule && activeRule.onPlayerDamaged) activeRule.onPlayerDamaged(amount);
        if (activeRule2 && activeRule2.onPlayerDamaged) activeRule2.onPlayerDamaged(amount);
    }
    if (player.hp <= 0) {
        player.hp = 0;
        gameOver();
    }
    updateHUD();
}

function gameOver() {
    state = GameState.GAME_OVER;
    stopBGM();
    const ruleNames = {};
    RULES.forEach(r => ruleNames[r.id] = r.name);
    document.getElementById('deathReason').textContent = lastDamageSource
        ? `被「${ruleNames[lastDamageSource] || lastDamageSource}」规则抹除`
        : '在数据洪流中彻底消散';
    document.getElementById('finalTime').textContent = Math.floor(survivalTime);
    document.getElementById('finalWave').textContent = wave;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLvl').textContent = playerLevel;
    document.getElementById('finalKills').textContent = totalKills;
    document.getElementById('gameOverScreen').classList.add('active');
    document.getElementById('gameContainer').classList.remove('rule-active');
}

function updateHUD() {
    document.getElementById('hpValue').textContent = Math.ceil(player.hp);
    document.getElementById('hpBar').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('hpBar').className = playerShield > 0 ? 'hp-fill shield' : 'hp-fill';
    document.getElementById('xpBar').style.width = `${(playerXP / playerXPToNext) * 100}%`;
    document.getElementById('lvlValue').textContent = playerLevel;
    document.getElementById('waveValue').textContent = wave;
    document.getElementById('scoreValue').textContent = score;
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

function checkAchievements() {
    if (totalKills >= 1 && !achievements.first_blood.unlocked) {
        achievements.first_blood.unlocked = true;
        showAchievement(achievements.first_blood.name, achievements.first_blood.desc);
    }
    if (wave >= 5 && !achievements.wave_5.unlocked) {
        achievements.wave_5.unlocked = true;
        showAchievement(achievements.wave_5.name, achievements.wave_5.desc);
    }
    if (wave >= 10 && !achievements.wave_10.unlocked) {
        achievements.wave_10.unlocked = true;
        showAchievement(achievements.wave_10.name, achievements.wave_10.desc);
    }
    if (comboCount >= 20 && !achievements.combo_20.unlocked) {
        achievements.combo_20.unlocked = true;
        showAchievement(achievements.combo_20.name, achievements.combo_20.desc);
    }
    if (playerLevel >= 10 && !achievements.upgrade_master.unlocked) {
        achievements.upgrade_master.unlocked = true;
        showAchievement(achievements.upgrade_master.name, achievements.upgrade_master.desc);
    }
}

// ==================== SPAWNING ====================

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
        case 0: x = Math.random() * 960; y = -20; break;
        case 1: x = 980; y = Math.random() * 540; break;
        case 2: x = Math.random() * 960; y = 560; break;
        case 3: x = -20; y = Math.random() * 540; break;
    }
    const types = ['normal', 'normal', 'normal', 'fast', 'fast'];
    if (wave >= 4) types.push('tank');
    if (wave >= 7) types.push('tank', 'elite', 'fast');
    if (wave >= 10) types.push('elite');
    const type = types[Math.floor(Math.random() * types.length)];

    const frenzyMult = enemyFrenzy ? 1.5 : 1;
    let enemy = {
        x, y, radius: 14,
        speed: (1.5 + wave * 0.16) * frenzyMult,
        hp: 20 + wave * 5,
        maxHp: 20 + wave * 5,
        damage: 10, type,
        invisible: false, revealTimer: 0,
        color: '#e74c3c'
    };
    switch (type) {
        case 'fast':
            enemy.speed *= 1.8; enemy.hp *= 0.55; enemy.maxHp = enemy.hp;
            enemy.radius = 10; enemy.color = '#f39c12'; enemy.damage = 6;
            break;
        case 'tank':
            enemy.speed *= 0.5; enemy.hp *= 3.2; enemy.maxHp = enemy.hp;
            enemy.radius = 21; enemy.color = '#c0392b'; enemy.damage = 20;
            break;
        case 'elite':
            enemy.speed *= 1.25; enemy.hp *= 2.2; enemy.maxHp = enemy.hp;
            enemy.radius = 16; enemy.color = '#e91e63'; enemy.damage = 15;
            break;
    }
    enemies.push(enemy);
}

function spawnBoss() {
    bossActive = true;
    const boss = {
        x: 480, y: -45, radius: 35,
        speed: 0.85 + wave * 0.07,
        hp: 200 + wave * 55, maxHp: 200 + wave * 55,
        damage: 28, type: 'boss',
        invisible: false, revealTimer: 0,
        color: '#ff1744', bossTimer: 0
    };
    enemies.push(boss);
    SFX.bossAppear();
    spawnParticles(boss.x, boss.y, '#ff1744', 50, 10, 60);
    screenShake = 30;
}

// ==================== SHOOTING ====================

function shoot() {
    if (playerFireCooldown > 0) return;
    const w = weapons[player.currentWeapon];
    let cd = Math.max(3, Math.floor(w.cooldown * (playerFireRate / 14)));
    if (overclockActive) cd = Math.max(1, Math.floor(cd * 0.4));
    playerFireCooldown = cd;

    for (let i = 0; i < w.count; i++) {
        const spreadAngle = w.count > 1
            ? (i - (w.count - 1) / 2) * w.spread
            : (Math.random() - 0.5) * w.spread;
        const angle = player.angle + spreadAngle;
        const dmg = w.damage * playerDamageMult * globalDmgMult;
        const isCrit = playerCritChance && Math.random() < playerCritChance;
        bullets.push({
            x: player.x + Math.cos(angle) * 16,
            y: player.y + Math.sin(angle) * 16,
            vx: Math.cos(angle) * w.speed,
            vy: Math.sin(angle) * w.speed,
            radius: w.radius,
            damage: isCrit ? dmg * 3 : dmg,
            bounces: 0, color: w.color,
            pierce: w.pierce, pierced: [],
            isEnemyBullet: false,
            isCrit
        });
    }

    // Weapon-specific SFX
    if (player.currentWeapon === 0) SFX.shoot();
    else if (player.currentWeapon === 1) SFX.shootSpread();
    else if (player.currentWeapon === 2) SFX.shootRapid();
    else SFX.shootPierce();

    if (activeRule && activeRule.onShoot) activeRule.onShoot();
    if (activeRule2 && activeRule2.onShoot) activeRule2.onShoot();
}

// ==================== MAIN UPDATE ====================

function update() {
    if (state === GameState.MENU || state === GameState.GAME_OVER) return;

    if (state === GameState.UPGRADE) {
        upgradeTimeout--;
        if (upgradeTimeout <= 0 && showingUpgrade) {
            selectUpgrade(Math.floor(Math.random() * upgradeOptions.length));
        }
        if (playerFireCooldown > 0) playerFireCooldown--;
        if (playerInvincible > 0) playerInvincible--;
        return;
    }

    frameCount++;
    survivalTime += 1 / 60 * timeScale;

    if (playerFireCooldown > 0) playerFireCooldown--;
    if (playerInvincible > 0) playerInvincible--;

    // Screen shake decay
    if (screenShake > 0) { screenShake *= 0.88; if (screenShake < 0.3) screenShake = 0; }
    screenShakeX = (Math.random() - 0.5) * screenShake * 2;
    screenShakeY = (Math.random() - 0.5) * screenShake * 2;

    // Combo decay
    if (comboTimer > 0) { comboTimer--; }
    else { comboCount = 0; document.getElementById('comboBlock').style.opacity = '0'; }

    // Regen
    if (playerRegen > 0 && frameCount % 30 === 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + playerRegen);
        updateHUD();
    }

    // ==================== RULE CYCLE ====================
    cycleTimer++;
    if (cyclePhase === 'normal' && cycleTimer >= 10 * 60) {
        cyclePhase = 'warning';
        cycleTimer = 0;
        state = GameState.WARNING;
        document.getElementById('ruleWarning').textContent = '⚠ RULE ANOMALY ⚠';
        document.getElementById('ruleName').textContent = '规则突变即将发生...';
        document.getElementById('ruleDescSmall').textContent = '';
        document.getElementById('ruleDisplay').classList.add('active');
        document.getElementById('glitchOverlay').classList.add('active');
        SFX.ruleChange();
    } else if (cyclePhase === 'warning' && cycleTimer >= warningDuration) {
        cyclePhase = 'active';
        cycleTimer = 0;
        state = GameState.RULE_ACTIVE;
        const candidates = RULES.filter(r => r.id !== (activeRule?.id));
        const rule1 = candidates[Math.floor(Math.random() * candidates.length)];
        applyRule(rule1);
        activeRule = rule1;
        activeRule2 = null;
        canStackRules = wave >= 6;
        if (canStackRules && Math.random() < 0.4) {
            const remaining = candidates.filter(r => r.id !== rule1.id);
            const rule2 = remaining[Math.floor(Math.random() * remaining.length)];
            applyRule(rule2);
            activeRule2 = rule2;
        }
        document.getElementById('ruleWarning').textContent = 'RULE ACTIVE';
        document.getElementById('ruleName').textContent = activeRule2
            ? `${rule1.name} + ${activeRule2.name}` : rule1.name;
        document.getElementById('ruleDescSmall').textContent = activeRule2
            ? `${rule1.desc} | ${activeRule2.desc}` : rule1.desc;
        document.getElementById('ruleTimer').style.display = 'block';
        document.getElementById('ruleTimer').classList.add('active');
        const sig = document.getElementById('ruleSignature');
        sig.textContent = activeRule2 ? '!!' : rule1.signature;
        sig.className = `rule-signature active sig-${rule1.category}`;
        document.getElementById('gameContainer').classList.add('rule-active');
        document.getElementById('glitchOverlay').classList.remove('active');
        document.getElementById('ruleDisplay').classList.remove('active');
        screenShake = 15;
    } else if (cyclePhase === 'active' && cycleTimer >= ruleDuration) {
        cyclePhase = 'normal';
        cycleTimer = 0;
        state = GameState.PLAYING;
        removeRule(activeRule);
        removeRule(activeRule2);
        activeRule = null;
        activeRule2 = null;
        document.getElementById('ruleDisplay').classList.remove('active');
        document.getElementById('ruleTimer').style.display = 'none';
        document.getElementById('ruleTimer').classList.remove('active');
        document.getElementById('ruleSignature').className = 'rule-signature';
        document.getElementById('gameContainer').classList.remove('rule-active');
        wave++;
        score += 100;
        updateHUD();
        if (wave % 5 === 0 && !bossActive) spawnBoss();
    }
    if (cyclePhase === 'active') {
        const remaining = 1 - (cycleTimer / ruleDuration);
        document.getElementById('ruleTimerBar').style.width = `${remaining * 100}%`;
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

    if (entropyBoost > 0) {
        player.vx *= (1 + entropyBoost * 0.015);
        player.vy *= (1 + entropyBoost * 0.015);
    }

    player.x += player.vx * timeScale;
    player.y += player.vy * timeScale;

    if (!ghostMode) {
        player.x = Math.max(player.radius, Math.min(960 - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(540 - player.radius, player.y));
        for (const w of walls) {
            if (rectCircleCollision(w, player)) {
                player.x -= player.vx * timeScale;
                player.y -= player.vy * timeScale;
                player.vx *= -0.3;
                player.vy *= -0.3;
            }
        }
    } else {
        if (player.x < -30) player.x = 990;
        if (player.x > 990) player.x = -30;
        if (player.y < -30) player.y = 570;
        if (player.y > 570) player.y = -30;
    }

    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // ==================== CLONES ====================
    for (let i = player.clones.length - 1; i >= 0; i--) {
        player.clones[i].life--;
        if (player.clones[i].life <= 0) player.clones.splice(i, 1);
    }

    // ==================== MOBILE SHOOTING ====================
    if (isMobile && mobileShooting && playerFireCooldown <= 0 &&
        (state === GameState.PLAYING || state === GameState.RULE_ACTIVE)) {
        shoot();
    }

    // ==================== ENEMY SPAWNING ====================
    const spawnRate = Math.max(22, 100 - wave * 5);
    if (frameCount % spawnRate === 0 && !bossActive) spawnEnemy();

    // ==================== UPDATE ENEMIES ====================
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const edx = player.x - e.x, edy = player.y - e.y;
        const edist = Math.sqrt(edx * edx + edy * edy);

        if (edist > 0) {
            let spd = e.speed * (entropyBoost > 0 ? (1 + entropyBoost * 0.8) : 1);
            if (repulsionField && edist < 100) spd *= 0.5;
            e.x += (edx / edist) * spd * timeScale;
            e.y += (edy / edist) * spd * timeScale;
        }

        // Invisibility
        if (enemyInvisible) {
            e.invisible = true;
            if (edist < 85) { e.invisible = false; e.revealTimer = 25; }
            if (e.revealTimer > 0) { e.revealTimer--; e.invisible = false; }
        } else { e.invisible = false; }

        // Boss AI
        if (e.type === 'boss') {
            e.bossTimer++;
            if (e.bossTimer > 90 && e.bossTimer < 100) {
                const ba = Math.atan2(player.y - e.y, player.x - e.x);
                for (let b = 0; b < 8; b++) {
                    bullets.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(ba + b * 0.79 - 2.75) * 3.8,
                        vy: Math.sin(ba + b * 0.79 - 2.75) * 3.8,
                        radius: 5, damage: 14, bounces: 0,
                        color: '#ff5252', pierce: false, pierced: [],
                        isEnemyBullet: true
                    });
                }
                e.bossTimer = 0;
            }
        }

        // Player collision
        if (edist < player.radius + e.radius && playerInvincible <= 0 && !ghostMode) {
            damagePlayer(e.damage, activeRule ? activeRule.id : 'enemy');
            if (e.type !== 'boss') { enemies.splice(i, 1); continue; }
        }

        // Wall collision
        if (!ghostMode) {
            for (const w of walls) {
                if (e.x > w.x - w.width / 2 && e.x < w.x + w.width / 2 &&
                    e.y > w.y - w.height / 2 && e.y < w.y + w.height / 2) {
                    e.x -= (edx / edist) * e.speed * timeScale;
                    e.y -= (edy / edist) * e.speed * timeScale;
                }
            }
        }

        // Off-screen cleanup (with margin)
        if (e.x < -60 || e.x > 1020 || e.y < -60 || e.y > 600) {
            if (e.type === 'boss') { enemies.splice(i, 1); bossActive = false; }
        }
    }

    // ==================== UPDATE BULLETS ====================
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;

        // Bounce
        if (bulletBounce && !b.isEnemyBullet) {
            if (b.x < 0 || b.x > 960) { b.vx *= -1; b.bounces++; b.x = Math.max(0, Math.min(960, b.x)); }
            if (b.y < 0 || b.y > 540) { b.vy *= -1; b.bounces++; b.y = Math.max(0, Math.min(540, b.y)); }
            if (b.bounces > 5) { bullets.splice(i, 1); continue; }
        } else {
            if (b.x < -30 || b.x > 990 || b.y < -30 || b.y > 570) { bullets.splice(i, 1); continue; }
        }

        // Enemy bullet hitting player
        if (b.isEnemyBullet && playerInvincible <= 0 && !ghostMode) {
            const bdx = b.x - player.x, bdy = b.y - player.y;
            if (Math.sqrt(bdx * bdx + bdy * bdy) < player.radius + b.radius) {
                damagePlayer(b.damage, 'enemy_bullet');
                bullets.splice(i, 1);
                continue;
            }
        }

        // Player bullet hitting enemies
        if (!b.isEnemyBullet) {
            // Wall collision
            let hitWall = false;
            for (const w of walls) {
                if (b.x > w.x - w.width / 2 && b.x < w.x + w.width / 2 &&
                    b.y > w.y - w.height / 2 && b.y < w.y + w.height / 2) {
                    if (!b.pierce) { bullets.splice(i, 1); hitWall = true; break; }
                }
            }
            if (hitWall) continue;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (b.pierce && b.pierced && b.pierced.includes(j)) continue;
                const bdx = b.x - e.x, bdy = b.y - e.y;
                if (Math.sqrt(bdx * bdx + bdy * bdy) < b.radius + e.radius) {
                    let dmg = b.damage;
                    if (b.isCrit) dmg *= 3;
                    e.hp -= dmg;
                    SFX.hit();
                    spawnParticles(b.x, b.y, '#fff', 3, 2, 10);

                    if (chainLightning) {
                        let nearest = null;
                        let nearestDist = 120;
                        for (let k = 0; k < enemies.length; k++) {
                            if (k === j) continue;
                            const ldx = enemies[k].x - e.x, ldy = enemies[k].y - e.y;
                            const ldist = Math.sqrt(ldx * ldx + ldy * ldy);
                            if (ldist < nearestDist) { nearest = enemies[k]; nearestDist = ldist; }
                        }
                        if (nearest) {
                            nearest.hp -= dmg * 0.4;
                            spawnLineParticles(e.x, e.y, nearest.x, nearest.y, '#9b59b6', 3);
                        }
                    }

                    if (explosiveRounds) {
                        for (const ne of enemies) {
                            const exd = Math.sqrt((ne.x - e.x) ** 2 + (ne.y - e.y) ** 2);
                            if (exd < 60 && ne !== e) ne.hp -= dmg * 0.3;
                        }
                        spawnParticles(e.x, e.y, '#f39c12', 8, 3, 15);
                        screenShake = Math.max(screenShake, 3);
                    }

                    if (b.pierce) { b.pierced.push(j); }
                    else { bullets.splice(i, 1); }

                    if (e.hp <= 0) {
                        score += e.type === 'boss' ? 150 : (e.type === 'elite' ? 35 : 12);
                        totalKills++;
                        comboCount++;
                        comboTimer = 100;
                        document.getElementById('comboBlock').style.opacity = '1';
                        document.getElementById('comboValue').textContent = 'x' + comboCount;
                        if (comboCount >= 10) score += comboCount * 2;

                        if (e.type === 'boss') {
                            SFX.bossDie();
                            bossActive = false;
                            score += 250;
                            addXP(70);
                            if (!achievements.boss_slayer.unlocked) {
                                achievements.boss_slayer.unlocked = true;
                                showAchievement(achievements.boss_slayer.name, achievements.boss_slayer.desc);
                            }
                            for (let d = 0; d < 6; d++) {
                                pickups.push({
                                    x: e.x + (Math.random() - 0.5) * 70,
                                    y: e.y + (Math.random() - 0.5) * 70,
                                    type: Math.random() < 0.5 ? 'health' : 'shield', life: 450
                                });
                            }
                            spawnParticles(e.x, e.y, '#ffd700', 60, 12, 60);
                            screenShake = 35;
                        } else {
                            SFX.enemyDie();
                            addXP(e.type === 'elite' ? 18 : 6);
                            if (Math.random() < 0.2) {
                                pickups.push({ x: e.x, y: e.y, type: Math.random() < 0.55 ? 'health' : 'shield', life: 380 });
                            }
                        }
                        spawnParticles(e.x, e.y, e.color, 18, 5, 30);
                        if (activeRule && activeRule.onEnemyDeath) activeRule.onEnemyDeath(e);
                        if (activeRule2 && activeRule2.onEnemyDeath) activeRule2.onEnemyDeath(e);
                        enemies.splice(j, 1);
                    }

                    if (!b.pierce) break;
                    if (b.pierce && b.pierced.length >= 5) { bullets.splice(i, 1); break; }
                }
            }
        }
    }

    // ==================== UPDATE WALLS ====================
    for (let i = walls.length - 1; i >= 0; i--) {
        walls[i].life--;
        if (walls[i].life <= 0) walls.splice(i, 1);
    }

    // ==================== UPDATE PICKUPS ====================
    for (let i = pickups.length - 1; i >= 0; i--) {
        pickups[i].life--;
        if (pickups[i].life <= 0) { pickups.splice(i, 1); continue; }
        const pdx = player.x - pickups[i].x, pdy = player.y - pickups[i].y;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < player.radius + 16) {
            if (pickups[i].type === 'health') {
                player.hp = Math.min(player.maxHp, player.hp + 22);
                spawnParticles(pickups[i].x, pickups[i].y, '#2ecc71', 8, 3, 20);
            } else {
                playerShield += 18;
                spawnParticles(pickups[i].x, pickups[i].y, '#3498db', 8, 3, 20);
            }
            SFX.pickup();
            pickups.splice(i, 1);
            updateHUD();
        }
    }

    // ==================== UPDATE PARTICLES ====================
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        if (p.vx !== undefined) { p.vx *= 0.97; p.vy *= 0.97; }
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // ==================== RULE UPDATES ====================
    if (activeRule && activeRule.update) activeRule.update();
    if (activeRule2 && activeRule2.update) activeRule2.update();

    checkAchievements();
    updateHUD();
}

function rectCircleCollision(rect, circle) {
    const closestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
    const closestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

function initGame() {
    // Reset player
    player.x = 480; player.y = 270;
    player.hp = 100; player.maxHp = 100;
    player.vx = 0; player.vy = 0;
    player.clones = [];
    player.currentWeapon = 0;
    player.speed = 4;

    // Reset game state
    bullets = []; enemies = []; particles = []; walls = []; pickups = [];
    bossActive = false;
    score = 0; wave = 1; survivalTime = 0; totalKills = 0;
    comboCount = 0; comboTimer = 0;
    frameCount = 0;
    screenShake = 0;
    playerInvincible = 0;
    playerFireCooldown = 0;
    lastDamageSource = '';

    // Reset rules
    resetAllRules();
    cyclePhase = 'normal';
    cycleTimer = 0;

    // Reset upgrades
    resetUpgrades();

    // Reset UI
    document.getElementById('ruleDisplay').classList.remove('active');
    document.getElementById('ruleTimer').style.display = 'none';
    document.getElementById('ruleTimer').classList.remove('active');
    document.getElementById('ruleSignature').className = 'rule-signature';
    document.getElementById('glitchOverlay').classList.remove('active');
    document.getElementById('gameContainer').classList.remove('rule-active');
    document.getElementById('gameOverScreen').classList.remove('active');
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('comboBlock').style.opacity = '0';
    document.getElementById('upgradePopup').classList.remove('active');
    document.getElementById('upgradePopup').innerHTML = '';
    updateHUD();
    updateWeaponHUD();
}
