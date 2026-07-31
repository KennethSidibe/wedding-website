// The initial theme is set by the inline script in header.ejs, before paint.
// This file only handles the manual toggle and keeps the button label in sync.

const STORAGE_KEY = "ls-theme";
const root = document.documentElement;
const toggle = document.querySelector("#themeToggle");

function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-bs-theme", theme);

    if (toggle) {
        const isDark = theme === "dark";
        const label = isDark ? "Passer en mode clair" : "Passer en mode sombre";

        toggle.setAttribute("aria-label", label);
        toggle.setAttribute("title", label);
        toggle.setAttribute("aria-pressed", String(isDark));
    }
}

applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

// Must match the window used by the inline script in views/header.ejs.
function clockTheme() {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7 ? "dark" : "light";
}

if (toggle) {
    toggle.addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        const auto = clockTheme();

        try {
            if (next === auto) {
                // Back in agreement with the clock — drop the override entirely.
                localStorage.removeItem(STORAGE_KEY);
            } else {
                // Remember what the clock said, so this override expires as soon
                // as the clock moves to the other side of the 19h/7h window.
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: next, auto }));
            }
        } catch (e) {}

        applyTheme(next);
    });
}
