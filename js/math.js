import { LIMIT_COLORS, BASE_FREQ } from './config.js';

/**
 * Biblioteca de matemáticas armónicas y teoría musical.
 * Contiene algoritmos puros sin estado.
 */
export class HarmonicMath {

    /**
     * Algoritmo de Fracciones Continuas para encontrar la mejor aproximación racional.
     * @param {number} floatVal - Valor decimal (ratio de frecuencia).
     * @param {number} complexityWeight - Penalización por complejidad.
     * @returns {object} {n, d, error, match}
     */
    static getBestRational(floatVal, complexityWeight = 2.8, maxDenominator = 2000) {
        let n0 = 0, d0 = 1, n1 = 1, d1 = 0;
        let x = floatVal;
        let candidates = [];

        while (true) {
            let a = Math.floor(x);
            let n2 = a * n1 + n0;
            let d2 = a * d1 + d0;

            if (d2 > maxDenominator) break;

            const error = Math.abs(1200 * Math.log2(floatVal / (n2 / d2)));
            const complexity = Math.log2(n2 * d2); // Entropía aproximada

            if (n2 * d2 < 50000) {
                candidates.push({ n: n2, d: d2, error, complexity });
            }

            if (error < 0.001) break; // Convergencia exacta

            n0 = n1; d0 = d1;
            n1 = n2; d1 = d2;
            x = 1 / (x - a);
            if (!isFinite(x)) break;
        }

        // Selección del mejor candidato balanceando error vs complejidad
        let bestCandidate = candidates[0];
        let minCost = Infinity;

        for (let cand of candidates) {
            // Penalización extra para primos altos (limpieza de ruido armónico)
            const pLimit = this.getPrimeLimit(Math.max(cand.n, cand.d));
            const limitPenalty = pLimit > 19 ? 15 : 0;

            const cost = cand.error + (cand.complexity * complexityWeight) + limitPenalty;

            if (cost < minCost) {
                minCost = cost;
                bestCandidate = cand;
            }
        }

        const matchThreshold = 40 + (complexityWeight * 10);
        return {
            n: bestCandidate.n,
            d: bestCandidate.d,
            error: bestCandidate.error,
            match: minCost < matchThreshold
        };
    }

    /**
     * Calcula el límite primo (el factor primo más grande) de un número.
     */
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

    /**
     * Modelo de disonancia sensorial (Curva de Plomp-Levelt).
     * Calcula la "aspereza" teórica entre dos tonos.
     */
    static complexRoughness(ratio, bandwidthScale = 1.0) {
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

                // Si bandwidthScale < 1, la curva es más estrecha (menos borrosa)
                const cbw = 0.24 * (fMin + 25) * bandwidthScale;

                const x = df / cbw;
                const S1 = 3.5; const S2 = 5.75;
                const amplitude = (a1 * a2) ** 0.1;
                const dis = amplitude * (Math.exp(-S1 * x) - Math.exp(-S2 * x));

                R += Math.max(dis, 0);
            }
        }
        return R ** 2;
    }

    static gcd(a, b) { return !b ? a : this.gcd(b, a % b); }

    /**
     * Genera una lista de intervalos de Just Intonation para referencia visual.
     */
    static generateReferenceIntervals(maxLimit = 13, maxDenom = 24) {
        const intervals = [];
        for (let d = 1; d <= maxDenom; d++) {
            for (let n = d; n < d * 2; n++) {
                if (this.gcd(n, d) !== 1) continue; // Solo irreducibles

                const limit = Math.max(this.getPrimeLimit(n), this.getPrimeLimit(d));
                if (limit > maxLimit) continue;

                intervals.push({
                    n, d,
                    ratioStr: `${n}/${d}`,
                    cents: 1200 * Math.log2(n / d),
                    limit,
                    color: LIMIT_COLORS[limit] || {r:100,g:100,b:100}
                });
            }
        }
        intervals.push({ n: 2, d: 1, ratioStr: "2/1", cents: 1200, limit: 1, color: LIMIT_COLORS[1] });
        return intervals.sort((a, b) => a.cents - b.cents);
    }

    static getFrequency(q, r, edoConfig, edo) {
        const pitchSteps = (q * edoConfig.qStep) + (r * edoConfig.rStep);
        return BASE_FREQ * Math.pow(2, pitchSteps / edo);
    }
}
