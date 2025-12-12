/**
 * CONFIGURACIÓN DE AFINACIÓN (EDO)
 */
const EDO_CONFIGS = {
    12: { name: "12 TET", qStep: 2, rStep: 1, whiteKeys: [0, 2, 4, 5, 7, 9, 11] },
    19: { name: "19 TET", qStep: 3, rStep: 2, whiteKeys: [0, 3, 6, 8, 11, 14, 17] },
    31: { name: "31 TET", qStep: 5, rStep: 3, whiteKeys: [0, 5, 10, 13, 18, 23, 28] },
    53: { name: "53 TET", qStep: 9, rStep: 4, whiteKeys: [0, 9, 18, 22, 31, 40, 49] },
    72: { name: "72 TET", qStep: 12, rStep: 5, whiteKeys: [0, 12, 24, 30, 42, 54, 66] }
};


const w_consonance = 0.55;
const w_clarity = 0.30;
const w_tuning = 0.15;


/**
 * MATH HELPER: Funciones puras (Pesadas)
 * Se usarán solo durante la fase de pre-cálculo.
 */

class HarmonicMath {
    static BASE_FREQ = 261.63; // C4 para cálculos de referencia

    // Onda armónica (tipo semáforo)
    static LIMIT_COLORS = {
        1:  { r:255, g:255, b:255 },    // blanco
        3:  { r:120, g:220, b:120 },    // verde brillante
        5:  { r:255, g:200, b:90  },    // amarillo cálido
        7:  { r:255, g:120, b:90  },    // rojo coral
        11: { r:180, g:100, b:255 },    // púrpura
        13: { r: 90, g:150, b:255 },    // azul intenso
        17:{ r:120, g:120, b:120 }     // gris
    };

    // Fracciones Continuas
    static getBestRational(floatVal, complexityWeight = 2.8, maxDenominator = 2000) {
        let n0 = 0, d0 = 1, n1 = 1, d1 = 0;
        let x = floatVal;
        let candidates = [];

        while (true) {
            let a = Math.floor(x);
            let n2 = a * n1 + n0;
            let d2 = a * d1 + d0;

            if (d2 > maxDenominator) break;

            const currentRatio = n2 / d2;
            const error = Math.abs(1200 * Math.log2(floatVal / currentRatio));
            const complexity = Math.log2(n2 * d2);

            if (n2 * d2 < 50000) {
                candidates.push({ n: n2, d: d2, error: error, complexity: complexity });
            }

            if (error < 0.001) break;

            n0 = n1; d0 = d1;
            n1 = n2; d1 = d2;
            x = 1 / (x - a);
            if (!isFinite(x)) break;
        }

        // Selección basada en peso dinámico
        let bestCandidate = candidates[0];
        let minCost = Infinity;

        for (let cand of candidates) {
            // Penalización suave para límites primos muy altos (>19) para limpiar ruido
            const pLimit = this.getPrimeLimit(Math.max(cand.n, cand.d));
            const limitPenalty = pLimit > 19 ? 15 : 0;

            const cost = cand.error + (cand.complexity * complexityWeight) + limitPenalty;

            if (cost < minCost) {
                minCost = cost;
                bestCandidate = cand;
            }
        }

        // El umbral de match también depende un poco de cuán permisivos seamos
        const matchThreshold = 40 + (complexityWeight * 10);

        return {
            n: bestCandidate.n,
            d: bestCandidate.d,
            error: bestCandidate.error,
            match: minCost < matchThreshold
        };
    }

    static getPrimeLimit(n) {
        if (n === 1) return 1;
        let limit = 1, d = 2, temp = n;
        while (d * d <= temp) {
            while (temp % d === 0) { limit = Math.max(limit, d); temp /= d; }
            d++;
        }
        if (temp > 1) limit = Math.max(limit, temp);
        return limit;
    }

    static getComplexity(n, d) { return Math.log2(n * d); }

    // Plomp-Levelt (Costoso)
    static complexRoughness(ratio) {
        const N = 10;
        const f1 = 261.63;
        const f2 = f1 * ratio;
        let R = 0;

        for (let i = 1; i <= N; i++) {
            for (let j = 1; j <= N; j++) {

                const p1 = f1 * i;
                const p2 = f2 * j;

                const a1 = 1 / (i ** 1.1);
                const a2 = 1 / (j ** 1.1);

                const fMin = Math.min(p1, p2);
                const df = Math.abs(p1 - p2);

                // Critical bandwidth (Plomp–Levelt/Vassilakis hybrid)
                const cbw = 0.24 * (fMin + 25);

                const x = df / cbw;

                const S1 = 3.5;   // empirical
                const S2 = 5.75;  // empirical

                const amplitude = (a1 * a2) ** 0.1;

                const dis = amplitude * (Math.exp(-S1 * x) - Math.exp(-S2 * x));

                R += Math.max(dis, 0);
            }
        }
        return R**2;
    }

    // Helper: Máximo Común Divisor
    static gcd(a, b) {
        return !b ? a : this.gcd(b, a % b);
    }

    /**
     * Genera intervalos JI relevantes dinámicamente.
     * @param {number} maxLimit - Límite primo máximo (ej: 11 o 13)
     * @param {number} maxDenom - Denominador máximo para iterar (controla densidad)
     */
    static generateReferenceIntervals(maxLimit = 13, maxDenom = 24) {
        const intervals = [];

        // Iteramos denominadores y numeradores para cubrir ratio [1.0, 2.0]
        for (let d = 1; d <= maxDenom; d++) {
            for (let n = d; n < d * 2; n++) {
                // 1. Filtrar Reducibles: Solo fracciones irreducibles (ej: saltar 2/2, 4/4)
                if (this.gcd(n, d) !== 1) continue;

                // 2. Filtrar por Límite Primo
                const lN = this.getPrimeLimit(n);
                const lD = this.getPrimeLimit(d);
                const limit = Math.max(lN, lD);

                if (limit > maxLimit) continue;

                // 3. Añadir a la lista
                intervals.push({
                    n: n,
                    d: d,
                    ratioStr: `${n}/${d}`,
                    cents: 1200 * Math.log2(n / d),
                               limit: limit,
                               color: this.LIMIT_COLORS[limit] || {r:100,g:100,b:100}
                });
            }
        }

        // Añadir la Octava (2/1) manualmente ya que el loop es n < d*2
        intervals.push({
            n: 2, d: 1, ratioStr: "2/1", cents: 1200, limit: 1, color: this.LIMIT_COLORS[1]
        });

        // Ordenar por cents
        return intervals.sort((a, b) => a.cents - b.cents);
    }

    static getFrequency(q, r, edoConfig, edo) {
        // Fórmula: Frecuencia Base * 2^(pasos / edo)
        const pitchSteps = (q * edoConfig.qStep) + (r * edoConfig.rStep);
        return this.BASE_FREQ * Math.pow(2, pitchSteps / edo);
    }
}

/**
 * Almacena los datos precalculados para cada paso del EDO.
 */
class HarmonicLUT {
    constructor() {
        this.table = [];
        this.edo = 12;
    }

    recalculate(edo, complexityWeight) {
        this.edo = parseInt(edo);
        const range = this.edo * 4;
        this.table = new Array(range);

        for (let steps = 0; steps < range; steps++) {
            const ratio = Math.pow(2, steps / this.edo);
            const roughness = HarmonicMath.complexRoughness(ratio);

            let normRatio = ratio;
            while (normRatio >= 2) normRatio /= 2;
            if (normRatio < 1) normRatio = 1;

            // Pasamos el peso al buscador racional
            const rational = HarmonicMath.getBestRational(normRatio, complexityWeight);

            let data = {
                roughness: roughness,
                limit: 0,
                complexity: 10,
                error: 100,
                label: "",
                color: null
            };

            if (rational.match) {
                const limitN = HarmonicMath.getPrimeLimit(rational.n);
                const limitD = HarmonicMath.getPrimeLimit(rational.d);
                const limit = Math.max(limitN, limitD);

                data.limit = limit;
                data.complexity = HarmonicMath.getComplexity(rational.n, rational.d);
                data.error = rational.error;
                data.label = `${rational.n}/${rational.d}`;

                let baseColor = HarmonicMath.LIMIT_COLORS[limit] || {r:150,g:150,b:150};
                if (limit > 13) baseColor = {r:180, g:180, b:180};
                data.color = baseColor;
            }

            this.table[steps] = data;
        }
    }

    getData(stepsDiff) {
        if (stepsDiff < 0) stepsDiff = -stepsDiff;
        if (stepsDiff >= this.table.length) return this.table[this.table.length - 1];
        return this.table[stepsDiff];
    }
}


// --- CLASES VISUALES (Simplificadas gracias a la LUT) ---

function lerpColor(c1, c2, t) {
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
}
function rgbToString(c) { return `rgb(${c.r},${c.g},${c.b})`; }

class TuningSystem {
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
    // Para la LUT necesitamos el valor absoluto lineal (pitch height)
    getPitchSteps(q, r) {
        return (q * this.config.qStep) + (r * this.config.rStep);
    }
    isWhiteKey(noteIndex) { return this.whiteKeysSet.has(noteIndex); }
}

class Hex {
    constructor(q, r, s) { this.q = q; this.r = r; this.s = s; }
    equals(b) { return this.q === b.q && this.r === b.r; }
    toString() { return `${this.q},${this.r}`; }
}

class Layout {
    constructor(size, origin) { this.size = size; this.origin = origin; }
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
        const q_diff = Math.abs(q - fracQ), r_diff = Math.abs(r - fracR), s_diff = Math.abs(s - fracS);
        if (q_diff > r_diff && q_diff > s_diff) q = -r - s;
        else if (r_diff > s_diff) r = -q - s;
        else s = -q - r;
        return new Hex(q, r, s);
    }
}

class Grid {
    constructor(tuningSystem) {
        this.map = new Map();
        this.tuning = tuningSystem;
        this.listeners = []; // Lista de suscriptores
    }

    // --- Patrón Observador ---
    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        this.listeners.forEach(callback => callback(this));
    }
    // -------------------------

    addHex(hex) { this.updateHexData(hex, true); }

    updateHexData(hex, isNew = false) {
        const noteIndex = this.tuning.getNoteIndex(hex.q, hex.r);

        // Pasos lineales (para la LUT y visualización)
        const pitchSteps = this.tuning.getPitchSteps(hex.q, hex.r);

        // Frecuencia en Hz (para el SINTETIZADOR) <--- ESTO FALTABA
        const freq = HarmonicMath.getFrequency(hex.q, hex.r, this.tuning.config, this.tuning.edo);

        const data = isNew ? { hex, active: false } : this.map.get(hex.toString());

        data.noteIndex = noteIndex;
        data.pitchSteps = pitchSteps;
        data.freq = freq; // <--- Guardamos la frecuencia
        data.cachedColor = null;
        data.harmonicLabel = "";

        if(isNew) this.map.set(hex.toString(), data);
    }

    getHex(hex) { return this.map.get(hex.toString()); }

    toggleHex(hex) {
        const cell = this.getHex(hex);
        if (cell) {
            cell.active = !cell.active;
            this.notify(); // <--- Notificar cambio de estado
            return true;
        }
        return false;
    }

    getAll() { return Array.from(this.map.values()); }
    getActiveCells() { return this.getAll().filter(c => c.active); }

    refreshData() {
        for (let [key, cell] of this.map) { this.updateHexData(cell.hex); }
        // No notificamos aquí porque refreshData suele ir seguido de un cambio en el renderer manual
    }

    generateMap(radius) {
        this.map.clear();
        for (let q = -radius; q <= radius; q++) {
            let r1 = Math.max(-radius, -q - radius);
            let r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) { this.addHex(new Hex(q, r, -q - r)); }
        }
        this.notify(); // Notificar mapa nuevo
    }
}

class Renderer {
    constructor(canvasId, layout, grid) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.layout = layout;
        this.grid = grid;
        this.hoveredHex = null;
        this.sensitivity = 80;
        this.complexityWeight = 10.0; // Valor inicial

        this.lut = new HarmonicLUT();
        // Inicializar LUT con peso
        this.lut.recalculate(this.grid.tuning.edo, this.complexityWeight);

        this.initLegend();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));

        this.recalculateHeatmap();
        this.draw();
    }

    initLegend() {
        const legend = document.getElementById('legend');
        legend.innerHTML = "<strong>Límites Primos</strong>";
        const limits = [1, 3, 5, 7, 11, 13, 17];
        const labels = { 1: "Octava", 3: "3 (5tas)", 5: "5 (3ras)", 7: "7 (Harm)", 11: "11 (Neutro)", 13: "13", 17: ">13" };
        limits.forEach(l => {
            const color = HarmonicMath.LIMIT_COLORS[l] || HarmonicMath.LIMIT_COLORS[17];
            const row = document.createElement('div');
            row.className = 'legend-item';
            const box = document.createElement('div');
            box.className = 'color-box';
            box.style.backgroundColor = rgbToString(color);
            const txt = document.createElement('span');
            txt.innerText = labels[l] || `Lim ${l}`;
            row.appendChild(box);
            row.appendChild(txt);
            legend.appendChild(row);
        });
    }

    // Método para manejar el cambio de peso
    setComplexityWeight(val) {
        this.complexityWeight = parseFloat(val);
        // Recalcular LUT porque las identidades de las notas pueden cambiar
        this.lut.recalculate(this.grid.tuning.edo, this.complexityWeight);
        // Refrescar visualización
        this.recalculateHeatmap();
        this.draw();
    }

    // ... resize, mouse events, setSensitivity ...
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.layout.origin = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        this.draw();
    }
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const hexPos = this.layout.pixelToHex({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const cell = this.grid.getHex(hexPos);
        const prevHover = this.hoveredHex;
        this.hoveredHex = cell || null;
        if (prevHover !== this.hoveredHex) { this.updateUI(); this.draw(); }
    }
    handleMouseDown(e) {
        if (this.hoveredHex) {
            this.grid.toggleHex(this.hoveredHex.hex);
            this.recalculateHeatmap();
            this.draw();
        }
    }
    setSensitivity(val) {
        this.sensitivity = Math.max(1, parseInt(val)); // evitar 0
        this.recalculateHeatmap();
        this.draw();
    }

    updateUI() {
        const ui = document.getElementById('cellInfo');
        if (this.hoveredHex) {
            let info = `<strong>Nota:</strong> ${this.hoveredHex.noteIndex}<br>`;
            if (this.hoveredHex.harmonicLabel) {
                info += `<strong>Intervalo:</strong> ${this.hoveredHex.harmonicLabel}`;
            }
            ui.innerHTML = info;
        } else {
            ui.innerHTML = "Click para activar notas.";
        }
    }

    // --- CORAZÓN OPTIMIZADO ---
    recalculateHeatmap() {
        const activeCells = this.grid.getActiveCells();
        const cells = this.grid.getAll();
        const gain = this.sensitivity / 10;

        cells.forEach(c => { c.cachedColor = null; c.harmonicLabel = ""; });
        if (activeCells.length === 0) return;

        cells.forEach(target => {
            if (target.active) return;
            const isWhite = this.grid.tuning.isWhiteKey(target.noteIndex);
            // Base un poco más oscura para que el contraste de calidad sea evidente
            //const baseColor = isWhite ? {r:80, g:100, b:120} : {r:40, g:50, b:60};
            const baseColor = {r:0, g:0, b:0};

            let totalRoughness = 0;
            let bestIntervalData = null;
            let minComplexity = 999;

            activeCells.forEach(source => {
                const diffSteps = Math.abs(target.pitchSteps - source.pitchSteps);
                const lutData = this.lut.getData(diffSteps);
                totalRoughness += lutData.roughness;
                if (lutData.limit > 0 && lutData.complexity < minComplexity) {
                    minComplexity = lutData.complexity;
                    bestIntervalData = lutData;
                }
            });

            if (bestIntervalData) {
                // Mostrar error en la etiqueta para referencia
                const errorStr = bestIntervalData.error.toFixed(1);
                target.harmonicLabel = `${bestIntervalData.label} (Err: ${errorStr}¢)`;
            }

            // --- CÁLCULO DE 'CALIDAD' VISUAL ---

            // 1. Consonancia Física (0.0 a 1.0)
            const consonance = 1 / (1 + (totalRoughness * (6 / gain)));
            let finalColor = baseColor;

            if (bestIntervalData && bestIntervalData.color) {
                const alpha = 0.15; // puedes ajustarlo
                const clarity = Math.exp(-alpha * bestIntervalData.complexity);
                const MAX_TOLERANCE_CENTS = 20;
                let tuningAccuracy = 1 - (bestIntervalData.error / MAX_TOLERANCE_CENTS);
                tuningAccuracy = Math.max(0, Math.min(1, tuningAccuracy));

                // --- MEZCLA FINAL ---
                // La fuerza del color depende de las 3 variables.
                //const harmonicStrength = clarity * Math.max(consonance, 0.3) * tuningAccuracy;

                const f1 = Math.log(clarity + 1e-6);
                const f2 = Math.log(consonance + 1e-6);
                const f3 = Math.log(tuningAccuracy + 1e-6);

                const logBlend =
                w_clarity * f1 +
                w_consonance * f2 +
                w_tuning * f3;

                const harmonicStrength = Math.exp(logBlend);

                finalColor = lerpColor(baseColor, bestIntervalData.color, harmonicStrength);
            } else {
                finalColor = lerpColor(baseColor, {r:60, g:20, b:20}, 1 - consonance);
            }

            target.cachedColor = {
                r: Math.max(0, Math.min(255, finalColor.r)),
                      g: Math.max(0, Math.min(255, finalColor.g)),
                      b: Math.max(0, Math.min(255, finalColor.b))
            };
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#1a1a1a";
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
        const cells = this.grid.getAll();

        for (const cell of cells) {
            const center = this.layout.hexToPixel(cell.hex);
            const isHover = this.hoveredHex === cell;

            // Renderizado (optimizado al usar cachedColor)
            let fillColorObj, strokeColor="#555", textColor="#aaa";

            if (cell.active) {
                fillColorObj = {r: 255, g: 255, b: 255};
                strokeColor = "#fff"; textColor = "#F33";
            } else if (cell.cachedColor) {
                fillColorObj = cell.cachedColor;
                const b = (fillColorObj.r+fillColorObj.g+fillColorObj.b)/3;
                textColor = b > 100 ? "#222" : "#ccc";
            } else {
                const isWhite = this.grid.tuning.isWhiteKey(cell.noteIndex);
                if (isWhite) { fillColorObj = {r: 100, g: 100, b: 120}; textColor = "#222"; }
                else { fillColorObj = {r: 50, g: 50, b: 60}; textColor = "#888"; }
            }

            if (isHover && !cell.active) {
                fillColorObj = lerpColor(fillColorObj, {r:52, g:152, b:219}, 0.5); textColor = "#fff";
            }

            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (60 * i - 30) * Math.PI / 180;
                const x = center.x + this.layout.size * Math.cos(angle);
                const y = center.y + this.layout.size * Math.sin(angle);
                if (i===0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
            }
            this.ctx.closePath();
            this.ctx.fillStyle = rgbToString(fillColorObj);
            this.ctx.fill();
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = cell.active ? 3 : 1;
            this.ctx.stroke();

            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.font = cell.active ? "bold 14px Arial" : "12px Arial";
            this.ctx.fillText(cell.noteIndex, center.x, center.y);

            if (cell.noteIndex === 0) {
                this.ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(center.x - 4, center.y + 8, 8, 2);
            }
        }
    }
}


class LinearVisualizer {
    constructor(canvasId, grid) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.grid = grid;

        this.margin = 30;

        // Generación Algorítmica de Fondo (Una sola vez)
        // maxDenom=32 genera suficientes intervalos para referencia sin saturar
        this.backgroundIntervals = HarmonicMath.generateReferenceIntervals(13, 32);

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // --- SUSCRIPCIÓN ELEGANTE ---
        // Cuando el grid notifique cambio, nos redibujamos
        this.grid.subscribe(() => this.draw());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    centsToX(cents) {
        const usableWidth = this.canvas.width - (this.margin * 2);
        return this.margin + (cents / 1200) * usableWidth;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        // 1. DIBUJAR FONDO (Intervalos generados)
        this.backgroundIntervals.forEach(marker => {
            const x = this.centsToX(marker.cents);

            // Altura dinámica basada en complejidad (simplicidad)
            // Fracciones más simples (d y n bajos) tienen líneas más altas
            const complexity = marker.n * marker.d;
            let lineScale = 1 - (Math.min(complexity, 300) / 300); // 0.0 a 1.0 aprox
            // Boost para límites bajos
            if (marker.limit <= 3) lineScale = 1.0;

            const lineH = h * (0.3 + 0.5 * lineScale); // Mínimo 30%, Máximo 80%

            const c = marker.color;
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.3)`;
            ctx.fillRect(x - 1, h - lineH, 2, lineH);

            // Etiquetas solo para los muy importantes
            //if (complexity < 20 || marker.limit <= 5) {
            if (complexity < 100 || marker.limit <= 5) {
                ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.7)`;
                ctx.font = "10px monospace";
                ctx.textAlign = "center";
                ctx.fillText(marker.ratioStr, x, h - lineH - 5);
            }
        });

        // Eje
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.margin, h - 20);
        ctx.lineTo(w - this.margin, h - 20);
        ctx.stroke();

        // 2. DIBUJAR EDO ACTUAL
        const edo = this.grid.tuning.edo;
        ctx.fillStyle = "#444";
        for (let i = 0; i <= edo; i++) {
            const cents = (i / edo) * 1200;
            const x = this.centsToX(cents);
            ctx.fillRect(x - 0.5, h - 25, 1, 8);
        }

        // 3. INTERVALOS ACTIVOS
        const activeCells = this.grid.getActiveCells();
        if (activeCells.length === 0) return;

        const root = activeCells[0];
        const rootSteps = root.pitchSteps;

        activeCells.forEach(cell => {
            let diffSteps = Math.abs(cell.pitchSteps - rootSteps);
            diffSteps = diffSteps % edo;

            const centsEDO = (diffSteps / edo) * 1200;
            const xEDO = this.centsToX(centsEDO);

            // Marcador EDO
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(xEDO, h - 20, 4, 0, Math.PI*2);
            ctx.fill();

            // Análisis al vuelo para la línea de conexión
            const ratioVal = Math.pow(2, centsEDO / 1200);
            const rational = HarmonicMath.getBestRational(ratioVal == 1 ? 1 : ratioVal, 2.5);

            if (rational.match) {
                const jiCents = 1200 * Math.log2(rational.n / rational.d);
                const xJI = this.centsToX(jiCents);

                const limitN = HarmonicMath.getPrimeLimit(rational.n);
                const limitD = HarmonicMath.getPrimeLimit(rational.d);
                const limit = Math.max(limitN, limitD);
                const c = HarmonicMath.LIMIT_COLORS[limit] || {r:200,g:200,b:200};

                ctx.strokeStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xEDO, h - 20);
                ctx.lineTo(xJI, h - 60);
                ctx.stroke();

                ctx.fillStyle = "#fff";
                ctx.font = "bold 12px Arial";
                ctx.fillText(`${rational.n}/${rational.d}`, xJI, h - 65);

                const error = (centsEDO - jiCents).toFixed(1);
                ctx.fillStyle = Math.abs(error) > 15 ? "#e74c3c" : "#aaa";
                ctx.font = "10px monospace";
                ctx.fillText(`${error > 0 ? '+' : ''}${error}¢`, xEDO, h - 35);
            }
        });
    }
}


/**
 * MOTOR DE AUDIO MEJORADO (Síntesis Aditiva)
 */
class Synth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.customWave = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // 1. Crear Forma de Onda Personalizada (Síntesis Aditiva)
            // Esto nos da un sonido "orgánico" con armónicos precisos para la roughness
            const numHarmonics = 32;
            const real = new Float32Array(numHarmonics);
            const imag = new Float32Array(numHarmonics);

            // Diseño del Timbre (Tipo Piano Eléctrico / Órgano Suave)
            // real[n] son los cosenos (fase), imag[n] son los senos (amplitud)
            // n=1 es la fundamental, n=2 la octava, etc.

            imag[0] = 0; // DC Offset (siempre 0)
            imag[1] = 1.0;  // Fundamental (Cuerpo)
            imag[2] = 0.5;  // 2º Armónico (Octava - Calidez)
            imag[3] = 0.3;  // 3º Armónico (Quinta - Color)
            imag[4] = 0.20; // 4º Armónico
            imag[5] = 0.15; // 5º Armónico (Vital para detectar 3ras mayores)

            // El resto de armónicos decaen suavemente para quitar lo "áspero"
            for (let i = 6; i < numHarmonics; i++) {
                imag[i] = 0.4 / Math.pow(i, 1.5); // Caída exponencial suave
            }

            this.customWave = this.ctx.createPeriodicWave(real, imag);

            // 2. Cadena de Audio
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.25; // Un poco más bajo ya que la onda es rica

            // Filtro Paso Bajo (Lowpass) suave para "redondear" el brillo final
            const filter = this.ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = 3500; // Cortar brillo excesivo
            filter.Q.value = 0.5;

            // Compresor (Limiter)
            const compressor = this.ctx.createDynamicsCompressor();
            compressor.threshold.value = -12;
            compressor.knee.value = 30;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.005;
            compressor.release.value = 0.25;

            this.masterGain.connect(filter);
            filter.connect(compressor);
            compressor.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, startTime, duration) {
        if (!this.ctx) this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Usar nuestra onda personalizada en lugar de 'triangle'
        osc.setPeriodicWave(this.customWave);
        osc.frequency.value = freq;

        // ENVOLVENTE MEJORADA (Más natural, tipo campana/piano)
        // Evitamos clicks y damos sensación percusiva suave

        // 1. Reset
        gain.gain.setValueAtTime(0, startTime);

        // 2. Ataque muy rápido pero no instantáneo (evita "pop")
        const attackTime = 0.02;
        gain.gain.linearRampToValueAtTime(0.6, startTime + attackTime);

        // 3. Decaimiento natural hacia un sustain
        const decayTime = 0.3;
        const sustainLevel = 0.3;
        gain.gain.exponentialRampToValueAtTime(sustainLevel, startTime + attackTime + decayTime);

        // 4. Release final (Fade out)
        // Comenzamos el release un poco antes de que acabe la nota lógica
        const releaseStart = startTime + duration - 0.15;
        // Nos aseguramos de que el release no empiece antes del decay
        const safeRelease = Math.max(releaseStart, startTime + attackTime + decayTime);

        gain.gain.setValueAtTime(sustainLevel, safeRelease);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.1); // Un poco de margen para el release
    }

    playChord(cells) {
        this.init();
        const now = this.ctx.currentTime;
        // Ajuste de volumen para acordes densos
        const volAdjustment = 1 / Math.sqrt(cells.length || 1);
        // Aplicamos el ajuste al Master temporalmente o lo gestionamos en el gain de nota
        // Aquí lo gestionamos implícitamente gracias al Compresor,
        // pero podemos reducir la duración para que no saturen.

        cells.forEach(cell => {
            this.playTone(cell.freq, now, 1.0); // Notas más largas en acordes para apreciar el batido
        });
    }

    playArpeggio(cells) {
        this.init();
        const now = this.ctx.currentTime;
        const sortedCells = [...cells].sort((a, b) => a.freq - b.freq);

        sortedCells.forEach((cell, index) => {
            const time = now + (index * 0.25);
            // Notas de arpegio un poco más cortas y percusivas
            this.playTone(cell.freq, time, 0.5);
        });
    }
}

// Función helper para obtener notas activas
function getActiveNotes() {
    const active = grid.getActiveCells();
    if (active.length === 0) {
        // Feedback visual si no hay notas
        alert("Selecciona algunas notas primero (haz clic en los hexágonos).");
        return null;
    }
    return active;
}


// INICIALIZACIÓN

// 1. FORZAR ESTADO INICIAL DE LA UI (Para evitar caché del navegador al recargar)
const uiSelect = document.getElementById('edoSelect');
const uiSensSlider = document.getElementById('sensSlider');
const uiCompSlider = document.getElementById('complexitySlider');

uiSelect.value = "12";         // Forzar a 12 TET
uiSensSlider.value = "80";     // Valor por defecto en Renderer
uiCompSlider.value = "10";    // Valor por defecto en Renderer

const hexSize = 25;
const mapRadius = 16;
//const origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 - 60 }; // Subimos un poco el centro del hex


// 1. Setup
const tuning = new TuningSystem(12);
const layout = new Layout(hexSize, origin);
const grid = new Grid(tuning); // Grid es el State Manager
grid.generateMap(mapRadius);

// 2. Componentes (Se suscriben internamente al Grid)
const renderer = new Renderer('hexCanvas', layout, grid);
const linearViz = new LinearVisualizer('linearCanvas', grid);
const synth = new Synth();

// Suscripción explícita del Renderer (si no lo hiciste dentro de su clase)
grid.subscribe(() => {
    renderer.recalculateHeatmap();
    renderer.draw();
});

// 3. Eventos UI (Solo actualizan el Modelo, la Vista reacciona sola)
document.getElementById('edoSelect').addEventListener('change', (e) => {
    const newEdo = e.target.value;
    tuning.setEdo(newEdo);

    // Recalcular LUT (Propiedad del Renderer para optimización)
    renderer.lut.recalculate(newEdo, renderer.complexityWeight);

    grid.refreshData(); // Esto no disparaba notify en mi código anterior, añadelo o llama notify manual
    // grid.notify(); // Si refreshData no notifica

    // Como refreshData cambia datos internos pero no estructura,
    // a veces es mejor forzar el redibujado completo.
    renderer.recalculateHeatmap();
    renderer.draw();
    linearViz.draw();
});

// El resto de sliders (sensibilidad, complejidad) son cambios de 'View', no de 'Model'
// así que siguen llamando a métodos del renderer.

document.getElementById('sensSlider').addEventListener('input', (e) => {
    renderer.setSensitivity(e.target.value);
});

document.getElementById('complexitySlider').addEventListener('input', (e) => {
    renderer.setComplexityWeight(e.target.value);
});


// --- GESTOR DE ESTADO DE AUDIO ---

let arpTimeout = null;      // Referencia al timer para poder cancelarlo
let isArpActive = false;    // Estado lógico del arpegio

// Función de limpieza robusta
function stopAudio() {
    if (arpTimeout) {
        clearTimeout(arpTimeout);
        arpTimeout = null;
    }
    isArpActive = false;
}

// Bucle de Arpegio Dinámico
function runArpeggioLoop() {
    if (!isArpActive) return;

    // 1. Consultar estado ACTUAL del grid en cada vuelta
    const notes = grid.getActiveCells();

    // Si el usuario desactivó todas las notas mientras sonaba, paramos
    if (!notes || notes.length === 0) {
        stopAudio();
        return;
    }

    // 2. Reproducir
    synth.playArpeggio(notes);

    // 3. Calcular duración basada en las notas ACTUALES
    // (Si añadiste notas, el ciclo será más largo; si quitaste, más corto)
    const stepTime = 250;
    const loopDuration = notes.length * stepTime;

    // 4. Programar siguiente vuelta
    arpTimeout = setTimeout(runArpeggioLoop, loopDuration);
}

// --- EVENTOS UI ---

// Botones
document.getElementById('btnChord').addEventListener('click', () => {
    const notes = grid.getActiveCells();
    if (notes.length > 0) synth.playChord(notes);
});

document.getElementById('btnArp').addEventListener('click', () => {
    stopAudio(); // Reset por seguridad
    const notes = grid.getActiveCells();
    if (notes.length > 0) synth.playArpeggio(notes);
});

// Selector de EDO (Modificado para limpiar audio)
document.getElementById('edoSelect').addEventListener('change', (e) => {
    stopAudio(); // <--- IMPORTANTE: Detiene cualquier sonido al cambiar sistema

    const newEdo = e.target.value;
    tuning.setEdo(newEdo);
    renderer.lut.recalculate(newEdo, renderer.complexityWeight);
    grid.refreshData();
    renderer.recalculateHeatmap();
    renderer.draw();
    linearViz.draw();
});

// Seguridad: Parar audio si el usuario cambia de pestaña o minimiza
window.addEventListener('blur', () => {
    stopAudio();
});

// --- EVENTOS DE TECLADO ---

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.repeat) return; // Ignorar repetición de tecla del SO

    if (e.code === 'Space') {
        e.preventDefault();
        const notes = grid.getActiveCells();
        if (!notes || notes.length === 0) return;

        if (e.shiftKey) {
            // MODO ARPEGIO (LOOP)
            if (!isArpActive) {
                isArpActive = true;
                runArpeggioLoop(); // Iniciar bucle recursivo
            }
        } else {
            // MODO ACORDE (ONE SHOT)
            synth.playChord(notes);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        // Al soltar espacio, cortamos el bucle del arpegio
        stopAudio();
    }
});
