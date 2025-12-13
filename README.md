# Hexagonal Harmonic Map ⬡

A web-based interactive tool for exploring **Microtonal Harmony** and **Consonance** using an isomorphic hexagonal lattice.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

## 🔗 [Live Demo](https://alvaro-gonzalez-redondo.github.io/hex-harmonics/)

## ✨ Features

*   **Isomorphic Layout:** Visualizes pitch relationships geometrically.
*   **Microtonal Support:** Switch instantly between **12, 19, 31, 53, and 72 EDO** (Equal Division of the Octave).
*   **Heatmap Visualization:** Real-time calculation of sensory dissonance (Roughness) based on **Plomp-Levelt curves**.
*   **Rational Approximation:** Automatically maps arbitrary EDO intervals to their closest **Just Intonation** ratios (e.g., 3/2, 5/4, 7/4) using continued fractions.
*   **Ethereal Synth:** Built-in stereo web audio engine featuring a harp-like sound with physically inspired filtering.
*   **Linear Visualizer:** A secondary view comparing the current tuning system against pure harmonic limits.

## 🚀 Usage

1.  **Select a System:** Choose a tuning (e.g., 31 TET) from the dropdown.
2.  **Activate Notes:** Click on hexagons to toggle notes on/off.
3.  **Hear the Harmony:**
    *   Press **Space** to strum the active chord.
    *   Press **Shift + Space** to start an infinite arpeggio loop.
4.  **Adjust Visualization:** Use the sliders to change light sensitivity or the complexity filter for rational approximations.

## 🛠 Tech Stack

*   **Core:** Vanilla JavaScript (ES6 Modules).
*   **Graphics:** HTML5 Canvas API (2D Context).
*   **Audio:** Web Audio API (Oscillators, Filters, DynamicsCompressor).
*   **Math:** Custom implementation of continued fractions and psychoacoustic roughness models.
*   **Build:** None. Zero dependencies.

## 📦 Installation (Local)

Since this project uses ES Modules, you need a local server to run it.

```bash
# 1. Clone the repository
git clone git@github.com:alvaro-gonzalez-redondo/hex-harmonics.git

# 2. Go to the directory
cd REPO_NAME

# 3. Run a static server (Python example)
python -m http.server
# OR using Node.js
npx http-server

Then open http://localhost:8000 in your browser.

🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
