import { HarmonicMath } from './math.js';
import { HarmonicLUT } from './models.js';
import { WEIGHTS, LIMIT_COLORS } from './config.js';

// Utils visuales
const lerpColor = (c1, c2, t) => ({
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t)
});
const rgbToString = (c) => `rgb(${c.r},${c.g},${c.b})`;


export class Renderer {
    constructor(canvasId, layout, grid, onHexClick = null) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.layout = layout;
        this.grid = grid;
        this.onHexClick = onHexClick;

        this.hoveredHex = null;
        this.sensitivity = 80;
        this.complexityWeight = 10.0;

        this.lut = new HarmonicLUT();
        this.lut.recalculate(this.grid.tuning.edo, this.complexityWeight);

        this.initLegend();
        this.resize();

        // Listeners internos del canvas
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    }

    initLegend() {
        const legend = document.getElementById('legend');
        legend.innerHTML = "<strong>Prime Limits</strong>";
        const labels = { 1: "Octave", 3: "3 (5th)", 5: "5 (3rd)", 7: "7 (Harm)", 11: "11 (Neutral)", 13: "13", 17: ">13" };
        [1, 3, 5, 7, 11, 13, 17].forEach(l => {
            const color = LIMIT_COLORS[l] || LIMIT_COLORS[17];
            legend.innerHTML += `
                <div class="legend-item">
                    <div class="color-box" style="background:${rgbToString(color)}"></div>
                    <span>${labels[l] || `Lim ${l}`}</span>
                </div>`;
        });
    }

    setComplexityWeight(val) {
        this.complexityWeight = parseFloat(val);
        this.lut.recalculate(this.grid.tuning.edo, this.complexityWeight);
        this.refresh();
    }

    setSensitivity(val) {
        this.sensitivity = Math.max(1, parseInt(val));
        this.refresh();
    }

    refresh() {
        this.recalculateHeatmap();
        this.draw();
    }

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

        if (this.hoveredHex !== cell) {
            this.hoveredHex = cell || null;
            this.updateUI();
            this.draw();
        }
    }

    handleMouseDown(e) {
        if (this.hoveredHex) {
            if (this.onHexClick) {
                this.onHexClick(this.hoveredHex);
            }
        }
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
            ui.innerHTML = "Click to activate notes.";
        }
    }

    recalculateHeatmap() {
        const activeCells = this.grid.getActiveCells();
        const cells = this.grid.getAll();
        const gain = this.sensitivity / 10;

        cells.forEach(c => { c.cachedColor = null; c.harmonicLabel = ""; });
        if (activeCells.length === 0) return;

        cells.forEach(target => {
            if (target.active) return;

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
                target.harmonicLabel = `${bestIntervalData.label} (Err: ${bestIntervalData.error.toFixed(1)}¢)`;
            }

            // Cálculo de Fuerza Armónica
            const consonance = 1 / (1 + (totalRoughness * (6 / gain)));
            let finalColor = baseColor;

            if (bestIntervalData && bestIntervalData.color) {
                const clarity = Math.exp(-0.15 * bestIntervalData.complexity);
                const tuningAccuracy = Math.max(0, Math.min(1, 1 - (bestIntervalData.error / 20)));

                const logBlend =
                    WEIGHTS.clarity * Math.log(clarity + 1e-6) +
                    WEIGHTS.consonance * Math.log(consonance + 1e-6) +
                    WEIGHTS.tuning * Math.log(tuningAccuracy + 1e-6);

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

        for (const cell of this.grid.getAll()) {
            const center = this.layout.hexToPixel(cell.hex);
            const isHover = this.hoveredHex === cell;
            let fillColorObj, strokeColor="#555", textColor="#aaa";

            if (cell.active) {
                fillColorObj = {r: 255, g: 255, b: 255};
                strokeColor = "#fff"; textColor = "#F33";
            } else if (cell.cachedColor) {
                fillColorObj = cell.cachedColor;
                const brightness = (fillColorObj.r + fillColorObj.g + fillColorObj.b) / 3;
                textColor = brightness > 100 ? "#222" : "#ccc";
            } else {
                const isWhite = this.grid.tuning.isWhiteKey(cell.noteIndex);
                fillColorObj = isWhite ? {r: 100, g: 100, b: 120} : {r: 50, g: 50, b: 60};
                textColor = isWhite ? "#222" : "#888";
            }

            if (isHover && !cell.active) {
                fillColorObj = lerpColor(fillColorObj, {r:52, g:152, b:219}, 0.5);
                textColor = "#fff";
            }

            // Dibujar Hexágono
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

            // Dibujar Texto
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.font = cell.active ? "bold 14px Arial" : "12px Arial";
            this.ctx.fillText(cell.noteIndex, center.x, center.y);

            // Marca de nota raiz (0)
            if (cell.noteIndex === 0) {
                this.ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(center.x - 4, center.y + 8, 8, 2);
            }
        }
    }
}

export class LinearVisualizer {
    constructor(canvasId, grid) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.grid = grid;
        this.margin = 30;
        this.backgroundIntervals = HarmonicMath.generateReferenceIntervals(13, 32);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.grid.subscribe(() => this.draw());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    centsToX(cents) {
        return this.margin + (cents / 1200) * (this.canvas.width - this.margin * 2);
    }

    draw() {
        const w = this.canvas.width, h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        // 1. Fondo (JI)
        this.backgroundIntervals.forEach(m => {
            const x = this.centsToX(m.cents);
            const complexity = m.n * m.d;
            let lineScale = 1 - (Math.min(complexity, 300) / 300);
            if (m.limit <= 3) lineScale = 1.0;
            const lineH = h * (0.3 + 0.5 * lineScale);

            this.ctx.fillStyle = `rgba(${m.color.r}, ${m.color.g}, ${m.color.b}, 0.3)`;
            this.ctx.fillRect(x - 1, h - lineH, 2, lineH);

            if (complexity < 100 || m.limit <= 5) {
                this.ctx.fillStyle = `rgba(${m.color.r}, ${m.color.g}, ${m.color.b}, 0.7)`;
                this.ctx.font = "10px monospace";
                this.ctx.textAlign = "center";
                this.ctx.fillText(m.ratioStr, x, h - lineH - 5);
            }
        });

        // Eje
        this.ctx.strokeStyle = "#555";
        this.ctx.beginPath(); this.ctx.moveTo(this.margin, h - 20); this.ctx.lineTo(w - this.margin, h - 20); this.ctx.stroke();

        // 2. EDO Steps
        const edo = this.grid.tuning.edo;
        this.ctx.fillStyle = "#444";
        for (let i = 0; i <= edo; i++) {
            this.ctx.fillRect(this.centsToX((i / edo) * 1200) - 0.5, h - 25, 1, 8);
        }

        // 3. Notas Activas
        const active = this.grid.getActiveCells();
        if (active.length === 0) return;

        const rootSteps = active[0].pitchSteps;
        active.forEach(cell => {
            let diff = Math.abs(cell.pitchSteps - rootSteps) % edo;
            const centsEDO = (diff / edo) * 1200;
            const x = this.centsToX(centsEDO);

            // Círculo
            this.ctx.fillStyle = "#fff";
            this.ctx.beginPath(); this.ctx.arc(x, h - 20, 4, 0, Math.PI*2); this.ctx.fill();

            // Linea a JI cercano
            const ratioVal = Math.pow(2, centsEDO / 1200);
            const rational = HarmonicMath.getBestRational(ratioVal < 1.001 ? 1 : ratioVal, 2.5);

            if (rational.match) {
                const jiCents = 1200 * Math.log2(rational.n / rational.d);
                const xJI = this.centsToX(jiCents);
                const limit = Math.max(HarmonicMath.getPrimeLimit(rational.n), HarmonicMath.getPrimeLimit(rational.d));
                const c = LIMIT_COLORS[limit] || {r:200,g:200,b:200};

                this.ctx.strokeStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath(); this.ctx.moveTo(x, h - 20); this.ctx.lineTo(xJI, h - 60); this.ctx.stroke();

                this.ctx.fillStyle = "#fff";
                this.ctx.font = "bold 12px Arial";
                this.ctx.fillText(`${rational.n}/${rational.d}`, xJI, h - 65);

                const err = (centsEDO - jiCents).toFixed(1);
                this.ctx.fillStyle = Math.abs(err) > 15 ? "#e74c3c" : "#aaa";
                this.ctx.font = "10px monospace";
                this.ctx.fillText(`${err > 0 ? '+' : ''}${err}¢`, x, h - 35);
            }
        });
    }
}
