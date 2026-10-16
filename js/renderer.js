// ==================== RENDERER: MATRIX RAIN + CRT + ENTITIES ====================

// Damage numbers pool
let damageNumbers = [];

function addDamageNumber(x, y, text, type = 'normal') {
    damageNumbers.push({ x, y, text, type, life: 50, vy: -1.5 });
}

function initRenderer() {
    AnomalyArt.createArena();
    AnomalyArt.sprites.clear();
    AnomalyArt.hits = new WeakMap();
}

function render(dt) {
    AnomalyArt.drawArena(ctx, Number.isFinite(dt) ? dt : 1);
    container.dataset.scene = state === GameState.MENU ? 'menu' : state === GameState.UPGRADE ? 'upgrade' : state === GameState.GAME_OVER ? 'game-over' : 'playing';
    if (state === GameState.MENU) {
        AnomalyArt.drawMenu(ctx);
        return;
    }

    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    if (screenRotation) {
        ctx.translate(480, 270);
        ctx.rotate(screenRotation);
        ctx.translate(-480, -270);
    }

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
    AnomalyArt.drawBursts(ctx);

    // 16. Turrets
    renderTurrets();
    if (visionRadius < 9000) renderVisionDarkening();
    if (fogOfWar) renderFogOfWar();

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
    renderDamageNumbers(dt);
    renderReticle();

    // 20. Minimap
    if (frameCount % 6 < dt) renderMinimap();

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
    const vig = ctx.createRadialGradient(480, 270, 190, 480, 270, 520);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,8,16,0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 960, 540);
}

function renderVisionDarkening() {
    ctx.save();
    const grd = ctx.createRadialGradient(player.x, player.y, visionRadius * 0.6, player.x, player.y, visionRadius);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 960, 540);
    ctx.restore();
}

function renderFogOfWar() {
    if (!AnomalyArt.fogSurface) {
        AnomalyArt.fogSurface = document.createElement('canvas');
        AnomalyArt.fogSurface.width = 960;
        AnomalyArt.fogSurface.height = 540;
    }
    const fogContext = AnomalyArt.fogSurface.getContext('2d');
    fogContext.clearRect(0, 0, 960, 540);
    fogContext.fillStyle = 'rgba(0, 0, 0, 0.85)';
    fogContext.fillRect(0, 0, 960, 540);
    fogContext.save();
    fogContext.globalCompositeOperation = 'destination-out';
    for (const key of fogMap) {
        const [gx, gy] = key.split(',').map(Number);
        fogContext.fillStyle = 'rgba(0,0,0,1)';
        fogContext.fillRect(gx * 48, gy * 48, 48, 48);
    }
    // Player circle always visible
    const grd = fogContext.createRadialGradient(player.x, player.y, 50, player.x, player.y, 140);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    fogContext.fillStyle = grd;
    fogContext.beginPath();
    fogContext.arc(player.x, player.y, 140, 0, Math.PI * 2);
    fogContext.fill();
    fogContext.restore();
    ctx.drawImage(AnomalyArt.fogSurface, 0, 0);
}

function renderLavaPools() {
    if (!lavaPools) return;
    for (const l of lavaPools) {
        ctx.save();
        const alpha = Math.min(1, l.life / 100) * 0.6;
        ctx.globalAlpha = alpha;
        ctx.translate(l.x, l.y);
        AnomalyArt.glow(ctx, 0, 0, l.radius * 1.2, '#ff762a66');
        const crust = Array.from({length: 24}, (_, index) => {
            const angle = index / 24 * Math.PI * 2;
            const radius = l.radius * (index % 3 ? 1 : .92);
            return [Math.cos(angle) * radius, Math.sin(angle) * radius];
        });
        AnomalyArt.polygon(ctx, crust);
        ctx.fillStyle = '#652f24';
        ctx.fill();
        ctx.strokeStyle = '#fba869';
        ctx.lineWidth = 1;
        ctx.stroke();
        for (let vein = 0; vein < 5; vein++) {
            const angle = vein / 5 * Math.PI * 2 + l.x;
            ctx.strokeStyle = vein % 2 ? '#ffb65a88' : '#ffdd9999';
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * l.radius * .8, Math.sin(angle) * l.radius * .8);
            ctx.lineTo(Math.cos(angle + .15) * l.radius * .4, Math.sin(angle + .15) * l.radius * .4);
            ctx.lineTo(Math.cos(angle - .3) * l.radius * .12, Math.sin(angle - .3) * l.radius * .12);
            ctx.stroke();
        }
        AnomalyArt.ring(ctx, l.radius + 4 + Math.sin(AnomalyArt.time * 3) * 2, '#ffb76b55', .7);
        ctx.restore();
    }
}

function renderDimensionalRifts() {
    if (!dimRifts) return;
    for (const r of dimRifts) {
        ctx.save();
        const alpha = Math.min(1, r.life / 60) * 0.7;
        ctx.globalAlpha = alpha;
        ctx.translate(r.x, r.y);
        AnomalyArt.glow(ctx, 0, 0, r.radius * 1.5, '#b897fb44');
        ctx.fillStyle = '#100d21cc';
        ctx.beginPath(); ctx.arc(0, 0, r.radius * .7, 0, Math.PI * 2); ctx.fill();
        AnomalyArt.ring(ctx, r.radius, '#a49fec', 1);
        ctx.rotate(AnomalyArt.time);
        for (let arc = 0; arc < 4; arc++) {
            const angle = arc * Math.PI / 2;
            ctx.strokeStyle = arc % 2 ? '#c8b3ff' : '#6555a0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r.radius * .7, angle, angle + .9);
            ctx.stroke();
            ctx.fillStyle = '#eadcff';
            ctx.fillRect(Math.cos(angle) * r.radius - 1, Math.sin(angle) * r.radius - 1, 2, 2);
        }
        ctx.restore();
    }
}

function renderWalls() {
    for (const w of walls) {
        ctx.save();
        const alpha = Math.min(1, w.life / 60);
        ctx.globalAlpha = alpha;
        const left = w.x - w.width / 2;
        const top = w.y - w.height / 2;
        ctx.fillStyle = '#030d1688';
        ctx.fillRect(left + 3, top + 4, w.width, w.height);
        const metal = ctx.createLinearGradient(left, top, left, top + w.height);
        metal.addColorStop(0, '#4d6670');
        metal.addColorStop(1, '#20333d');
        ctx.fillStyle = metal;
        ctx.strokeStyle = '#7faca488';
        ctx.lineWidth = 1;
        ctx.fillRect(w.x - w.width / 2, w.y - w.height / 2, w.width, w.height);
        ctx.strokeRect(w.x - w.width / 2, w.y - w.height / 2, w.width, w.height);
        ctx.fillStyle = '#87e6c599';
        ctx.fillRect(left + 3, top + 3, Math.min(8, w.width - 6), 2);
        if (w.text) {
            ctx.fillStyle = '#93cfbf';
            ctx.font = '7px Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(w.text, w.x, w.y);
        }
        ctx.restore();
    }
}

function renderPickups() {
    for (const pk of pickups) {
        const pulse = 1 + Math.sin(AnomalyArt.time * 4 + pk.x) * 0.1;
        const alpha = Math.min(1, pk.life / 60);
        ctx.save();
        ctx.globalAlpha = alpha;
        const color = pk.type === 'health' ? '#86f1cf' : pk.type === 'ammo' ? '#eec88c' : pk.type === 'shield' ? '#82cbea' : '#ad9eed';
        ctx.translate(pk.x, pk.y);
        AnomalyArt.glow(ctx, 0, 0, 22, color + '18');
        ctx.fillStyle = '#101f2b';
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 1;
        AnomalyArt.polygon(ctx, [[0, -9 * pulse], [9 * pulse, 0], [0, 9 * pulse], [-9 * pulse, 0]]);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        if (pk.type === 'health') {
            ctx.fillRect(-1.5, -5, 3, 10);
            ctx.fillRect(-5, -1.5, 10, 3);
        } else if (pk.type === 'ammo') {
            ctx.fillRect(-4, -3, 2, 6);
            ctx.fillRect(0, -3, 2, 6);
            ctx.fillRect(4, -3, 2, 6);
        } else if (pk.type === 'shield') {
            AnomalyArt.polygon(ctx, [[-4, -4], [4, -4], [4, 1], [0, 5], [-4, 1]]);
            ctx.strokeStyle = color;
            ctx.stroke();
        } else {
            AnomalyArt.polygon(ctx, [[0, -4], [3, 0], [0, 4], [-3, 0]]);
            ctx.fill();
        }
        ctx.strokeStyle = color + '33';
        ctx.beginPath();
        ctx.ellipse(0, 9, 10, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function renderClones() {
    for (const clone of player.clones) {
        ctx.save();
        ctx.globalAlpha = clone.life / 140 * 0.35;
        AnomalyArt.drawCore(ctx, clone.x, clone.y, clone.angle);
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
        if (enemy.type === 'phantom') ctx.globalAlpha = .3;
        AnomalyArt.drawEnemy(ctx, enemy, player);

        // Elite glow ring
        if (enemy.elite) {
            ctx.strokeStyle = enemy.eliteColor || '#ffd700';
            ctx.lineWidth = 1;
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
            for (const minion of enemy.minions || []) AnomalyArt.drawEnemy(ctx, minion, player);
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
        }

        ctx.shadowBlur = 0;
        // HP bar
        const hpR = Math.max(0, enemy.hp / enemy.maxHp);
        if (hpR < 1 && enemy.type !== 'boss') {
            ctx.fillStyle = '#07101dcc';
            ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 8, 24, 2);
            ctx.fillStyle = '#e9a4aa';
            ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 8, 24 * hpR, 2);
        }

        ctx.restore();
    }
}

function renderPlayer() {
    if (playerInvincible > 0 && frameCount % 5 < 2) return;
    const thrust = Math.min(1, Math.hypot(player.vx, player.vy) / 4);
    AnomalyArt.drawCore(ctx, player.x, player.y, player.angle, 1, thrust, overclockActive ? '#ff8f9e' : '#86f1cf');
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

    if (AnomalyArt.time < AnomalyArt.muzzleUntil) {
        ctx.fillStyle = '#fff7d3';
        AnomalyArt.polygon(ctx, [[21, -3], [35, 0], [21, 3], [24, 0]]);
        ctx.fill();
        AnomalyArt.glow(ctx, 24, 0, 24, AnomalyArt.muzzleColor + '66');
    }
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
        const trailColor = b.color || (b.isEnemyBullet ? '#ff687d' : '#eec88c');
        ctx.strokeStyle = trailColor + '55';
        ctx.lineWidth = b.radius * (b.isEnemyBullet ? .7 : 1);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * (b.isEnemyBullet ? 1.7 : 2.6), b.y - b.vy * (b.isEnemyBullet ? 1.7 : 2.6));
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
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
        ctx.fillStyle = '#253a42';
        ctx.strokeStyle = t.stranger ? '#dde4df' : '#86f1cf';
        ctx.lineWidth = 1.5;
        AnomalyArt.polygon(ctx, [[-8, -8], [8, -8], [11, 0], [8, 8], [-8, 8], [-11, 0]]);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#a9e0cb';
        ctx.fillRect(-3, -2, 15, 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, 0);
        ctx.stroke();
        ctx.restore();
    }
}

function renderParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size > 3 ? 3 : 0;
        ctx.shadowColor = p.color;
        if (p.isLine && p.x2 !== undefined) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(.7, p.size * .5);
            ctx.beginPath();
            ctx.moveTo(p.x - (p.vx || 0) * 2, p.y - (p.vy || 0) * 2);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            if (p.size > 3) ctx.fillRect(p.x - p.size / 3, p.y - p.size / 3, p.size * .7, p.size * .7);
        }
    }
    ctx.restore();
}

function renderDamageNumbers(dt) {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const d = damageNumbers[i];
        d.life -= dt;
        d.y += d.vy * dt;
        if (d.life <= 0) { damageNumbers.splice(i, 1); continue; }

        const alpha = Math.min(1, d.life / 20);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = d.type === 'crit' ? 'bold 16px Bahnschrift, sans-serif' : 'bold 11px Bahnschrift, sans-serif';
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

        ctx.strokeStyle = '#08131d';
        ctx.lineWidth = 3;
        ctx.strokeText(d.text, d.x, d.y);
        ctx.fillText(d.text, d.x, d.y);
        ctx.restore();
    }
}

function renderReticle() {
    if (isMobile || state === GameState.UPGRADE || state === GameState.GAME_OVER) return;
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    const recoil = AnomalyArt.time < AnomalyArt.muzzleUntil ? 3 : 0;
    ctx.strokeStyle = '#ccefe2cc';
    ctx.lineWidth = .8;
    for (let segment = 0; segment < 4; segment++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(5 + recoil, -2);
        ctx.lineTo(9 + recoil, -2);
        ctx.lineTo(9 + recoil, 2);
        ctx.stroke();
    }
    ctx.fillStyle = '#dcffee';
    ctx.fillRect(-.75, -.75, 1.5, 1.5);
    ctx.restore();
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
        document.getElementById('bossPhaseDisplay').textContent = `THREAT LEVEL ${wave.toString().padStart(2, '0')} / ${Math.max(0, Math.ceil(boss.hp / boss.maxHp * 100))}% INTEGRITY`;
        document.getElementById('bossBarFill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    } else {
        bar.classList.remove('active');
    }
}
