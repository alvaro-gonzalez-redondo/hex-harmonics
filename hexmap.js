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

/*
    // Colores originales de Gemini
    static LIMIT_COLORS = {
        1:  { r: 255, g: 255, b: 255 },
        3:  { r: 234, g: 158, b: 92  },
        5:  { r: 167, g: 188, b: 95  },
        7:  { r: 62,  g: 202, b: 180 },
        11: { r: 97,  g: 187, b: 247 },
        13: { r: 189, g: 159, b: 243 }
    };
*/
/*
    // RGBs puros
    static LIMIT_COLORS = {
        1:  { r: 255, g: 255, b: 255 },
        3:  { r: 255, g: 0, b: 0},
        5:  { r: 0, g: 255, b: 0},
        7:  { r: 0,  g: 0, b: 255},
        11: { r: 255,  g: 255, b: 0 },
        13: { r: 255, g: 0, b: 255 },
        17: { r: 128, g: 128, b: 128 }
    };
*/
/*
    // Harmonic Hue Gradient
    static LIMIT_COLORS = {
        1:  { r:255, g:255, b:255 },   // Pureza (unísono/octava)
        3:  { r:255, g:170, b:90  },   // Quinta → naranja ambar
        5:  { r:240, g:210, b:70  },   // Tercera → dorado
        7:  { r:140, g:200, b:120 },   // Séptima nat. → verde suave
        11: { r:100, g:180, b:240 },   // Undécima → azul claro
        13: { r:175, g:140, b:230 },   // Decimotercera → lavanda
        17: { r:150, g:150, b:160 }    // >13 → gris violáceo
    };
*/

/*
    // OKLab / HSLuv mapped to RGB
    static LIMIT_COLORS = {
        1:  { r:255, g:255, b:255 },   // blanco
        3:  { r:230, g:150, b:120 },   // coral
        5:  { r:230, g:200, b:120 },   // arena
        7:  { r:160, g:210, b:140 },   // verde natural
        11: { r:120, g:190, b:220 },   // azul suave
        13: { r:170, g:150, b:220 },   // violeta humo
        17: { r:140, g:140, b:140 }    // gris
    };
*/
/*
    // Onda armónica
    static LIMIT_COLORS = {
        1:  { r:255, g:255, b:255 },    // blanco
        3:  { r:255, g:120, b:90  },    // rojo coral
        5:  { r:255, g:200, b:90  },    // amarillo cálido
        7:  { r:120, g:220, b:120 },    // verde brillante
        11:{ r: 90, g:150, b:255 },    // azul intenso
        13:{ r:180, g:100, b:255 },    // púrpura
        17:{ r:120, g:120, b:120 }     // gris
    };
*/
    // Onda armónica (semáforo)
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
    }
    addHex(hex) { this.updateHexData(hex, true); }
    updateHexData(hex, isNew = false) {
        const noteIndex = this.tuning.getNoteIndex(hex.q, hex.r);
        // Guardamos el valor lineal absoluto de pasos para buscar en la LUT rápidamente
        const pitchSteps = this.tuning.getPitchSteps(hex.q, hex.r);

        const data = isNew ? { hex, active: false } : this.map.get(hex.toString());
        data.noteIndex = noteIndex;
        data.pitchSteps = pitchSteps; // Dato clave para la LUT
        data.cachedColor = null;
        data.harmonicLabel = "";
        if(isNew) this.map.set(hex.toString(), data);
    }
    getHex(hex) { return this.map.get(hex.toString()); }
    toggleHex(hex) {
        const cell = this.getHex(hex);
        if (cell) { cell.active = !cell.active; return true; }
        return false;
    }
    getAll() { return Array.from(this.map.values()); }
    getActiveCells() { return this.getAll().filter(c => c.active); }
    refreshData() { for (let [key, cell] of this.map) { this.updateHexData(cell.hex); } }
    generateMap(radius) {
        this.map.clear();
        for (let q = -radius; q <= radius; q++) {
            let r1 = Math.max(-radius, -q - radius);
            let r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) { this.addHex(new Hex(q, r, -q - r)); }
        }
    }
}

class Renderer {
    constructor(canvasId, layout, grid) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.layout = layout;
        this.grid = grid;
        this.hoveredHex = null;
        this.sensitivity = 5;
        this.complexityWeight = 8.0; // Valor inicial

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

/**
 * DATOS DE REFERENCIA PARA LA BARRA LINEAL
 * Selección de intervalos comunes para pintar el "fondo" del gráfico.
 */
const REFERENCE_JI = [
    { n:1, d:1 }, // Unison
{ n:16, d:15 }, { n:15, d:14 }, // Semitonos
{ n:9, d:8 }, { n:10, d:9 }, { n:8, d:7 }, // Segundas
{ n:6, d:5 }, { n:7, d:6 }, // 3ras menores
{ n:5, d:4 }, { n:9, d:7 }, // 3ras mayores
{ n:4, d:3 }, { n:11, d:8 }, // 4tas
{ n:7, d:5 }, { n:10, d:7 }, { n:45, d:32 }, // Tritonos
{ n:3, d:2 }, // 5ta
{ n:8, d:5 }, { n:14, d:9 }, // 6tas menores
{ n:5, d:3 }, { n:12, d:7 }, // 6tas mayores
{ n:7, d:4 }, { n:16, d:9 }, { n:9, d:5 }, // 7mas menores
{ n:15, d:8 }, // 7ma mayor
{ n:2, d:1 } // Octava
];

// Pre-calcular cents y límites para la referencia estática
const JI_MARKERS = REFERENCE_JI.map(r => {
    const limitN = HarmonicMath.getPrimeLimit(r.n);
    const limitD = HarmonicMath.getPrimeLimit(r.d);
    return {
        ratioStr: `${r.n}/${r.d}`,
        cents: 1200 * Math.log2(r.n / r.d),
                                    limit: Math.max(limitN, limitD),
                                    color: HarmonicMath.LIMIT_COLORS[Math.max(limitN, limitD)] || {r:100,g:100,b:100}
    };
});

/**
 * VISUALIZADOR LINEAL (La barra inferior)
 */
class LinearVisualizer {
    constructor(canvasId, grid) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.grid = grid;

        // Configuración visual
        this.margin = 30; // Margen lateral
        this.height = 120;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Ajustar al contenedor padre
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    // Convierte Cents (0-1200) a posición X en pixels
    centsToX(cents) {
        const usableWidth = this.canvas.width - (this.margin * 2);
        return this.margin + (cents / 1200) * usableWidth;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        // 1. DIBUJAR FONDO (Regla JI)
        // Dibujamos líneas para cada intervalo Justo conocido
        JI_MARKERS.forEach(marker => {
            const x = this.centsToX(marker.cents);

            // Altura de la línea según importancia (Límite bajo = línea más alta)
            // Lim 3: 100% altura, Lim 5: 70%, Lim 7: 50%...
            let lineH = h * 0.4;
            if (marker.limit === 3) lineH = h * 0.8;
            else if (marker.limit === 5) lineH = h * 0.6;
            else if (marker.limit === 7) lineH = h * 0.5;

            // Color con transparencia baja para que sea fondo
            const c = marker.color;
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.3)`;
            ctx.fillRect(x - 1, h - lineH, 2, lineH);

            // Etiqueta solo para límites bajos para no saturar
            if (marker.limit <= 11) {
                ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`;
                ctx.font = "10px monospace";
                ctx.textAlign = "center";
                ctx.fillText(marker.ratioStr, x, h - lineH - 5);
            }
        });

        // Eje horizontal
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.margin, h - 20);
        ctx.lineTo(w - this.margin, h - 20);
        ctx.stroke();

        // 2. DIBUJAR EDO ACTUAL (Marcas grises)
        const edo = this.grid.tuning.edo;
        ctx.fillStyle = "#444";
        for (let i = 0; i <= edo; i++) {
            const cents = (i / edo) * 1200;
            const x = this.centsToX(cents);
            ctx.fillRect(x - 1, h - 25, 2, 10); // Pequeños ticks abajo
        }

        // 3. DIBUJAR INTERVALOS ACTIVOS
        // Recuperamos qué está sonando en el hexágono
        const activeCells = this.grid.getActiveCells();
        if (activeCells.length === 0) return;

        // Tomamos la primera nota activa como "Fundamental" (0 cents) para simplificar visualización
        // O si preferimos, mostramos todos relativos entre sí.
        // ESTRATEGIA: Para cada par activo, pintamos el intervalo.

        // Vamos a visualizar los intervalos relativos a la primera nota activa encontrada
        // (asumiendo que esa actúa de tónica temporal)
        const root = activeCells[0];
        const rootSteps = root.pitchSteps;

        activeCells.forEach(cell => {
            // Calcular intervalo relativo en cents
            // Usamos modulo para mantenerlo en una octava
            let diffSteps = Math.abs(cell.pitchSteps - rootSteps);
            // Normalizar a una octava (simple)
            diffSteps = diffSteps % edo;

            const centsEDO = (diffSteps / edo) * 1200;
            const xEDO = this.centsToX(centsEDO);

            // Buscar si tenemos datos de análisis (el algoritmo racional que ya corre en el renderer principal)
            // Como LinearVisualizer no tiene acceso directo al Renderer, podemos recalcular
            // o acceder a la propiedad 'harmonicLabel' o 'cachedColor' si guardamos más datos.
            // Para ser robustos, usamos la LUT de HarmonicMath aquí brevemente.

            // A. Dibujar el marcador del EDO (Círculo)
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(xEDO, h - 20, 4, 0, Math.PI*2);
            ctx.fill();

            // B. Dibujar Conexión con JI (Visualización del Error)
            // Calculamos el mejor racional al vuelo para dibujar la línea
            const ratioVal = Math.pow(2, centsEDO / 1200);
            // Usamos un peso alto aquí para mostrar el "ideal" al que aspira la nota
            const rational = HarmonicMath.getBestRational(ratioVal == 1 ? 1 : ratioVal, 2.5);

            if (rational.match) {
                const jiCents = 1200 * Math.log2(rational.n / rational.d);
                const xJI = this.centsToX(jiCents);

                // Color según límite
                const limitN = HarmonicMath.getPrimeLimit(rational.n);
                const limitD = HarmonicMath.getPrimeLimit(rational.d);
                const limit = Math.max(limitN, limitD);
                const c = HarmonicMath.LIMIT_COLORS[limit] || {r:200,g:200,b:200};

                // Línea conectora (Error)
                ctx.strokeStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(xEDO, h - 20); // Desde el punto EDO
                ctx.lineTo(xJI, h - 60);  // Hacia la referencia JI (más arriba)
        ctx.stroke();

        // Etiqueta del intervalo detectado
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px Arial";
        ctx.fillText(`${rational.n}/${rational.d}`, xJI, h - 65);

        // Texto del error
        const error = (centsEDO - jiCents).toFixed(1);
        ctx.fillStyle = Math.abs(error) > 15 ? "#e74c3c" : "#888";
        ctx.font = "10px monospace";
        ctx.fillText(`${error > 0 ? '+' : ''}${error}¢`, xEDO, h - 35);
            }
        });
    }
}

// INICIALIZACIÓN
const hexSize = 25;
const mapRadius = 16;
//const origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 - 60 }; // Subimos un poco el centro del hex
const tuning = new TuningSystem(12);
const layout = new Layout(hexSize, origin);
const grid = new Grid(tuning);
grid.generateMap(mapRadius);
const renderer = new Renderer('hexCanvas', layout, grid);
const linearViz = new LinearVisualizer('linearCanvas', grid);

const originalDraw = renderer.draw.bind(renderer);
renderer.draw = function() {
    originalDraw(); // Dibuja hexágonos
    linearViz.draw(); // Dibuja barra lineal
};

// EVENTOS
document.getElementById('edoSelect').addEventListener('change', (e) => {
    const newEdo = e.target.value;
    tuning.setEdo(newEdo);
    renderer.lut.recalculate(newEdo, renderer.complexityWeight);
    grid.refreshData();
    renderer.recalculateHeatmap();
    renderer.draw();
});

document.getElementById('sensSlider').addEventListener('input', (e) => {
    renderer.setSensitivity(e.target.value);
});

document.getElementById('complexitySlider').addEventListener('input', (e) => {
    renderer.setComplexityWeight(e.target.value);
});
