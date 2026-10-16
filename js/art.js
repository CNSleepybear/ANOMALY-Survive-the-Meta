const ART_ICONS = {
    pulse: 'M4 9h12l4 4h-8l-2 7H6l2-7H4ZM16 9V6h4v3M3 6h8',
    burst: 'm12 2 2 6 6-3-3 6 5 3-7 1 1 7-5-5-6 3 3-6-6-2 7-2Z',
    bolt: 'm14 2-9 12h7l-2 8 9-12h-7Z',
    target: 'M12 2v5m0 10v5M2 12h5m10 0h5M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    dash: 'm11 5 8 7-8 7M4 5l8 7-8 7M2 12h16',
    clock: 'M12 3a9 9 0 1 1-9 9M3 3v6h6M12 7v5l4 3',
    shield: 'm12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5ZM8 12l3 3 5-6',
    core: 'm12 2 9 5v10l-9 5-9-5V7ZM12 7l5 3v4l-5 3-5-3v-4ZM12 2v5m9 10-4-3M3 17l4-3',
    health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
    chip: 'M6 6h12v12H6ZM9 9h6v6H9ZM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
    gear: 'm9 3 1-1h4l1 4 4 1 2 3-3 3 1 4-3 2-3-3-4 1-2-3 2-3-1-4ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
};

function artIcon(name) {
    return `<svg class="art-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ART_ICONS[name] || ART_ICONS.core}"/></svg>`;
}

function upgradeArtIcon(upgrade) {
    const name = upgrade.id || upgrade.name;
    if (/hp|regen|heal|生命|修复|回复|吸血/.test(name)) return 'health';
    if (/shield|defense|护盾|防|甲/.test(name)) return 'shield';
    if (/speed|机动|移速|闪|冲刺/.test(name)) return 'dash';
    if (/crit|穿透|瞄准|暴击/.test(name)) return 'target';
    if (/dmg|伤害|攻击|爆/.test(name)) return 'burst';
    if (/射速|超频|闪电|电/.test(name)) return 'bolt';
    if (/reroll|时间|重编/.test(name)) return 'clock';
    return 'chip';
}

const AnomalyArt = {
    time: 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    arena: null,
    sprites: new Map(),
    hits: new WeakMap(),
    bursts: [],
    get motionTime() {
        return this.reducedMotion ? 0 : this.time;
    },
    polygon(context, points) {
        context.beginPath();
        points.forEach((point, index) => {
            if (index === 0) context.moveTo(point[0], point[1]);
            else context.lineTo(point[0], point[1]);
        });
        context.closePath();
    },
    ring(context, radius, color, width = 1) {
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
    },
    glow(context, x, y, radius, color) {
        const light = context.createRadialGradient(x, y, 0, x, y, radius);
        light.addColorStop(0, color);
        light.addColorStop(1, 'transparent');
        context.fillStyle = light;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    },
    createArena() {
        const surface = document.createElement('canvas');
        surface.width = 1920;
        surface.height = 1080;
        const context = surface.getContext('2d');
        context.scale(2, 2);
        context.fillStyle = '#101b23';
        context.fillRect(0, 0, 960, 540);
        for (let row = 0; row < 9; row++) {
            for (let column = 0; column < 15; column++) {
                const tileX = column * 64;
                const tileY = row * 64;
                const seed = (row * 73 + column * 37) % 17;
                const plate = context.createLinearGradient(tileX, tileY, tileX + 64, tileY + 64);
                plate.addColorStop(0, seed < 6 ? '#1d2a32' : '#1a272f');
                plate.addColorStop(1, seed < 6 ? '#17222a' : '#142128');
                context.fillStyle = plate;
                context.fillRect(tileX + 2, tileY + 2, 60, 60);
                context.strokeStyle = '#283940';
                context.lineWidth = .6;
                context.strokeRect(tileX + 2.5, tileY + 2.5, 59, 59);
                context.fillStyle = '#304249';
                for (const offset of [[7, 7], [56, 7], [7, 56], [56, 56]]) {
                    context.fillRect(tileX + offset[0], tileY + offset[1], 1, 1);
                }
                if (seed % 4 === 0) {
                    context.strokeStyle = '#2c3e433f';
                    context.beginPath();
                    context.moveTo(tileX + 11, tileY + 42);
                    context.lineTo(tileX + 23, tileY + 39);
                    context.lineTo(tileX + 43, tileY + 44);
                    context.stroke();
                }
                if (seed === 5) {
                    context.fillStyle = '#44616a44';
                    context.font = '5px Consolas, monospace';
                    context.fillText('ANM / 07', tileX + 12, tileY + 18);
                }
            }
        }
        context.save();
        context.translate(480, 270);
        this.ring(context, 168, '#5070771d', 1);
        this.ring(context, 157, '#50707716', 1);
        this.ring(context, 88, '#5070771d', 1);
        context.setLineDash([3, 12]);
        this.ring(context, 176, '#72958d22', 2);
        context.restore();
        context.strokeStyle = '#47656c44';
        context.lineWidth = 1;
        context.strokeRect(31, 31, 898, 478);
        context.strokeStyle = '#47656c22';
        context.strokeRect(36, 36, 888, 468);
        for (let railX = 64; railX < 920; railX += 128) {
            context.fillStyle = '#070e13';
            context.fillRect(railX, 8, 64, 11);
            context.fillRect(railX, 521, 64, 11);
            context.fillStyle = '#607779';
            context.fillRect(railX + 5, 13, 18, 2);
            context.fillRect(railX + 40, 525, 18, 2);
            context.fillStyle = '#6caf9c';
            context.fillRect(railX + 5, 13, 8, 2);
            context.fillRect(railX + 40, 525, 8, 2);
        }
        for (const sideX of [8, 932]) {
            for (let ventY = 86; ventY < 490; ventY += 106) {
                context.fillStyle = '#091117';
                context.fillRect(sideX, ventY, 20, 54);
                for (let slat = 0; slat < 7; slat++) {
                    context.fillStyle = '#2c3b43';
                    context.fillRect(sideX + 3, ventY + 5 + slat * 6, 14, 2);
                }
                context.fillStyle = '#c9974a55';
                context.fillRect(sideX + 4, ventY - 5, 12, 2);
            }
        }
        for (const corner of [[40, 40, 1, 1], [920, 40, -1, 1], [40, 500, 1, -1], [920, 500, -1, -1]]) {
            context.save();
            context.translate(corner[0], corner[1]);
            context.scale(corner[2], corner[3]);
            context.fillStyle = '#759a9644';
            context.fillRect(0, 0, 45, 3);
            context.fillRect(0, 0, 3, 32);
            context.fillStyle = '#c99c5755';
            for (let stripe = 0; stripe < 4; stripe++) {
                this.polygon(context, [[6 + stripe * 9, 8], [10 + stripe * 9, 8], [7 + stripe * 9, 14], [3 + stripe * 9, 14]]);
                context.fill();
            }
            context.restore();
        }
        this.glow(context, 480, 260, 390, '#7cd6b808');
        context.fillStyle = '#729a9c35';
        context.font = '8px Consolas, monospace';
        context.fillText('SECTOR 07  /  CONTAINMENT FIELD', 46, 486);
        context.textAlign = 'right';
        context.fillText('CAUTION : UNSTABLE REALITY', 912, 486);
        this.arena = surface;
    },
    drawArena(context, delta) {
        if (!this.arena) this.createArena();
        this.time += delta / 60;
        context.drawImage(this.arena, 0, 0, 960, 540);
        if (this.reducedMotion) return;
        context.save();
        context.globalAlpha = .12;
        context.strokeStyle = '#86f1cf';
        context.lineWidth = 1;
        const scanY = (this.time * 15) % 540;
        context.beginPath();
        context.moveTo(34, scanY);
        context.lineTo(926, scanY);
        context.stroke();
        context.restore();
    },
    drawCore(context, x, y, angle, scale = 1, thrust = 0, accent = '#86f1cf') {
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.scale(scale, scale);
        context.fillStyle = '#0006';
        context.beginPath();
        context.ellipse(-2, 5, 21, 14, 0, 0, Math.PI * 2);
        context.fill();
        const flameSize = 7 + thrust * 11 + Math.sin(this.motionTime * 38) * 2;
        this.glow(context, -19, 0, 24 + thrust * 9, '#65edc635');
        for (const engineY of [-8, 8]) {
            const flame = context.createLinearGradient(-18, 0, -24 - flameSize, 0);
            flame.addColorStop(0, '#caffed');
            flame.addColorStop(.3, '#65eeb9aa');
            flame.addColorStop(1, '#65eeb900');
            context.fillStyle = flame;
            this.polygon(context, [[-15, engineY - 2], [-24 - flameSize, engineY], [-15, engineY + 2]]);
            context.fill();
        }
        const metal = context.createLinearGradient(0, -15, 0, 15);
        metal.addColorStop(0, '#75989a');
        metal.addColorStop(.35, '#3d5a65');
        metal.addColorStop(.5, '#253c48');
        metal.addColorStop(1, '#13222d');
        context.strokeStyle = '#0a141e';
        context.lineWidth = 2;
        this.polygon(context, [[17, 0], [5, -6], [-3, -16], [-19, -12], [-12, 0], [-19, 12], [-3, 16], [5, 6]]);
        context.fillStyle = metal;
        context.fill();
        context.stroke();
        context.strokeStyle = '#8badb08c';
        context.lineWidth = .6;
        this.polygon(context, [[17, 0], [5, -6], [-3, -16], [-19, -12], [-12, 0], [-19, 12], [-3, 16], [5, 6]]);
        context.stroke();
        context.fillStyle = '#172b36';
        this.polygon(context, [[-9, -11], [-3, -11], [6, -3], [-5, -4]]);
        context.fill();
        this.polygon(context, [[-9, 11], [-3, 11], [6, 3], [-5, 4]]);
        context.fill();
        context.strokeStyle = accent;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(-15, -10);
        context.lineTo(-4, -13);
        context.lineTo(1, -7);
        context.moveTo(-15, 10);
        context.lineTo(-4, 13);
        context.lineTo(1, 7);
        context.stroke();
        context.fillStyle = '#07151d';
        this.polygon(context, [[9, 0], [-1, -5], [-8, 0], [-1, 5]]);
        context.fill();
        this.glow(context, -1, 0, 8, '#7bf7cb66');
        context.fillStyle = '#cefce9';
        this.polygon(context, [[4, 0], [-1, -2], [-4, 0], [-1, 2]]);
        context.fill();
        context.fillStyle = '#a8c8c7';
        context.fillRect(9, -1.2, 11, 2.4);
        context.fillStyle = accent;
        context.fillRect(18, -1, 3, 2);
        context.fillStyle = '#d3ddcbbb';
        context.fillRect(-8, -12, 3, 1.3);
        context.strokeStyle = '#0a182a99';
        context.lineWidth = .55;
        for (const engineY of [-9, 9]) {
            context.beginPath();
            context.moveTo(-13, engineY);
            context.lineTo(-7, engineY * .7);
            context.lineTo(-3, engineY * .7);
            context.stroke();
            context.fillStyle = '#091722';
            context.fillRect(-12, engineY - 1.5, 3, 1);
            context.fillRect(-10, engineY + .2, 3, 1);
        }
        context.fillStyle = '#d8e3d3aa';
        context.font = '1.4px Consolas, monospace';
        context.save();
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        context.fillText('ANM-01', -8, 7);
        context.restore();
        context.restore();
    },
    drawMenu(context) {
        context.save();
        const centerX = 686;
        const centerY = 244;
        this.glow(context, centerX, centerY, 230, '#74bdae1a');
        context.translate(centerX, centerY);
        this.ring(context, 158, '#759d9940');
        this.ring(context, 146, '#729b9820');
        context.save();
        context.rotate(this.motionTime * .045);
        context.setLineDash([22, 7, 2, 7]);
        this.ring(context, 151, '#8ecdb733', 2);
        context.restore();
        for (let tick = 0; tick < 48; tick++) {
            const angle = tick / 48 * Math.PI * 2;
            const radius = tick % 4 === 0 ? 165 : 161;
            context.strokeStyle = tick % 4 === 0 ? '#7cb8aa88' : '#7cb8aa33';
            context.beginPath();
            context.moveTo(Math.cos(angle) * 158, Math.sin(angle) * 158);
            context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            context.stroke();
        }
        context.strokeStyle = '#729f9c30';
        context.beginPath();
        context.moveTo(-192, 0); context.lineTo(192, 0);
        context.moveTo(0, -180); context.lineTo(0, 173);
        context.stroke();
        context.restore();
        this.drawCore(context, centerX, centerY + Math.sin(this.motionTime * 1.3) * 3, -.52, 4.6, .3);
        context.strokeStyle = '#7da19f88';
        context.lineWidth = .7;
        context.beginPath();
        context.moveTo(709, 195); context.lineTo(768, 153); context.lineTo(830, 153);
        context.moveTo(621, 284); context.lineTo(582, 330); context.lineTo(550, 330);
        context.stroke();
        context.font = '7px Consolas, monospace';
        context.fillStyle = '#87aaa7';
        context.textAlign = 'right';
        context.fillText('ADAPTIVE ARMOR', 830, 146);
        context.textAlign = 'left';
        context.fillText('PHASE DRIVE', 546, 345);
        context.fillStyle = '#bdd7c644';
        context.font = '8px Consolas, monospace';
        context.fillText('01', 846, 265);
    },
    createEnemySprite(type, color, radius, bossType) {
        const size = Math.ceil(radius * 2 + 34);
        const surface = document.createElement('canvas');
        surface.width = size * 2;
        surface.height = size * 2;
        const context = surface.getContext('2d');
        context.scale(2, 2);
        context.translate(size / 2, size / 2);
        context.fillStyle = '#0007';
        context.beginPath();
        context.ellipse(0, 4, radius + 3, radius * .75, 0, 0, Math.PI * 2);
        context.fill();
        const armor = context.createLinearGradient(0, -radius, 0, radius);
        armor.addColorStop(0, '#58616c');
        armor.addColorStop(.3, '#343d4c');
        armor.addColorStop(1, '#18212e');
        context.strokeStyle = '#0a101c';
        context.lineWidth = 2;
        let points;
        if (bossType === 'juggernaut') {
            points = [[-radius * .7, -radius], [radius * .7, -radius], [radius, -radius * .4], [radius, radius * .4], [radius * .7, radius], [-radius * .7, radius], [-radius, radius * .4], [-radius, -radius * .4]];
        } else if (bossType === 'specter') {
            points = [[0, -radius], [radius * .75, -radius * .35], [radius * .5, radius * .8], [0, radius * .45], [-radius * .5, radius * .8], [-radius * .75, -radius * .35]];
        } else if (bossType === 'entropy_lord') {
            points = [[0, -radius], [radius * .9, radius * .7], [0, radius * .35], [-radius * .9, radius * .7]];
        } else if (type === 'fast') {
            points = [[radius, 0], [-radius * .75, -radius * .7], [-radius * .35, 0], [-radius * .75, radius * .7]];
        } else if (type === 'tank') {
            points = [[-radius * .75, -radius], [radius * .75, -radius], [radius, -radius * .75], [radius, radius * .75], [radius * .75, radius], [-radius * .75, radius], [-radius, radius * .75], [-radius, -radius * .75]];
        } else {
            const sides = type === 'parasite' || bossType === 'swarm_king' ? 12 : type === 'elite' ? 4 : bossType === 'glitch_queen' ? 8 : bossType === 'titan' ? 12 : type === 'boss' ? 6 : 8;
            points = Array.from({length: sides}, (_, index) => {
                const angle = index / sides * Math.PI * 2 - Math.PI / 2;
                const length = (type === 'parasite' || bossType === 'swarm_king' || bossType === 'glitch_queen') && index % 2 ? radius * .6 : radius;
                return [Math.cos(angle) * length, Math.sin(angle) * length];
            });
        }
        this.polygon(context, points);
        context.fillStyle = armor;
        context.fill();
        context.stroke();
        context.lineWidth = .8;
        context.strokeStyle = '#8a9ba266';
        context.stroke();
        context.save();
        context.scale(.78, .78);
        this.polygon(context, points);
        context.strokeStyle = color;
        context.lineWidth = type === 'boss' ? 2 : 1.2;
        context.stroke();
        context.restore();
        if (type === 'tank') {
            context.fillStyle = '#111b26';
            context.fillRect(-radius - 2, -radius * .6, 5, radius * 1.2);
            context.fillRect(radius - 3, -radius * .6, 5, radius * 1.2);
            context.fillStyle = '#81949a';
            context.fillRect(-radius, -radius * .5, 1, radius);
            context.fillRect(radius, -radius * .5, 1, radius);
            context.fillStyle = color;
            for (let slot = 0; slot < 3; slot++) context.fillRect(-6 + slot * 5, -3, 3, 6);
        } else if (type === 'splitter') {
            context.strokeStyle = color;
            context.beginPath();
            context.moveTo(-radius * .6, -radius * .4);
            context.lineTo(0, 0);
            context.lineTo(radius * .6, -radius * .4);
            context.moveTo(0, 0); context.lineTo(0, radius * .7);
            context.stroke();
        } else {
            context.fillStyle = '#080f19';
            context.beginPath();
            context.arc(0, 0, radius * .45, 0, Math.PI * 2);
            context.fill();
            this.glow(context, 0, 0, radius * .6, color + '45');
            context.fillStyle = color;
            if (type === 'fast') this.polygon(context, [[5, 0], [-3, -2], [-3, 2]]);
            else this.polygon(context, [[0, -radius * .22], [radius * .22, 0], [0, radius * .22], [-radius * .22, 0]]);
            context.fill();
            context.fillStyle = '#ffe7d5';
            context.fillRect(-1, -1, 2, 2);
        }
        if (type === 'boss') {
            const gunCount = bossType === 'juggernaut' ? 4 : bossType === 'specter' || bossType === 'entropy_lord' ? 3 : 6;
            for (let gun = 0; gun < gunCount; gun++) {
                context.save();
                context.rotate(gun / gunCount * Math.PI * 2);
                context.fillStyle = '#172331';
                context.fillRect(radius * .5, -5, radius * .5, 10);
                context.fillStyle = color;
                context.fillRect(radius - 2, -3, 3, 6);
                context.restore();
            }
            this.ring(context, radius * .46, '#dbb68a66', 2);
        }
        return { surface, size };
    },
    drawEnemy(context, enemy, playerTarget) {
        const colors = { normal: '#ff7e8b', fast: '#efbe77', tank: '#e79783', elite: '#df8bd2', splitter: '#ff9d73', shielded: '#81bff0', parasite: '#c5d881', phantom: '#adbacf' };
        const color = enemy.type === 'boss' ? enemy.color : colors[enemy.type] || enemy.color;
        let hit = this.hits.get(enemy);
        if (!hit) {
            hit = { hp: enemy.hp, until: 0, radius: enemy.radius };
            this.hits.set(enemy, hit);
        }
        if (enemy.hp < hit.hp) hit.until = this.time + .09;
        hit.hp = enemy.hp;
        const key = `${enemy.type}:${enemy.bossType || ''}:${color}:${hit.radius}`;
        if (!this.sprites.has(key)) this.sprites.set(key, this.createEnemySprite(enemy.type, color, hit.radius, enemy.bossType));
        const sprite = this.sprites.get(key);
        context.save();
        context.translate(enemy.x, enemy.y);
        const angle = Math.atan2(playerTarget.y - enemy.y, playerTarget.x - enemy.x);
        context.rotate(enemy.type === 'boss' && enemy.bossType !== 'juggernaut' ? this.motionTime * .22 : angle);
        const growth = enemy.radius / hit.radius;
        context.scale(growth, growth);
        context.drawImage(sprite.surface, -sprite.size / 2, -sprite.size / 2, sprite.size, sprite.size);
        if (hit.until > this.time) {
            this.ring(context, hit.radius + 1, '#fff4d8', 2);
            this.glow(context, 0, 0, hit.radius + 5, '#ffefc966');
        }
        if (enemy.type === 'shielded' && enemy.shield > 0) {
            this.ring(context, enemy.radius + 4, '#80cfff99', 1.5);
            context.fillStyle = '#80cfff0c';
            context.beginPath(); context.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2); context.fill();
        }
        context.restore();
        if (enemy.type === 'boss') {
            context.save();
            context.translate(enemy.x, enemy.y);
            context.rotate(-this.motionTime * .4);
            context.setLineDash([9, 12]);
            this.ring(context, enemy.radius + 8, color + '88', 1);
            context.restore();
        }
    },
    addBurst(x, y, color, size) {
        if (this.bursts.length >= 48) this.bursts.shift();
        this.bursts.push({ x, y, color, radius: Math.min(85, size * 5), start: this.time });
    },
    drawBursts(context) {
        this.bursts = this.bursts.filter(burst => this.time - burst.start < .4);
        context.save();
        for (const burst of this.bursts) {
            const age = (this.time - burst.start) / .4;
            context.globalAlpha = (1 - age) * .45;
            context.strokeStyle = burst.color;
            context.lineWidth = 1.5 * (1 - age);
            context.beginPath();
            context.arc(burst.x, burst.y, Math.max(1, burst.radius * age), 0, Math.PI * 2);
            context.stroke();
        }
        context.restore();
    }
};
