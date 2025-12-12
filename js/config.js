/**
 * Configuración global del sistema.
 */

export const BASE_FREQ = 261.63; // Do central (C4)

// Pesos para el algoritmo de "Harmonic Strength"
export const WEIGHTS = {
    consonance: 0.55, // Peso de la suavidad física (Plomp-Levelt)
    clarity: 0.30,    // Peso de la simplicidad matemática
    tuning: 0.15      // Peso de la precisión de afinación
};

// Colores asociados a los Límites Primos (Teoría de Color Armónico)
export const LIMIT_COLORS = {
    1:  { r:255, g:255, b:255 },    // Octava (Blanco)
    3:  { r:120, g:220, b:120 },    // 5tas (Verde)
    5:  { r:255, g:200, b:90  },    // 3ras Mayores (Amarillo)
    7:  { r:255, g:120, b:90  },    // 7ma Armónica (Rojo Coral)
    11: { r:180, g:100, b:255 },    // 11ava (Púrpura)
    13: { r: 90, g:150, b:255 },    // 13ava (Azul)
    17: { r:120, g:120, b:120 }     // Ruido/Complejo (Gris)
};

// Configuraciones de EDO (Equal Division of Octave)
export const EDO_CONFIGS = {
    12: { name: "12 TET", qStep: 2, rStep: 1, whiteKeys: [0, 2, 4, 5, 7, 9, 11] },
    19: { name: "19 TET", qStep: 3, rStep: 2, whiteKeys: [0, 3, 6, 8, 11, 14, 17] },
    31: { name: "31 TET", qStep: 5, rStep: 3, whiteKeys: [0, 5, 10, 13, 18, 23, 28] },
    53: { name: "53 TET", qStep: 9, rStep: 4, whiteKeys: [0, 9, 18, 22, 31, 40, 49] },
    72: { name: "72 TET", qStep: 12, rStep: 5, whiteKeys: [0, 12, 24, 30, 42, 54, 66] }
};
