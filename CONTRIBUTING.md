# Contributing to Hexagonal Harmonic Map

First off, thanks for taking the time to contribute! 🎉

We welcome contributions from everyone. Whether you are a music theorist, a math enthusiast, or a frontend developer, your help is appreciated.

## 🛠 Development Setup

**Important:** This project uses native ES6 Modules (`type="module"`).
Due to browser security policies (CORS), **you cannot open `index.html` directly from your file system** (`file://...`).

To run the project locally:

1.  **Fork** and **Clone** the repository.
2.  Navigate to the project folder.
3.  **Start a local server.** You can use any static server. Examples:

    *   **VS Code:** Install the "Live Server" extension and click "Go Live".
    *   **Python 3:** `python -m http.server`
    *   **Node.js:** `npx http-server`
    *   **PHP:** `php -S localhost:8000`

4.  Open your browser at `http://localhost:8000` (or the port shown in your terminal).

## 🤝 How to Contribute

### 1. Reporting Bugs
If you find a bug, please create a new issue. Be sure to include:
*   Browser and OS version.
*   The Tuning System (EDO) selected.
*   Steps to reproduce the error.
*   Screenshots (if applicable).

### 2. Suggesting Enhancements
Have an idea for a new feature (e.g., a new visualization mode or a different synth sound)?
*   Open an issue tagged as **enhancement**.
*   Explain the theory behind the idea (especially for math/music concepts).

### 3. Pull Requests (PRs)
1.  **Fork** the repo and create your branch from `main`.
2.  If you've added code that should be tested, add tests (or proof of concept).
3.  Ensure your code follows the existing style (Vanilla JS, no frameworks).
4.  Issue that Pull Request!

## 📐 Coding Guidelines

*   **Architecture:** Respect the modular structure (`js/math.js` for pure functions, `js/views.js` for DOM/Canvas, etc.).
*   **Dependencies:** We aim to keep this project **dependency-free**. Please do not introduce npm packages or bundlers (Webpack/Vite) unless absolutely necessary and discussed in an issue first.
*   **Style:** Clean, modern JavaScript (ES6+). Use `const` and `let`.

## 🎵 Math & Music Theory
If you are modifying the `HarmonicMath` class:
*   Please comment your sources if implementing a specific psychoacoustic model (like Plomp-Levelt variations).
*   Keep the math "pure" (decoupled from the UI).

Thank you for hacking on the Harmonic Map!
