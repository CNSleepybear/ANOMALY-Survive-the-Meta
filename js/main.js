// ==================== MAIN ENTRY ====================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');

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
    update();
    render();

    // Performance HUD
    if (frameCount % 30 === 0) {
        const perfEl = document.getElementById('perfHud');
        if (perfEl) {
            const eCount = enemies.length;
            const bCount = bullets.length;
            const pCount = particles.length;
            perfEl.innerHTML = `FPS: <span>${fps}</span> | E: <span>${eCount}</span> | B: <span>${bCount}</span> | P: <span>${pCount}</span>`;
        }
    }

    requestAnimationFrame(gameLoop);
}

// ==================== INPUT HANDLING ====================

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key.toLowerCase() === 'shift') {
        autoFireEnabled = !autoFireEnabled;
        // 可选：给个视觉反馈
        showAchievement(autoFireEnabled ? '自动射击: ON' : '自动射击: OFF', 
            autoFireEnabled ? '系统将自动开火' : '恢复手动控制');
    }

    // Upgrade selection
    if (state === GameState.UPGRADE && showingUpgrade) {
        if (e.key === '1') selectUpgrade(0);
        if (e.key === '2') selectUpgrade(1);
        if (e.key === '3') selectUpgrade(2);
    }

    // Weapon switching
    if (e.key >= '1' && e.key <= '4' && state !== GameState.UPGRADE) {
        player.currentWeapon = parseInt(e.key) - 1;
        updateWeaponHUD();
    }

    // Q/E weapon switch
    if (!isMobile && state !== GameState.UPGRADE) {
        if (e.key.toLowerCase() === 'q') {
            player.currentWeapon = (player.currentWeapon + 3) % 4;
            updateWeaponHUD();
        }
        if (e.key.toLowerCase() === 'e') {
            player.currentWeapon = (player.currentWeapon + 1) % 4;
            updateWeaponHUD();
        }
    }

    // Overclock toggle
    if (e.key.toLowerCase() === 'f' && overclockUnlocked && state !== GameState.UPGRADE) {
        overclockActive = !overclockActive;
        if (overclockActive) SFX.overclock();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    initAudio();
    startBGM();
    mouse.down = true;
    if (state === GameState.PLAYING || state === GameState.RULE_ACTIVE) shoot();
});

canvas.addEventListener('mouseup', () => { mouse.down = false; });

canvas.addEventListener('wheel', (e) => {
    if (state === GameState.UPGRADE) return;
    e.preventDefault();
    if (e.deltaY > 0) player.currentWeapon = (player.currentWeapon + 1) % 4;
    else player.currentWeapon = (player.currentWeapon + 3) % 4;
    updateWeaponHUD();
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Continuous shooting (desktop mouse hold)
setInterval(() => {
    if (state !== GameState.PLAYING && state !== GameState.RULE_ACTIVE) return;
    if (playerFireCooldown > 0) return;
    
    // 条件1：按住鼠标（手动）
    // 条件2：Toggle 自动射击开启
    const shouldShoot = (!isMobile && mouse.down) || autoFireEnabled;
    
    if (shouldShoot) {
        shoot();
    }
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
    e.preventDefault();
    initAudio();
    startBGM();
    joystickActive = true;
    updateJoystick(e.touches[0]);
}, { passive: false });

joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updateJoystick(e.touches[0]);
}, { passive: false });

joystickZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    joystickActive = false;
    joystickDX = 0;
    joystickDY = 0;
    joystickThumb.style.transform = 'translate(-50%,-50%)';
}, { passive: false });

function updateJoystick(touch) {
    const rect = joystickZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 22;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
    joystickDX = dx / maxR;
    joystickDY = dy / maxR;
    joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

mobileShootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    startBGM();
    mobileShooting = true;
    if ((state === GameState.PLAYING || state === GameState.RULE_ACTIVE) && playerFireCooldown <= 0) shoot();
}, { passive: false });

mobileShootBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    mobileShooting = false;
}, { passive: false });

mobileSwitchBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    player.currentWeapon = (player.currentWeapon + 1) % 4;
    updateWeaponHUD();
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

document.getElementById('startBtn').addEventListener('click', () => {
    initAudio();
    startBGM();
    document.getElementById('startScreen').style.display = 'none';
    initGame();
    initRenderer();
    state = GameState.PLAYING;
    updateHUD();
    updateWeaponHUD();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    initAudio();
    startBGM();
    initGame();
    initRenderer();
    state = GameState.PLAYING;
    updateHUD();
    updateWeaponHUD();
});

// Weapon slot clicks
document.querySelectorAll('.weapon-slot').forEach(slot => {
    slot.addEventListener('click', () => {
        if (state !== GameState.UPGRADE) {
            player.currentWeapon = parseInt(slot.dataset.w);
            updateWeaponHUD();
        }
    });
});

// ==================== INIT ====================

initRenderer();
updateHUD();
updateWeaponHUD();
gameLoop();

console.log('%c[ANOMALY] System initialized', 'color: #00ff66; font-family: monospace; font-size: 14px;');
console.log('%c▶ Weapons: 1-4 | Q/E | MouseWheel', 'color: #00aa44; font-family: monospace;');
console.log('%c▶ 25+ Rules | Boss Battles | Upgrade System', 'color: #00aa44; font-family: monospace;');
console.log('%c▶ Mobile: Virtual joystick auto-detected', 'color: #00aa44; font-family: monospace;');
