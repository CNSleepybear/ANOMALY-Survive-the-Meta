// ==================== RENDERER: MATRIX RAIN + CRT + ENTITIES ====================

const matrixCols = Math.floor(960 / 14);
const matrixDrops = Array(matrixCols).fill(0);
const matrixTrailChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

// Damage numbers pool
let damageNumbers = [];

function addDamageNumber(x, y, text, type = 'normal') {
    damageNumbers.push({ x, y, text, type, life: 50, vy: -1.5 });
}

function initRenderer() {
    for (let i = 0; i < matrixCols; i++) {
        matrixDrops[i] = Math.random() * -540;
    }
}

function render(dt) {
    // Clear with trail effect
    ctx.fillStyle = 'rgba(3, 3, 3, 0.18)';
    ctx.fillRect(0, 0, 960, 540);

    // 1. Matrix Data Rain
    renderMatrixRain(dt);

    // 2. Grid lines
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

    if (screenRotation) {
        ctx.translate(480, 270);
        ctx.rotate(screenRotation);
        ctx.translate(-480, -270);
    }

    // 3. Vision radius darkening
    if (visionRadius < 9000) renderVisionDarkening();

    // 4. Fog of war
    if (fogOfWar) renderFogOfWar();

    // 5. Arena shrink border
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

    // 6. Lava pools
    renderLavaPools();

    // 7. Dimensional rifts
    renderDimensionalRifts();

    // 8. Walls
    renderWalls();

    // 9. Pickups
    renderPickups();

    // 10. Clones
    renderClones();

    // 11. Status effects on enemies
    renderStatusEffects();

    // 12. Enemies
    renderEnemies();

    // 13. Player
    renderPlayer();

    // 14. Bullets
    renderBullets();

    // 15. Particles
    renderParticles();

    // 16. Turrets
    renderTurrets();

    // 17. Overheat indicator
    if (overheatSystem) {
        ctx.fillStyle = `rgba(255, 102, 0, ${overheatValue / 100 * 0.5})`;
        ctx.fillRect(player.x - 15, player.y - 20, 30 * (overheatValue / 100), 3);
        ctx.strokeStyle = '#ff6600';
        ctx.strokeRect(player.x - 15, player.y - 20, 30, 3);
    }

    // 18. Ammo indicator
    if (ammoLimited) {
        ctx.fillStyle = 'rgba(243, 156, 18, 0.8)';
        ctx.font = '10px "Fira Code", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`AMMO: ${currentAmmo}/${maxAmmo}`, player.x, player.y + 28);
    }

    ctx.restore();

    // 19. Damage numbers (above canvas shake)
    renderDamageNumbers();

    // 20. Minimap
    renderMinimap();

    // 21. Boss HP bar
    renderBossBar();

    // 22. Warning overlay
    if (state === GameState.WARNING) {
        ctx.fillStyle = `rgba(255, 0, 85, ${0.04 + Math.sin(frameCount * 0.2) * 0.03})`;
        ctx.fillRect(0, 0, 960, 540);
    }

    // 23. CRT scanlines
    if (frameCount % 3 === 0) {
        ctx.fillStyle = 'rgba(0, 255, 102, 0.012)';
        for (let y = 0; y < 540; y += 3) {
            ctx.fillRect(0, y + (frameCount % 9), 960, 1);
        }
    }

    // 24. Vignette
    const vig = ctx.createRadialGradient(480, 270, 250, 480, 270, 450);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 960, 540);
}

function renderMatrixRain(dt) {
    ctx.font = '11px "Fira Code", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < matrixCols; i++) {
        const char = matrixTrailChars[Math.floor(Math.random() * matrixTrailChars.length)];
        const x = i * 14 + 7;
        const y = matrixDrops[i];

        ctx.fillStyle = 'rgba(0, 255, 102, 0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 255, 102, 0.5)';
        ctx.fillText(char, x, y);

        for (let t = 1; t <= 8; t++) {
            const ty = y - t * 14;
            if (ty < 0) break;
            const alpha = 0.5 * (1 - t / 9);
            ctx.fillStyle = `rgba(0, 170, 68, ${alpha})`;
            ctx.shadowBlur = 0;
            ctx.fillText(char, x, ty);
        }
        ctx.shadowBlur = 0;

        matrixDrops[i] += (10 + Math.random() * 4) * dt;
        if (y > 540 + 140) matrixDrops[i] = Math.random() * -100;
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

function renderFogOfWar() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, 960, 540);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const key of fogMap) {
        const [gx, gy] = key.split(',').map(Number);
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(gx * 48, gy * 48, 48, 48);
    }
    // Player circle always visible
    const grd = ctx.createRadialGradient(player.x, player.y, 50, player.x, player.y, 140);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function renderLavaPools() {
    if (!lavaPools) return;
    for (const l of lavaPools) {
        const alpha = Math.min(1, l.life / 100) * 0.6;
        ctx.fillStyle = `rgba(255, 87, 34, ${alpha})`;
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(255, 87, 34, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 171, 64, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderDimensionalRifts() {
    if (!dimRifts) return;
    for (const r of dimRifts) {
        const alpha = Math.min(1, r.life / 60) * 0.7;
        ctx.strokeStyle = `rgba(155, 89, 182, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(155, 89, 182, ${alpha})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        const swirlAngle = frameCount * 0.05;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * 0.7, swirlAngle, swirlAngle + Math.PI * 1.5);
        ctx.strokeStyle = `rgba(200, 150, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
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
        let color = pk.type === 'health' ? '#00ff66' : (pk.type === 'ammo' ? '#f39c12' : '#3498db');
        if (pk.type === 'xp') color = '#9b59b6';
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color + '88';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 10 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        let icon = pk.type === 'health' ? '+' : (pk.type === 'ammo' ? 'A' : (pk.type === 'xp' ? 'XP' : ''));
        ctx.fillText(icon, pk.x, pk.y + 4);
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

function renderStatusEffects() {
    for (const eff of activeStatusEffects) {
        if (eff.target !== 'enemy') continue;
        const enemy = enemies.find(e => e.id === eff.targetId);
        if (!enemy) continue;
        const def = Object.values(STATUS_TYPES).find(s => s.id === eff.type);
        if (!def) continue;
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.2) * 0.3;
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = def.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4 + Math.sin(frameCount * 0.1) * 2, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < eff.stacks; i++) {
            const angle = (i / eff.stacks) * Math.PI * 2 + frameCount * 0.05;
            ctx.fillStyle = def.color;
            ctx.beginPath();
            ctx.arc(enemy.x + Math.cos(angle) * (enemy.radius + 8), enemy.y + Math.sin(angle) * (enemy.radius + 8), 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function renderEnemies() {
    for (const enemy of enemies) {
        if (enemy.invisible) continue;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = enemy.color + '88';

        // Elite glow ring
        if (enemy.elite) {
            ctx.strokeStyle = enemy.eliteColor || '#ffd700';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = (enemy.eliteColor || '#ffd700') + '66';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius + 6 + Math.sin(frameCount * 0.1) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Elite mod icons
            if (enemy.eliteMods) {
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                enemy.eliteMods.forEach((mod, mi) => {
                    ctx.fillText(mod.icon || '★', enemy.x - 8 + mi * 10, enemy.y - enemy.radius - 14);
                });
            }
        }

        if (enemy.type === 'boss') {
            const pulse = 1 + Math.sin(frameCount * 0.05) * 0.12;
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
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px "Fira Code", monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            ctx.fillText('BOSS', enemy.x, enemy.y + 5);

            if (enemy.bossType === 'juggernaut' && enemy.charging) {
                ctx.strokeStyle = 'rgba(255, 87, 34, 0.8)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, enemy.radius + 10, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (enemy.bossType === 'specter') {
                for (const c of (enemy.clones || [])) {
                    ctx.globalAlpha = c.life / 90 * 0.4;
                    ctx.strokeStyle = '#9c27b0';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
            if (enemy.bossType === 'titan') {
                for (const sat of (enemy.satellites || [])) {
                    const sx = enemy.x + Math.cos(sat.angle) * sat.radius;
                    const sy = enemy.y + Math.sin(sat.angle) * sat.radius;
                    ctx.fillStyle = '#ff9800';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ffcc80';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(enemy.x, enemy.y);
                    ctx.lineTo(sx, sy);
                    ctx.stroke();
                }
            }
            if (enemy.bossType === 'entropy_lord') {
                ctx.strokeStyle = 'rgba(0, 188, 212, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, 150, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (enemy.type === 'elite') {
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
            ctx.fillStyle = enemy.color;
            ctx.shadowBlur = 6;
            ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
        } else if (enemy.type === 'phantom') {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else if (enemy.type === 'fast') {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            const a = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            ctx.moveTo(enemy.x + Math.cos(a) * enemy.radius, enemy.y + Math.sin(a) * enemy.radius);
            ctx.lineTo(enemy.x + Math.cos(a + 2.5) * enemy.radius * 0.7, enemy.y + Math.sin(a + 2.5) * enemy.radius * 0.7);
            ctx.lineTo(enemy.x + Math.cos(a - 2.5) * enemy.radius * 0.7, enemy.y + Math.sin(a - 2.5) * enemy.radius * 0.7);
            ctx.closePath();
            ctx.fill();
        } else if (enemy.type === 'splitter') {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            // Crack lines
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(enemy.x - enemy.radius * 0.5, enemy.y - enemy.radius * 0.3);
            ctx.lineTo(enemy.x + enemy.radius * 0.3, enemy.y + enemy.radius * 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(enemy.x + enemy.radius * 0.4, enemy.y - enemy.radius * 0.4);
            ctx.lineTo(enemy.x - enemy.radius * 0.2, enemy.y + enemy.radius * 0.3);
            ctx.stroke();
        } else if (enemy.type === 'shielded') {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            // Shield ring
            if (enemy.shield > 0) {
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#3498db';
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        } else if (enemy.type === 'parasite') {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            // Spiky shape
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? enemy.radius : enemy.radius * 0.6;
                const px = enemy.x + Math.cos(a) * r;
                const py = enemy.y + Math.sin(a) * r;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
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

    if (overclockActive) {
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 8 + Math.sin(frameCount * 0.3) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 85, ${0.3 + Math.sin(frameCount * 0.2) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const playerStatuses = activeStatusEffects.filter(e => e.target === 'player');
    if (playerStatuses.length > 0) {
        for (let i = 0; i < playerStatuses.length; i++) {
            const eff = playerStatuses[i];
            const def = Object.values(STATUS_TYPES).find(s => s.id === eff.type);
            if (!def) continue;
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.3 + i) * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, player.radius + 6 + i * 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 255, 102, 0.6)';
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.arc(-4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (playerShield > 0) {
        ctx.save();
        const shieldAlpha = fragileShield ? 0.6 + Math.sin(frameCount * 0.3) * 0.2 : 0.4 + Math.sin(frameCount * 0.1) * 0.2;
        ctx.strokeStyle = fragileShield ? `rgba(255, 165, 0, ${shieldAlpha})` : `rgba(52, 152, 219, ${shieldAlpha})`;
        ctx.lineWidth = fragileShield ? 1.5 : 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = fragileShield ? 'rgba(255, 165, 0, 0.4)' : 'rgba(52, 152, 219, 0.4)';
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
            ctx.strokeStyle = 'rgba(255, 82, 82, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius + 2 + Math.sin(frameCount * 0.5), 0, Math.PI * 2);
            ctx.stroke();
            if (b.homing) {
                ctx.strokeStyle = 'rgba(255, 82, 82, 0.2)';
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(player.x, player.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else {
            ctx.fillStyle = b.color || '#f39c12';
            ctx.shadowBlur = 8;
            ctx.shadowColor = (b.color || '#f39c12') + '88';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            if (explosiveRounds) {
                ctx.strokeStyle = 'rgba(243, 156, 18, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (b.bounces > 0) {
                ctx.fillStyle = '#fff';
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(b.bounces.toString(), b.x, b.y - 6);
            }
        }
        ctx.restore();
    }
}

function renderTurrets() {
    if (!turrets) return;
    for (const t of turrets) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.angle);
        ctx.fillStyle = t.stranger ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 255, 102, 0.3)';
        ctx.strokeStyle = t.stranger ? '#fff' : '#00ff66';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, 0);
        ctx.stroke();
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

function renderDamageNumbers() {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d = damageNumbers[i];
        d.life -= dt;
        d.y += d.vy;
        if (d.life <= 0) { damageNumbers.splice(i, 1); continue; }

        const alpha = Math.min(1, d.life / 20);
        const scale = d.type === 'crit' ? 1.3 + (1 - d.life / 50) * 0.5 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = d.type === 'crit' ? 'bold 18px "Orbitron", monospace' : 'bold 12px "Orbitron", monospace';
        ctx.textAlign = 'center';

        if (d.type === 'crit') {
            ctx.fillStyle = '#ffd700';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ffd700';
        } else if (d.type === 'heal') {
            ctx.fillStyle = '#00ff66';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#00ff66';
        } else if (d.type === 'score') {
            ctx.fillStyle = '#00ffff';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#00ffff';
        } else {
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 3;
            ctx.shadowColor = '#ff0055';
        }

        ctx.fillText(d.text, d.x, d.y);
        ctx.restore();
    }
}

function renderMinimap() {
    const mm = document.getElementById('minimap');
    if (!mm) return;
    // Clear old dots
    mm.innerHTML = '';

    const scaleX = 80 / 960;
    const scaleY = 48 / 540;

    // Player dot
    const pd = document.createElement('div');
    pd.className = 'minimap-dot minimap-player';
    pd.style.left = (player.x * scaleX) + 'px';
    pd.style.top = (player.y * scaleY) + 'px';
    mm.appendChild(pd);

    // Enemy dots
    for (const e of enemies) {
        if (e.phantom) continue;
        const ed = document.createElement('div');
        ed.className = 'minimap-dot ' + (e.type === 'boss' ? 'minimap-boss' : 'minimap-enemy');
        ed.style.left = (e.x * scaleX) + 'px';
        ed.style.top = (e.y * scaleY) + 'px';
        mm.appendChild(ed);
    }

    // Pickup dots
    for (const pk of pickups) {
        const pd2 = document.createElement('div');
        pd2.className = 'minimap-dot minimap-pickup';
        pd2.style.left = (pk.x * scaleX) + 'px';
        pd2.style.top = (pk.y * scaleY) + 'px';
        mm.appendChild(pd2);
    }
}

function renderBossBar() {
    const boss = enemies.find(e => e.type === 'boss');
    const bar = document.getElementById('bossHpBar');
    if (!bar) return;
    if (boss) {
        bar.classList.add('active');
        document.getElementById('bossNameDisplay').textContent = boss.bossName || 'BOSS';
        document.getElementById('bossBarFill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    } else {
        bar.classList.remove('active');
    }
}
