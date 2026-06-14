// =============================================================================
// SHARED UI HELPERS (utils.js)
// Used by main.js, favorites.js, quiz.js (the surprise/ page has its own copies):
//   beanSvg          – coffee-bean icon used for star ratings (filled/empty)
//   popBeans         – little "pop" animation when a rating is set
//   renderBrewContent – HTML for the brew-method recommendations in detail modals
// =============================================================================

// Returns the SVG markup for one rating "bean" — filled (brown) or empty (outline).
function beanSvg(filled) {
    if (filled) {
        return `<svg class="bean-svg" width="14" height="18" viewBox="0 0 14 18" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="7" cy="9" rx="6" ry="7.5" fill="#8B5E3C"/>
            <path d="M7 1.8 Q7.8 5 7 9 Q6.2 13 7 16.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
        </svg>`;
    }
    return `<svg class="bean-svg" width="14" height="18" viewBox="0 0 14 18" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="7" cy="9" rx="6" ry="7.5" fill="none" stroke="#c4a882" stroke-width="1.4"/>
        <path d="M7 1.8 Q7.8 5 7 9 Q6.2 13 7 16.2" fill="none" stroke="#c4a882" stroke-width="1.1" stroke-linecap="round"/>
    </svg>`;
}

// Plays a short "pop" animation on every filled bean up to `rating`, with a
// slight delay between each one so they pop in sequence.
function popBeans(container, rating) {
    container.querySelectorAll(".card-star").forEach(s => {
        if (parseInt(s.dataset.rating, 10) > rating) return;
        s.classList.remove("bean-popping");
        void s.offsetWidth;
        s.style.animationDelay = `${(parseInt(s.dataset.rating, 10) - 1) * 45}ms`;
        s.classList.add("bean-popping");
        s.addEventListener("animationend", () => {
            s.classList.remove("bean-popping");
            s.style.animationDelay = "";
        }, { once: true });
    });
}

// Renders the list of brew-method recommendations shown in the detail modals.
function renderBrewContent(brew) {
    const html = (brew.methods || []).map(m => `
        <div class="brew-method">
            <h4>${escapeHtml(m.name)}</h4>
            <div style="font-size: 0.85rem; color: var(--coffee-muted);">${escapeHtml(m.setup)}</div>
            <div class="brew-stats">
                <span><strong>Wasser</strong> ${m.waterTempC}°C</span>
                <span><strong>Verhältnis</strong> ${escapeHtml(m.ratio)}</span>
                <span><strong>Zeit</strong> ${escapeHtml(m.time)}</span>
            </div>
            <div style="font-size: 0.9rem;">${escapeHtml(m.description)}</div>
        </div>`).join("");
    return html || `<p>Keine Brew-Empfehlungen verfügbar.</p>`;
}
