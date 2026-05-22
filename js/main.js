// ==================== MAIN ENTRY ====================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');
window.addEventListener('blur', () => { mouse.down = false; });

// FPS tracking
let lastTime = 0;
let fps = 60;
let frameTimes = [];

function trackFPS(timestamp) {
    if (lastTime) {
        const dt = timestamp - lastTime;
        frameTimes.push(dt);
        if (frameTimes.length > 30) frameTimes.shift();
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        fps = Math.round(1000 / avg);
    }
    lastTime = timestamp;
}

// ==================== GAME LOOP ====================

function gameLoop(timestamp) {
    trackFPS(timestamp);
    try {
        update();
        render();
    } catch (e) {
        console.error('[ANOMALY] Game loop error:', e);
    }
    if (frameCount % 30 === 0) {
        const perfEl = document.getElementById('perfHud');
        if (perfEl) {
            perfEl.innerHTML = `FPS: <span>${fps}</span> | E: <span>${enemies.length}</span> | B: <span>${bullets.length}</span> | P: <span>${particles.length}</span>`;
        }
    }
    requestAnimationFrame(gameLoop);
}

// ==================== INPUT HANDLING ====================

const gameContainer = document.getElementById('gameContainer');

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key.toLowerCase() === 'shift') {
        autoFireEnabled = !autoFireEnabled;
        gameSettings.autoFire = autoFireEnabled;
        const cb = document.getElementById('settingAutoFire');
        if (cb) cb.checked = autoFireEnabled;
        showAchievement(autoFireEnabled ? '自动射击: ON' : '自动射击: OFF',
            autoFireEnabled ? '系统将自动开火' : '恢复手动控制');
    }

    if (state === GameState.PLAYING || state === GameState.RULE_ACTIVE) {
        if (e.key.toLowerCase() === 'z') activateSkill(0);
        if (e.key.toLowerCase() === 'x') activateSkill(1);
        if (e.key.toLowerCase() === 'c') activateSkill(2);
        if (e.key.toLowerCase() === 'v') activateSkill(3);
    }

    if (e.key.toLowerCase() === 'r' && timeRewind && positionHistory.length > 0) {
        const past = positionHistory[0];
        player.x = past.x; player.y = past.y;
        playerInvincible = 60;
        spawnParticles(player.x, player.y, '#9b59b6', 30);
        screenShake = 15; SFX.upgrade();
    }

    if (state === GameState.UPGRADE && showingUpgrade) {
        if (e.key === '1') selectUpgrade(0);
        if (e.key === '2') selectUpgrade(1);
        if (e.key === '3') selectUpgrade(2);
    }

    if (e.key >= '1' && e.key <= '4' && state !== GameState.UPGRADE) {
        player.currentWeapon = parseInt(e.key) - 1;
        updateWeaponHUD();
    }

    if (!isMobile && state !== GameState.UPGRADE) {
        if (e.key.toLowerCase() === 'q') { player.currentWeapon = (player.currentWeapon + 3) % 4; updateWeaponHUD(); }
        if (e.key.toLowerCase() === 'e') { player.currentWeapon = (player.currentWeapon + 1) % 4; updateWeaponHUD(); }
    }

    if (e.key.toLowerCase() === 'f' && overclockUnlocked && state !== GameState.UPGRADE) {
        overclockActive = !overclockActive;
        if (overclockActive) SFX.overclock();
    }
});

document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// 鼠标事件绑到 gameContainer，防止被 uiLayer 遮挡
gameContainer.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});

gameContainer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // 如果点击的是按钮/面板/弹窗，不触发射击和音频
    if (e.target.closest('.btn, .settings-panel, .settings-btn, .meta-panel, .upgrade-option, .difficulty-btn')) return;
    initAudio(); startBGM();
    mouse.down = true;
    if (state === GameState.PLAYING || state === GameState.RULE_ACTIVE) shoot();
});

gameContainer.addEventListener('mouseup', () => { mouse.down = false; });

gameContainer.addEventListener('wheel', (e) => {
    if (state === GameState.UPGRADE) return;
    e.preventDefault();
    if (e.deltaY > 0) player.currentWeapon = (player.currentWeapon + 1) % 4;
    else player.currentWeapon = (player.currentWeapon + 3) % 4;
    updateWeaponHUD();
}, { passive: false });

gameContainer.addEventListener('contextmenu', (e) => e.preventDefault());

// 防御：窗口失去焦点时清鼠标状态
window.addEventListener('blur', () => { mouse.down = false; });

// Continuous shooting
setInterval(() => {
    if (state !== GameState.PLAYING && state !== GameState.RULE_ACTIVE) return;
    if (playerFireCooldown > 0) return;
    const shouldShoot = (!isMobile && mouse.down) || autoFireEnabled;
    if (shouldShoot) shoot();
}, 30);

// ==================== MOBILE CONTROLS ====================

function detectMobile() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
}

isMobile = detectMobile();
if (isMobile) document.getElementById('mobileControls').style.display = 'block';

const joystickZone = document.getElementById('joystickZone');
const joystickThumb = document.getElementById('joystickThumb');
const mobileShootBtn = document.getElementById('mobileShootBtn');
const mobileSwitchBtn = document.getElementById('mobileSwitchBtn');

joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault(); initAudio(); startBGM();
    joystickActive = true; updateJoystick(e.touches[0]);
}, { passive: false });
joystickZone.addEventListener('touchmove', (e) => { e.preventDefault(); updateJoystick(e.touches[0]); }, { passive: false });
joystickZone.addEventListener('touchend', (e) => {
    e.preventDefault(); joystickActive = false; joystickDX = 0; joystickDY = 0;
    joystickThumb.style.transform = 'translate(-50%,-50%)';
}, { passive: false });

function updateJoystick(touch) {
    const rect = joystickZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 22;
    let dx = touch.clientX - cx, dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
    joystickDX = dx / maxR; joystickDY = dy / maxR;
    joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

mobileShootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); initAudio(); startBGM(); mobileShooting = true;
    if ((state === GameState.PLAYING || state === GameState.RULE_ACTIVE) && playerFireCooldown <= 0) shoot();
}, { passive: false });
mobileShootBtn.addEventListener('touchend', (e) => { e.preventDefault(); mobileShooting = false; }, { passive: false });
mobileSwitchBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); player.currentWeapon = (player.currentWeapon + 1) % 4; updateWeaponHUD();
}, { passive: false });

window.addEventListener('resize', () => {
    isMobile = detectMobile();
    const mc = document.getElementById('mobileControls');
    if (mc) mc.style.display = isMobile ? 'block' : 'none';
});

document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#gameContainer')) e.preventDefault();
}, { passive: false });

// ==================== BUTTON HANDLERS ====================

// ==================== BUTTON HANDLERS ====================

// 难度按钮：只负责高亮
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

// 开始界面 → 难度选择
document.getElementById('difficultySelectBtn').addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('difficultyScreen').classList.add('active');
});

// 难度界面 → 返回开始界面（保存难度）
document.getElementById('difficultyConfirmBtn').addEventListener('click', () => {
    const selected = document.querySelector('.difficulty-btn.selected');
    if (selected) setDifficulty(selected.dataset.diff);
    document.getElementById('difficultyScreen').classList.remove('active');
    document.getElementById('startScreen').style.display = 'flex';
});

// 难度界面 → 直接返回（不保存）
document.getElementById('difficultyBackBtn').addEventListener('click', () => {
    document.getElementById('difficultyScreen').classList.remove('active');
    document.getElementById('startScreen').style.display = 'flex';
});

// 开始游戏
document.getElementById('startBtn').addEventListener('click', () => {
    initAudio(); startBGM();
    document.getElementById('startScreen').style.display = 'none';
    initGame(); initRenderer();
    state = GameState.PLAYING;
    updateHUD(); updateWeaponHUD();
});

// 死亡后 → 回到开始界面（而不是直接重开）
document.getElementById('restartBtn').addEventListener('click', () => {
    initAudio(); startBGM();
    document.getElementById('gameOverScreen').classList.remove('active');
    document.getElementById('startScreen').style.display = 'flex';
    mouse.down = false;          // 清掉鼠标按下状态，防止进菜单自动开火
    state = GameState.MENU;
});

document.querySelectorAll('.weapon-slot').forEach(slot => {
    slot.addEventListener('click', () => {
        if (state !== GameState.UPGRADE) {
            player.currentWeapon = parseInt(slot.dataset.w);
            updateWeaponHUD();
        }
    });
});

// Meta Progress buttons
document.getElementById('metaBtn').addEventListener('click', () => {
    const panel = document.getElementById('metaPanel');
    renderMetaPanel();
    panel.classList.add('active');
    panel.parentElement.appendChild(panel);
});
document.getElementById('metaBtnGameOver').addEventListener('click', () => {
    const panel = document.getElementById('metaPanel');
    renderMetaPanel();
    panel.classList.add('active');
    panel.parentElement.appendChild(panel);
});
document.getElementById('metaCloseBtn').addEventListener('click', () => {
    document.getElementById('metaPanel').classList.remove('active');
});

// ==================== INIT ====================

initRenderer();
updateHUD();
updateWeaponHUD();
gameLoop();

console.log('%c[ANOMALY] System initialized', 'color: #00ff66; font-family: monospace; font-size: 14px;');
console.log('%c▶ 54 Rules | 7 Bosses | 26 Events | Elite System | Meta Progress', 'color: #00aa44; font-family: monospace;');
console.log('%c▶ Mobile: Virtual joystick auto-detected', 'color: #00aa44; font-family: monospace;');

// ==================== SETTINGS SYSTEM ====================

const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingsClose = document.getElementById('settingsClose');

function toggleSettings(show) {
    if (show) {
        settingsPanel.classList.add('active');
    } else {
        settingsPanel.classList.remove('active');
    }
}

settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();          // 防止冒泡到 document 被立即关掉
    toggleSettings(true);
});
settingsClose.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings(false);
});

// 点击面板外部关闭
document.addEventListener('click', (e) => {
    if (!settingsPanel.classList.contains('active')) return;
    if (settingsPanel.contains(e.target)) return;
    if (e.target === settingsBtn || settingsBtn.contains(e.target)) return;
    toggleSettings(false);
});

document.getElementById('settingStressTest').addEventListener('change', (e) => {
    gameSettings.stressTest = e.target.checked;
    document.getElementById('stressStats').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) showAchievement('STRESS TEST', 'High-density enemy spawn activated');
});

document.getElementById('settingSpawnMult').addEventListener('input', (e) => {
    gameSettings.spawnMult = parseInt(e.target.value);
    document.getElementById('spawnMultVal').textContent = e.target.value + 'x';
});

document.getElementById('settingMaxEnemies').addEventListener('input', (e) => {
    gameSettings.maxEnemies = parseInt(e.target.value);
    document.getElementById('maxEnemiesVal').textContent = e.target.value;
});

document.getElementById('settingGodMode').addEventListener('change', (e) => { gameSettings.godMode = e.target.checked; });

document.getElementById('settingAutoFire').addEventListener('change', (e) => {
    gameSettings.autoFire = e.target.checked; autoFireEnabled = e.target.checked;
});

document.getElementById('settingPerfHud').addEventListener('change', (e) => {
    gameSettings.showPerf = e.target.checked;
    document.getElementById('perfHud').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('settingTimeScale').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    gameSettings.timeScaleOverride = val;
    document.getElementById('timeScaleVal').textContent = val.toFixed(1);
    if (cyclePhase !== 'active') timeScale = val;
});

function syncSettingsToUI() {
    document.getElementById('settingStressTest').checked = gameSettings.stressTest;
    document.getElementById('settingSpawnMult').value = gameSettings.spawnMult;
    document.getElementById('spawnMultVal').textContent = gameSettings.spawnMult + 'x';
    document.getElementById('settingMaxEnemies').value = gameSettings.maxEnemies;
    document.getElementById('maxEnemiesVal').textContent = gameSettings.maxEnemies;
    document.getElementById('settingGodMode').checked = gameSettings.godMode;
    document.getElementById('settingAutoFire').checked = autoFireEnabled;
    document.getElementById('settingPerfHud').checked = gameSettings.showPerf;
    document.getElementById('perfHud').style.display = gameSettings.showPerf ? 'block' : 'none';
    document.getElementById('settingTimeScale').value = gameSettings.timeScaleOverride;
    document.getElementById('timeScaleVal').textContent = gameSettings.timeScaleOverride.toFixed(1);
    document.getElementById('stressStats').style.display = gameSettings.stressTest ? 'block' : 'none';
}

// Performance monitoring
const originalTrackFPS = trackFPS;
trackFPS = function(timestamp) {
    originalTrackFPS(timestamp);
    if (gameSettings.stressTest && frameCount % 10 === 0) {
        document.getElementById('targetSpawn').textContent = Math.round(60 * gameSettings.spawnMult / 2);
        document.getElementById('activeEnemies').textContent = enemies.length;
    }
};