import { EDO_CONFIGS, LIMIT_COLORS } from './config.js';
import { HarmonicMath } from './math.js';

// --- CLASES AUXILIARES ---

export class TuningSystem {
    constructor(edo) { this.setEdo(edo); }

    setEdo(edo) {
        this.edo = parseInt(edo);
        this.config = EDO_CONFIGS[this.edo] || EDO_CONFIGS[12];
        this.whiteKeysSet = new Set(this.config.whiteKeys);
    }

    getNoteIndex(q, r) {
        const rawVal = (q * this.config.qStep) + (r * this.config.rStep);
        return ((rawVal % this.edo) + this.edo) % this.edo;
    }

    getPitchSteps(q, r) {
        return (q * this.config.qStep) + (r * this.config.rStep);
    }

    isWhiteKey(noteIndex) { return this.whiteKeysSet.has(noteIndex); }
}

export class Hex {
    constructor(q, r, s) { this.q = q; this.r = r; this.s = s; }
    equals(b) { return this.q === b.q && this.r === b.r; }
    toString() { return `${this.q},${this.r}`; }
}

export class Layout {
    constructor(size, origin) {
        this.size = size;
        this.origin = origin;
    }

    hexToPixel(h) {
        const x = this.size * (Math.sqrt(3) * h.q + Math.sqrt(3) / 2 * h.r);
        const y = this.size * (3 / 2 * h.r);
        return { x: x + this.origin.x, y: y + this.origin.y };
    }

    pixelToHex(p) {
        const pt = { x: (p.x - this.origin.x) / this.size, y: (p.y - this.origin.y) / this.size };
        const q = (Math.sqrt(3) / 3 * pt.x - 1 / 3 * pt.y);
        const r = (2 / 3 * pt.y);
        return this.hexRound(q, r, -q - r);
    }

    hexRound(fracQ, fracR, fracS) {
        let q = Math.round(fracQ), r = Math.round(fracR), s = Math.round(fracS);
        const q_diff = Math.abs(q - fracQ);
        const r_diff = Math.abs(r - fracR);
        const s_diff = Math.abs(s - fracS);

        if (q_diff > r_diff && q_diff > s_diff) q = -r - s;
        else if (r_diff > s_diff) r = -q - s;
        else s = -q - r;
        return new Hex(q, r, s);
    }
}

// --- CLASE PRINCIPAL: GRID (STATE MANAGER) ---

export class Grid {
    constructor(tuningSystem) {
        this.map = new Map();
        this.tuning = tuningSystem;
        this.listeners = [];
    }

    subscribe(callback) { this.listeners.push(callback); }
    notify() { this.listeners.forEach(cb => cb(this)); }

    addHex(hex) { this.updateHexData(hex, true); }

    updateHexData(hex, isNew = false) {
        const noteIndex = this.tuning.getNoteIndex(hex.q, hex.r);
        const pitchSteps = this.tuning.getPitchSteps(hex.q, hex.r);
        const freq = HarmonicMath.getFrequency(hex.q, hex.r, this.tuning.config, this.tuning.edo);

        const data = isNew ? { hex, active: false } : this.map.get(hex.toString());

        // Actualizamos propiedades dinámicas
        Object.assign(data, {
            noteIndex,
            pitchSteps,
            freq,
            cachedColor: null,
            harmonicLabel: ""
        });

        if(isNew) this.map.set(hex.toString(), data);
    }

    getHex(hex) { return this.map.get(hex.toString()); }

    toggleHex(hex) {
        const cell = this.getHex(hex);
        if (cell) {
            cell.active = !cell.active;
            this.notify();
            return true;
        }
        return false;
    }

    getAll() { return Array.from(this.map.values()); }
    getActiveCells() { return this.getAll().filter(c => c.active); }

    refreshData() {
        for (let [key, cell] of this.map) { this.updateHexData(cell.hex); }
    }

    generateMap(radius) {
        this.map.clear();
        for (let q = -radius; q <= radius; q++) {
            let r1 = Math.max(-radius, -q - radius);
            let r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) { this.addHex(new Hex(q, r, -q - r)); }
        }
        this.notify();
    }
}

// --- LOOK UP TABLE (LUT) ---
// Caché de cálculos pesados
export class HarmonicLUT {
    constructor() { this.table = []; }

    recalculate(edo, complexityWeight) {
        this.edo = parseInt(edo);
        const range = this.edo * 4;
        this.table = new Array(range);

        for (let steps = 0; steps < range; steps++) {
            const ratio = Math.pow(2, steps / this.edo);
            const roughness = HarmonicMath.complexRoughness(ratio);

            // Normalizar a una octava [1, 2)
            let normRatio = ratio;
            while (normRatio >= 2) normRatio /= 2;
            if (normRatio < 1) normRatio = 1;

            const rational = HarmonicMath.getBestRational(normRatio, complexityWeight);

            let data = {
                roughness,
                limit: 0,
                complexity: 10,
                error: 100,
                label: "",
                color: null
            };

            if (rational.match) {
                const limit = Math.max(
                    HarmonicMath.getPrimeLimit(rational.n),
                                       HarmonicMath.getPrimeLimit(rational.d)
                );

                let baseColor = LIMIT_COLORS[limit] || {r:150,g:150,b:150};
                if (limit > 13) baseColor = {r:180, g:180, b:180};

                data.limit = limit;
                data.complexity = HarmonicMath.getComplexity(rational.n, rational.d);
                data.error = rational.error;
                data.label = `${rational.n}/${rational.d}`;
                data.color = baseColor;
            }
            this.table[steps] = data;
        }
    }

    getData(stepsDiff) {
        stepsDiff = Math.abs(stepsDiff);
        if (stepsDiff >= this.table.length) return this.table[this.table.length - 1];
        return this.table[stepsDiff];
    }
}
