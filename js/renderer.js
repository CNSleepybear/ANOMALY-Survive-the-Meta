// ==================== RENDERER: MATRIX RAIN + CRT + ENTITIES ====================

const matrixCols = Math.floor(960 / 14);
const matrixDrops = Array(matrixCols).fill(0);
const matrixTrailChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

function initRenderer() {
    for (let i = 0; i < matrixCols; i++) {
        matrixDrops[i] = Math.random() * -540;
    }
}

function render() {
    // Clear with trail effect
    ctx.fillStyle = 'rgba(3, 3, 3, 0.18)';
    ctx.fillRect(0, 0, 960, 540);

    // 1. Matrix Data Rain
    renderMatrixRain();

    // 2. Grid lines (subtle)
    ctx.strokeStyle = 'rgba(0, 40, 20, 0.3)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < 960; x += 48) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 540); ctx.stroke();
    }
    for (let y = 0; y < 540; y += 48) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    // Screen rotation
    if (screenRotation) {
        ctx.translate(480, 270);
        ctx.rotate(screenRotation);
        ctx.translate(-480, -270);
    }

    // 3. Vision radius darkening
    if (visionRadius < 9000) {
        renderVisionDarkening();
    }

    // 4. Arena shrink border
    if (arenaShrink > 5) {
        const margin = 40 + arenaShrink;
        ctx.fillStyle = 'rgba(255, 0, 85, 0.12)';
        ctx.fillRect(0, 0, margin, 540);
        ctx.fillRect(960 - margin, 0, margin, 540);
        ctx.fillRect(0, 0, 960, margin);
        ctx.fillRect(0, 540 - margin, 960, margin);
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, margin, 960 - margin * 2, 540 - margin * 2);
    }

    // 5. Walls (Code Blocks)
    renderWalls();

    // 6. Pickups
    renderPickups();

    // 7. Clones
    renderClones();

    // 8. Enemies
    renderEnemies();

    // 9. Player
    renderPlayer();

    // 10. Bullets
    renderBullets();

    // 11. Particles
    renderParticles();

    ctx.restore();

    // 12. Warning overlay
    if (state === GameState.WARNING) {
        ctx.fillStyle = `rgba(255, 0, 85, ${0.04 + Math.sin(frameCount * 0.2) * 0.03})`;
        ctx.fillRect(0, 0, 960, 540);
    }

    // 13. CRT scanline overlay (canvas level)
    if (frameCount % 3 === 0) {
        ctx.fillStyle = 'rgba(0, 255, 102, 0.012)';
        for (let y = 0; y < 540; y += 3) {
            ctx.fillRect(0, y + (frameCount % 9), 960, 1);
        }
    }

    // 14. Vignette
    const vig = ctx.createRadialGradient(480, 270, 250, 480, 270, 450);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 960, 540);
}

function renderMatrixRain() {
    ctx.font = '11px "Fira Code", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < matrixCols; i++) {
        const char = matrixTrailChars[Math.floor(Math.random() * matrixTrailChars.length)];
        const x = i * 14 + 7;
        const y = matrixDrops[i];

        // Head (bright)
        ctx.fillStyle = 'rgba(0, 255, 102, 0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 255, 102, 0.5)';
        ctx.fillText(char, x, y);

        // Trail (dim)
        for (let t = 1; t <= 8; t++) {
            const ty = y - t * 14;
            if (ty < 0) break;
            const alpha = 0.5 * (1 - t / 9);
            ctx.fillStyle = `rgba(0, 170, 68, ${alpha})`;
            ctx.shadowBlur = 0;
            ctx.fillText(char, x, ty);
        }
        ctx.shadowBlur = 0;

        matrixDrops[i] += 10 + Math.random() * 4;
        if (y > 540 + 140) {
            matrixDrops[i] = Math.random() * -100;
        }
    }
}

function renderVisionDarkening() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, 960, 540);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const grd = ctx.createRadialGradient(player.x, player.y, visionRadius * 0.6, player.x, player.y, visionRadius);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(player.x, player.y, visionRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function renderWalls() {
    for (const w of walls) {
        const alpha = Math.min(1, w.life / 60);
        ctx.fillStyle = `rgba(5, 25, 10, ${alpha * 0.85})`;
        ctx.strokeStyle = `rgba(0, 255, 102, ${alpha * 0.6})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 255, 102, 0.2)';
        ctx.fillRect(w.x - w.width / 2, w.y - w.height / 2, w.width, w.height);
        ctx.strokeRect(w.x - w.width / 2, w.y - w.height / 2, w.width, w.height);
        ctx.shadowBlur = 0;

        if (w.text) {
            ctx.fillStyle = `rgba(0, 255, 102, ${alpha * 0.7})`;
            ctx.font = '9px "Fira Code", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(w.text, w.x, w.y);
        }
    }
}

function renderPickups() {
    for (const pk of pickups) {
        const pulse = 1 + Math.sin(frameCount * 0.08 + pk.x) * 0.25;
        const alpha = Math.min(1, pk.life / 60);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pk.type === 'health' ? '#00ff66' : '#3498db';
        ctx.shadowBlur = 10;
        ctx.shadowColor = pk.type === 'health' ? 'rgba(0,255,102,0.5)' : 'rgba(52,152,219,0.5)';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 10 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pk.type === 'health' ? '+' : '', pk.x, pk.y + 4);
        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
}

function renderClones() {
    for (const clone of player.clones) {
        ctx.save();
        ctx.globalAlpha = clone.life / 140 * 0.35;
        ctx.translate(clone.x, clone.y);
        ctx.rotate(clone.angle);
        ctx.fillStyle = 'rgba(0, 255, 102, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(player.radius + 4, 0);
        ctx.lineTo(player.radius - 3, -3);
        ctx.lineTo(player.radius - 3, 3);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

function renderEnemies() {
    for (const enemy of enemies) {
        if (enemy.invisible) continue;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = enemy.color + '88';

        if (enemy.type === 'boss') {
            const pulse = 1 + Math.sin(frameCount * 0.05) * 0.12;
            // Boss: pentagon shape
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
                const r = enemy.radius * pulse;
                const px = enemy.x + Math.cos(angle) * r;
                const py = enemy.y + Math.sin(angle) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Inner glow
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            // Label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px "Fira Code", monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            ctx.fillText('BOSS', enemy.x, enemy.y + 5);
        } else if (enemy.type === 'elite') {
            // Elite: diamond
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y - enemy.radius);
            ctx.lineTo(enemy.x + enemy.radius, enemy.y);
            ctx.lineTo(enemy.x, enemy.y + enemy.radius);
            ctx.lineTo(enemy.x - enemy.radius, enemy.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (enemy.type === 'tank') {
            // Tank: large square
            ctx.fillStyle = enemy.color;
            ctx.shadowBlur = 6;
            ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
        } else {
            // Fast: small triangle
            if (enemy.type === 'fast') {
                ctx.fillStyle = enemy.color;
                ctx.beginPath();
                const a = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                ctx.moveTo(enemy.x + Math.cos(a) * enemy.radius, enemy.y + Math.sin(a) * enemy.radius);
                ctx.lineTo(enemy.x + Math.cos(a + 2.5) * enemy.radius * 0.7, enemy.y + Math.sin(a + 2.5) * enemy.radius * 0.7);
                ctx.lineTo(enemy.x + Math.cos(a - 2.5) * enemy.radius * 0.7, enemy.y + Math.sin(a - 2.5) * enemy.radius * 0.7);
                ctx.closePath();
                ctx.fill();
            } else {
                // Normal: circle
                ctx.fillStyle = enemy.color;
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.shadowBlur = 0;
        // HP bar
        const hpR = enemy.hp / enemy.maxHp;
        ctx.fillStyle = 'rgba(30, 10, 10, 0.8)';
        ctx.fillRect(enemy.x - 14, enemy.y - enemy.radius - 11, 28, 3);
        ctx.fillStyle = hpR > 0.5 ? enemy.color : '#ff0000';
        ctx.fillRect(enemy.x - 14, enemy.y - enemy.radius - 11, 28 * hpR, 3);

        ctx.restore();
    }
}

function renderPlayer() {
    if (playerInvincible > 0 && frameCount % 5 < 2) return;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Overclock glow
    if (overclockActive) {
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8 + Math.sin(frameCount * 0.3) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 85, ${0.3 + Math.sin(frameCount * 0.2) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Core glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 255, 102, 0.6)';

    // Ship body: arrow
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.stroke();

    // Inner fill
    ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.fill();

    // Engine glow
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.arc(-4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Shield ring
    if (playerShield > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(52, 152, 219, ${0.4 + Math.sin(frameCount * 0.1) * 0.2})`;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(52, 152, 219, 0.4)';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 6 + Math.sin(frameCount * 0.15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function renderBullets() {
    for (const b of bullets) {
        ctx.save();
        if (b.isEnemyBullet) {
            ctx.fillStyle = b.color || '#ff5252';
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(255, 82, 82, 0.6)';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            // Pulse ring
            ctx.strokeStyle = 'rgba(255, 82, 82, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 2 + Math.sin(frameCount * 0.5), 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = b.color || '#f39c12';
            ctx.shadowBlur = 8;
            ctx.shadowColor = (b.color || '#f39c12') + '88';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            // Bright core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Explosive rounds indicator
            if (explosiveRounds) {
                ctx.strokeStyle = 'rgba(243, 156, 18, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

function renderParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size > 3 ? 6 : 0;
        ctx.shadowColor = p.color;
        if (p.isLine && p.x2 !== undefined) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}
