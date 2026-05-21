// ==================== AUDIO ENGINE ====================
let audioCtx = null;
let bgmOsc = null;
let bgmGain = null;
let bgmPlaying = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, type, duration, vol = 0.08, glide = 0) {
    if (!audioCtx) return;
    try {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (glide) osc.frequency.linearRampToValueAtTime(freq * glide, t + duration);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + duration);
    } catch (e) { /* silent */ }
}

function playNoise(duration, vol = 0.05) {
    if (!audioCtx) return;
    try {
        const t = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * vol * (1 - i / bufferSize);
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start(t);
    } catch (e) { /* silent */ }
}

// ==================== SFX ====================
const SFX = {
    shoot() {
        playTone(900, 'square', 0.06, 0.05, 0.2);
        playTone(220, 'sawtooth', 0.04, 0.03);
    },
    shootSpread() {
        playTone(600, 'square', 0.08, 0.06, 0.5);
        playTone(150, 'sawtooth', 0.06, 0.05);
    },
    shootRapid() {
        playTone(1200, 'square', 0.04, 0.035, 1.5);
    },
    shootPierce() {
        playTone(400, 'sine', 0.12, 0.07, 3);
        playTone(200, 'triangle', 0.1, 0.05);
    },
    hit() {
        playTone(180, 'sawtooth', 0.08, 0.06);
        playTone(70, 'triangle', 0.1, 0.04);
    },
    enemyDie() {
        playTone(350, 'square', 0.07, 0.04, 2);
        playTone(120, 'triangle', 0.09, 0.05);
        playNoise(0.08, 0.03);
    },
    bossDie() {
        playTone(60, 'sawtooth', 0.4, 0.15, 0.1);
        playTone(200, 'square', 0.2, 0.08, 0.3);
        playNoise(0.3, 0.06);
    },
    ruleChange() {
        playTone(80, 'sawtooth', 0.15, 0.15, 3);
        playTone(500, 'square', 0.08, 0.08, 0.5);
        playTone(1200, 'triangle', 0.05, 0.05);
        playNoise(0.1, 0.02);
    },
    upgrade() {
        playTone(600, 'square', 0.06, 0.04, 2);
        playTone(900, 'square', 0.05, 0.03, 2);
        playTone(1400, 'triangle', 0.08, 0.05);
    },
    bossAppear() {
        playTone(50, 'sawtooth', 0.4, 0.35, 5);
        playTone(80, 'square', 0.25, 0.25, 4);
        playNoise(0.4, 0.05);
    },
    pickup() {
        playTone(550, 'triangle', 0.06, 0.035, 1.5);
        playTone(900, 'triangle', 0.05, 0.025, 1.5);
    },
    playerHit() {
        playTone(60, 'sawtooth', 0.2, 0.12, 0.3);
        playTone(35, 'square', 0.25, 0.15);
        playNoise(0.12, 0.04);
    },
    achievement() {
        playTone(523, 'sine', 0.1, 0.06);
        playTone(659, 'sine', 0.1, 0.06);
        playTone(784, 'sine', 0.12, 0.07);
        playTone(1047, 'sine', 0.15, 0.06);
    },
    overclock() {
        playTone(2000, 'square', 0.05, 0.04, 0.1);
        playNoise(0.15, 0.02);
    }
};

// ==================== DYNAMIC BGM ====================
let bgmInterval = null;
function startBGM() {
    if (bgmPlaying) return;
    bgmPlaying = true;
    const notes = [65.41, 73.42, 82.41, 98.00, 110.00, 130.81, 146.83];
    let noteIdx = 0;
    bgmInterval = setInterval(() => {
        if (!audioCtx || Math.random() < 0.4) return;
        const freq = notes[Math.floor(Math.random() * notes.length)];
        playTone(freq, 'sine', 0.3 + Math.random() * 0.4, 0.02 + Math.random() * 0.02);
        if (Math.random() < 0.15) {
            playTone(freq * 2, 'triangle', 0.2, 0.01);
        }
    }, 180);
}

function stopBGM() {
    bgmPlaying = false;
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}
