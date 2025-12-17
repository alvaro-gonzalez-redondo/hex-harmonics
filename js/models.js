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
        this.stepToHexMap = new Map();
        this.tuning = tuningSystem;
        this.listeners = [];
        this.currentSlot = 1;
    }

    subscribe(callback) { this.listeners.push(callback); }
    notify() { this.listeners.forEach(cb => cb(this)); }

    setSlot(slotNumber) {
        if (slotNumber < 1 || slotNumber > 10) return;
        if (this.currentSlot === slotNumber) return;

        this.currentSlot = slotNumber;
        // Notificamos a las vistas para que se redibujen con las notas del nuevo slot
        this.notify();
    }

    addHex(hex) { this.updateHexData(hex, true); }

    updateHexData(hex, isNew = false) {
        const noteIndex = this.tuning.getNoteIndex(hex.q, hex.r);
        const pitchSteps = this.tuning.getPitchSteps(hex.q, hex.r);
        const freq = HarmonicMath.getFrequency(hex.q, hex.r, this.tuning.config, this.tuning.edo);

        let data;
        if (isNew) {
            data = {
                hex,
                // En lugar de un boolean simple, usamos un Set
                activeSlots: new Set()
            };

            // MAGIA: Definimos .active como una propiedad dinámica
            // El resto de la app (Views, Audio) leerá .active y recibirá el estado del slot actual
            Object.defineProperty(data, 'active', {
                get: () => data.activeSlots.has(this.currentSlot),
                                  set: (isActive) => {
                                      if (isActive) data.activeSlots.add(this.currentSlot);
                                      else data.activeSlots.delete(this.currentSlot);
                                  },
                                  enumerable: true,
                                  configurable: true
            });

            this.map.set(hex.toString(), data);
        } else {
            data = this.map.get(hex.toString());
        }

        // Actualizamos propiedades dinámicas
        Object.assign(data, {
            noteIndex,
            pitchSteps,
            freq,
            cachedColor: null,
            harmonicLabel: ""
        });

        this.stepToHexMap.set(pitchSteps, data);
    }

    getHex(hex) { return this.map.get(hex.toString()); }
    getCellBySteps(steps) { return this.stepToHexMap.get(steps); }

    // Buscar celda por frecuencia (para MIDI Microtonal/MPE)
    getClosestCellByFreq(targetFreq) {
        let closestCell = null;
        let minDiff = Infinity;

        // Iteramos todas las celdas activas e inactivas
        for (let cell of this.map.values()) {
            // Diferencia absoluta en Hz (podría ser en cents, pero Hz es suficiente si están cerca)
            const diff = Math.abs(cell.freq - targetFreq);

            // Buscamos la diferencia mínima
            if (diff < minDiff) {
                minDiff = diff;
                closestCell = cell;
            }
        }

        // Umbral de seguridad: Si la nota más cercana está a más de ~50 cents,
        // quizás no deberíamos activarla (opcional, aquí pongo un umbral laxo)
        // 50 cents de error en Hz depende de la altura, pero vamos a confiar en el match más cercano.
        return closestCell;
    }

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

    // Borrar solo las notas del slot actual
    clearCurrentSlot() {
        for (let cell of this.map.values()) {
            cell.activeSlots.delete(this.currentSlot);
        }
        this.notify();
    }

    // Borrar todo (pánico/reset)
    clearAllSlots() {
        for (let cell of this.map.values()) {
            cell.activeSlots.clear();
        }
        this.notify();
    }

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

    recalculate(edo, complexityWeight, bandwidthScale = 1.0) {
        this.edo = parseInt(edo);
        const range = this.edo * 4;
        this.table = new Array(range);

        for (let steps = 0; steps < range; steps++) {
            const ratio = Math.pow(2, steps / this.edo);
            const roughness = HarmonicMath.complexRoughness(ratio, bandwidthScale);

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
