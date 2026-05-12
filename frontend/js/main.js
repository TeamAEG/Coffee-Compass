const usernameLabel = document.getElementById("usernameLabel");
const logoutBtn = document.getElementById("logoutBtn");

if (Auth.isLoggedIn()) {
    usernameLabel.textContent = Auth.username() || "";
    logoutBtn.textContent = "Logout";
    logoutBtn.addEventListener("click", () => {
        Auth.clear();
        window.location.href = "login.html";
    });
} else {
    usernameLabel.textContent = "";
    logoutBtn.textContent = "Login";
    logoutBtn.addEventListener("click", () => {
        window.location.href = "login.html";
    });
}

const listEl            = document.getElementById("coffeeList");
const messageBox        = document.getElementById("messageBox");
const searchInput       = document.getElementById("search");
const suggestionsEl     = document.getElementById("searchSuggestions");
const priceFilter       = document.getElementById("priceFilter");
const priceLabel        = document.getElementById("priceLabel");
const notesChips        = document.getElementById("notesChips");
const resetBtn          = document.getElementById("resetBtn");
const moreFiltersBtn    = document.getElementById("moreFiltersBtn");
const filterSecondary   = document.getElementById("filterSecondary");
const modalContainer    = document.getElementById("modalContainer");

let allCoffees    = [];
let currentCoffees = [];
let userFavorites = new Map();
let userRatings   = new Map();
const compareSet      = new Set();
const activeNotes     = new Set();
const activeRoasts    = new Set();
const activeOrigins   = new Set();
const activeTypes     = new Set();
const activeProcesses = new Set();
let priceMax          = 0;

const ROAST_LABELS = { light: "Hell", medium: "Mittel", dark: "Dunkel" };

// ── Initial load ─────────────────────────────────────────────────────────────

async function loadAllCoffees() {
    listEl.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><p style="margin-top: 0.6rem;">Lade Kaffees...</p></div>`;
    messageBox.innerHTML = "";
    try {
        const [coffees, favs, ratings] = await Promise.all([
            API.listCoffees(),         // no params — full catalogue, filtered client-side
            API.listFavorites().catch(() => []),
            API.getRatings().catch(() => [])
        ]);
        allCoffees    = coffees;
        userFavorites = new Map(favs.map(f => [f.coffeeId, f]));
        userRatings   = new Map(ratings.map(r => [r.coffeeId, r.rating]));
        populateFilters(coffees);
        filterCoffees();
    } catch (err) {
        showError(messageBox, "Fehler beim Laden: " + err.message);
        listEl.innerHTML = "";
    }
}

// ── Multi-select helpers ─────────────────────────────────────────────────────

// Split comma-separated field values across all coffees into unique sorted tokens
function splitTokens(coffees, field) {
    const seen = new Set();
    coffees.forEach(c => {
        const val = c[field];
        if (!val) return;
        val.split(",").forEach(t => { const s = t.trim(); if (s) seen.add(s); });
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
}

// labelFn: optional fn(value) → display string (e.g. for translating "light" → "Hell")
function populateMsPanel(msId, values, activeSet, labelFn) {
    const container = document.getElementById(msId);
    const btn       = container.querySelector(".multi-select-btn");
    const labelEl   = btn.querySelector(".ms-label");

    let panel = container.querySelector(".ms-panel");
    if (!panel) {
        panel = document.createElement("div");
        panel.className = "ms-panel";
        panel.hidden = true;
        container.appendChild(panel);
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const willOpen = panel.hidden;
            closeAllMsPanels();
            panel.hidden = !willOpen;
        });
    }

    const display = v => labelFn ? labelFn(v) : v;
    panel.innerHTML = values.map(v => `
        <label class="ms-option">
            <input type="checkbox" value="${escapeHtml(v)}" ${activeSet.has(v) ? "checked" : ""}>
            <span>${escapeHtml(display(v))}</span>
        </label>`).join("");

    panel.querySelectorAll("input").forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked) activeSet.add(cb.value);
            else activeSet.delete(cb.value);
            updateMsLabel(labelEl, activeSet, labelFn);
            filterCoffees();
        });
    });
}

function updateMsLabel(labelEl, activeSet, labelFn) {
    const display = v => labelFn ? labelFn(v) : v;
    if (activeSet.size === 0) {
        labelEl.textContent = "Alle";
    } else if (activeSet.size <= 2) {
        labelEl.textContent = [...activeSet].map(display).join(", ");
    } else {
        labelEl.textContent = `${activeSet.size} ausgewählt`;
    }
    labelEl.closest(".multi-select-btn").classList.toggle("has-selection", activeSet.size > 0);
}

function resetMsPanel(msId, activeSet) {
    activeSet.clear();
    const container = document.getElementById(msId);
    if (!container) return;
    container.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);
    const labelEl = container.querySelector(".ms-label");
    if (labelEl) {
        labelEl.textContent = "Alle";
        labelEl.closest(".multi-select-btn").classList.remove("has-selection");
    }
}

function closeAllMsPanels() {
    document.querySelectorAll(".ms-panel").forEach(p => { p.hidden = true; });
}
document.addEventListener("click", closeAllMsPanels);

// ── Populate dynamic filter controls from loaded data ────────────────────────

function populateFilters(coffees) {
    populateMsPanel("roastMultiSelect",   ["light", "medium", "dark"], activeRoasts,    v => ROAST_LABELS[v] || v);
    populateMsPanel("originMultiSelect",  splitTokens(coffees, "origin"),  activeOrigins);
    populateMsPanel("typeMultiSelect",    splitTokens(coffees, "type"),    activeTypes);
    populateMsPanel("processMultiSelect", splitTokens(coffees, "process"), activeProcesses);

    const prices = coffees.map(c => c.price).filter(p => p != null && p > 0);
    if (prices.length) {
        priceMax = Math.ceil(Math.max(...prices));
        priceFilter.max   = priceMax;
        priceFilter.value = priceMax;
        priceLabel.textContent = "Alle";
        priceFilter.closest(".filter-price-wrap").style.display = "";
    } else {
        priceFilter.closest(".filter-price-wrap").style.display = "none";
    }

    // Top 20 tasting notes by frequency
    const noteCount = new Map();
    coffees.forEach(c => (c.tastingNotes || []).forEach(n => noteCount.set(n, (noteCount.get(n) || 0) + 1)));
    const topNotes = [...noteCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([n]) => n);
    notesChips.innerHTML = topNotes
        .map(n => `<button class="note-chip" data-note="${escapeHtml(n)}">${escapeHtml(n)}</button>`)
        .join("");
    notesChips.querySelectorAll(".note-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const note = chip.dataset.note;
            if (activeNotes.has(note)) {
                activeNotes.delete(note);
                chip.classList.remove("active");
            } else {
                activeNotes.add(note);
                chip.classList.add("active");
            }
            updateMoreFiltersBadge();
            filterCoffees();
        });
    });
}

// ── Client-side filtering ─────────────────────────────────────────────────────

function tokenize(str) {
    return (str || "").split(",").map(t => t.trim()).filter(Boolean);
}

function filterCoffees() {
    const search        = searchInput.value.trim().toLowerCase();
    const priceVal      = parseFloat(priceFilter.value);
    const filterByPrice = priceMax > 0 && priceVal < priceMax;

    currentCoffees = allCoffees.filter(c => {
        if (filterByPrice && c.price != null && c.price > priceVal) return false;

        // multi-select: match if any token intersects the active set
        if (activeRoasts.size > 0    && !activeRoasts.has(c.roastLevel?.toLowerCase()))          return false;
        if (activeOrigins.size > 0   && !tokenize(c.origin).some(t  => activeOrigins.has(t)))    return false;
        if (activeTypes.size > 0     && !tokenize(c.type).some(t    => activeTypes.has(t)))      return false;
        if (activeProcesses.size > 0 && !tokenize(c.process).some(t => activeProcesses.has(t))) return false;
        if (activeNotes.size > 0     && ![...activeNotes].some(n => (c.tastingNotes || []).includes(n))) return false;

        if (search) {
            const hit = c.name?.toLowerCase().includes(search)
                || c.roaster?.toLowerCase().includes(search)
                || c.origin?.toLowerCase().includes(search)
                || (c.tastingNotes || []).some(n => n.toLowerCase().includes(search));
            if (!hit) return false;
        }
        return true;
    });
    renderCoffees(currentCoffees);
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

let acTimer = null;
function scheduleAutocomplete() {
    clearTimeout(acTimer);
    acTimer = setTimeout(() => showAutocomplete(searchInput.value.trim()), 180);
}

function showAutocomplete(query) {
    if (!query || query.length < 2) { hideAutocomplete(); return; }
    const q = query.toLowerCase();
    const matches = new Set();
    allCoffees.forEach(c => {
        if (c.name?.toLowerCase().includes(q))    matches.add(c.name);
        if (c.roaster?.toLowerCase().includes(q)) matches.add(c.roaster);
    });
    const suggestions = [...matches].slice(0, 7);
    if (!suggestions.length) { hideAutocomplete(); return; }

    suggestionsEl.innerHTML = suggestions
        .map(s => `<li class="autocomplete-item">${escapeHtml(s)}</li>`)
        .join("");
    suggestionsEl.hidden = false;

    suggestionsEl.querySelectorAll(".autocomplete-item").forEach(li => {
        li.addEventListener("mousedown", e => {
            e.preventDefault();
            searchInput.value = li.textContent;
            hideAutocomplete();
            filterCoffees();
        });
    });
}

function hideAutocomplete() {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
}

// ── Price label ───────────────────────────────────────────────────────────────

function updatePriceLabel() {
    const val = parseFloat(priceFilter.value);
    priceLabel.textContent = val >= priceMax ? "Alle" : `€${val.toFixed(2)}`;
    updateMoreFiltersBadge();
}

// ── More-filters badge ────────────────────────────────────────────────────────

function updateMoreFiltersBadge() {
    const priceVal = parseFloat(priceFilter.value);
    const hasActive = activeNotes.size > 0 || activeTypes.size > 0 || activeProcesses.size > 0
        || (priceMax > 0 && priceVal < priceMax);
    moreFiltersBtn.classList.toggle("has-active", hasActive);
}

// ── Event listeners ───────────────────────────────────────────────────────────

searchInput.addEventListener("input", () => { scheduleAutocomplete(); filterCoffees(); });
searchInput.addEventListener("blur",  () => setTimeout(hideAutocomplete, 150));
searchInput.addEventListener("keydown", e => { if (e.key === "Escape") hideAutocomplete(); });

priceFilter.addEventListener("input", () => { updatePriceLabel(); filterCoffees(); });

moreFiltersBtn.addEventListener("click", () => {
    const open = !filterSecondary.hidden;
    filterSecondary.hidden = open;
    moreFiltersBtn.textContent = (open ? "Mehr ▾" : "Weniger ▴") + (moreFiltersBtn.classList.contains("has-active") ? "" : "");
    // keep badge in sync
    moreFiltersBtn.textContent = open ? "Mehr ▾" : "Weniger ▴";
    updateMoreFiltersBadge();
});

resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    roastFilter.value = "";
    typeFilter.value  = "";
    if (priceMax > 0) { priceFilter.value = priceMax; priceLabel.textContent = "Alle"; }
    activeNotes.clear();
    notesChips.querySelectorAll(".note-chip.active").forEach(c => c.classList.remove("active"));
    resetMsPanel("roastMultiSelect",   activeRoasts);
    resetMsPanel("originMultiSelect",  activeOrigins);
    resetMsPanel("typeMultiSelect",    activeTypes);
    resetMsPanel("processMultiSelect", activeProcesses);
    updateMoreFiltersBadge();
    hideAutocomplete();
    filterCoffees();
});

// ── Render ────────────────────────────────────────────────────────────────────

function renderCoffees(coffees) {
    if (!coffees.length) {
        listEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">☕</div>
                <p>Keine Kaffees gefunden. Versuche andere Filter.</p>
            </div>`;
        return;
    }
    listEl.innerHTML = coffees.map(renderCoffeeCard).join("");
}

function renderCoffeeCard(c) {
    const isFav      = userFavorites.has(c.id);
    const rating     = userRatings.get(c.id) || 0;
    const isCompared = compareSet.has(c.id);
    const roastClass = c.roastLevel ? `roast-${c.roastLevel.toLowerCase()}` : "roast-medium";
    const roastLabel = c.roastLevel ? c.roastLevel : "—";
    const notes = (c.tastingNotes || []).slice(0, 4)
        .map(n => `<span class="tasting-note">${escapeHtml(n)}</span>`).join("");
    const shortProcess = c.process && !c.process.includes(",") && c.process.length <= 25 ? c.process : null;
    const meta = [c.origin, shortProcess].filter(Boolean)
        .map(m => `<span>${escapeHtml(m)}</span>`).join("");

    const starsHtml = Auth.isLoggedIn() ? `
        <div class="card-stars" data-coffee-id="${escapeHtml(c.id)}" title="Klicke zum Bewerten">
            <span class="card-stars-label">${rating > 0 ? "Deine Wertung" : "Bewerten"}</span>
            ${[1,2,3,4,5].map(i =>
                `<span class="card-star ${i <= rating ? 'filled' : ''}" data-rating="${i}" data-coffee-id="${escapeHtml(c.id)}">${beanSvg(i <= rating)}</span>`
            ).join("")}
        </div>` : "";

    return `
        <article class="coffee-card ${isFav ? 'is-favorite' : ''} ${isCompared ? 'is-compared' : ''}" data-id="${escapeHtml(c.id)}">
            <div class="coffee-card-head">
                <div>
                    <div class="coffee-name">${escapeHtml(c.name)}</div>
                    <div class="coffee-roaster">${escapeHtml(c.roaster || "—")}</div>
                </div>
                <span class="roast-badge ${roastClass}">${escapeHtml(roastLabel)}</span>
            </div>
            <div class="coffee-meta">${meta}</div>
            <div class="tasting-notes">${notes}</div>
            <div class="card-spacer"></div>
            ${starsHtml}
            <div class="coffee-actions">
                <button class="compare-btn ${isCompared ? 'active' : ''}" data-action="compare" data-id="${escapeHtml(c.id)}" title="Zum Vergleich hinzufügen">⇄</button>
                <button class="secondary detail-btn" data-action="detail" data-id="${escapeHtml(c.id)}">Details</button>
                <button data-action="${isFav ? 'unfav' : 'fav'}" data-id="${escapeHtml(c.id)}">
                    ${isFav ? '★ Favorit' : '☆ Speichern'}
                </button>
            </div>
        </article>`;
}

// ── Card interactions ─────────────────────────────────────────────────────────

listEl.addEventListener("click", async (e) => {
    const star = e.target.closest(".card-star");
    if (star) {
        e.stopPropagation();
        if (!Auth.isLoggedIn()) { window.location.href = "login.html"; return; }
        const coffeeId  = star.dataset.coffeeId;
        const newRating = parseInt(star.dataset.rating, 10);
        try {
            await API.setRating(coffeeId, newRating);
            userRatings.set(coffeeId, newRating);
            const container = document.querySelector(`.card-stars[data-coffee-id="${coffeeId}"]`);
            if (container) {
                container.querySelectorAll(".card-star").forEach(s => {
                    const isFilled = parseInt(s.dataset.rating) <= newRating;
                    s.classList.toggle("filled", isFilled);
                    s.innerHTML = beanSvg(isFilled);
                });
                popBeans(container, newRating);
            }
        } catch (err) {
            alert("Bewertung fehlgeschlagen: " + err.message);
        }
        return;
    }

    const btn = e.target.closest("button[data-action]");
    if (btn) {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id     = btn.dataset.id;
        const coffee = currentCoffees.find(c => c.id === id);
        if (!coffee) return;
        if (action === "compare") {
            toggleCompare(id, btn);
        } else if (action === "detail") {
            openDetailModal(id);
        } else if (action === "fav" || action === "unfav") {
            if (!Auth.isLoggedIn()) { window.location.href = "login.html"; return; }
            if (action === "fav") await addFavorite(coffee, btn);
            else await removeFavorite(coffee, btn);
        }
        return;
    }

    const card = e.target.closest(".coffee-card");
    if (!card) return;
    openDetailModal(card.dataset.id);
});

listEl.addEventListener("mouseover", (e) => {
    const star = e.target.closest(".card-star");
    if (!star) return;
    const container = star.closest(".card-stars");
    if (!container) return;
    const hoverRating = parseInt(star.dataset.rating, 10);
    container.querySelectorAll(".card-star").forEach(s => {
        s.innerHTML = beanSvg(parseInt(s.dataset.rating, 10) <= hoverRating);
    });
});

listEl.addEventListener("mouseout", (e) => {
    const container = e.target.closest(".card-stars");
    if (!container || container.contains(e.relatedTarget)) return;
    const coffeeId = container.dataset.coffeeId;
    const rating   = userRatings.get(coffeeId) || 0;
    container.querySelectorAll(".card-star").forEach(s => {
        const filled = parseInt(s.dataset.rating, 10) <= rating;
        s.classList.toggle("filled", filled);
        s.innerHTML = beanSvg(filled);
    });
});

// ── Favorites ─────────────────────────────────────────────────────────────────

async function addFavorite(coffee, btn) {
    btn.disabled = true;
    try {
        const fav = await API.addFavorite({
            coffeeId:   coffee.id,
            coffeeName: coffee.name,
            roaster:    coffee.roaster,
            roastLevel: coffee.roastLevel,
            notes:      "",
            rating:     0
        });
        userFavorites.set(coffee.id, fav);
        btn.textContent  = "★ Favorit";
        btn.dataset.action = "unfav";
        btn.closest(".coffee-card").classList.add("is-favorite");
    } catch (err) {
        alert("Konnte nicht speichern: " + err.message);
    } finally {
        btn.disabled = false;
    }
}

async function removeFavorite(coffee, btn) {
    const fav = userFavorites.get(coffee.id);
    if (!fav) return;
    btn.disabled = true;
    try {
        await API.deleteFavorite(fav.id);
        userFavorites.delete(coffee.id);
        btn.textContent    = "☆ Speichern";
        btn.dataset.action = "fav";
        btn.closest(".coffee-card").classList.remove("is-favorite");
    } catch (err) {
        alert("Konnte nicht entfernen: " + err.message);
    } finally {
        btn.disabled = false;
    }
}

// ── Compare ───────────────────────────────────────────────────────────────────

function toggleCompare(id, btn) {
    if (compareSet.has(id)) {
        compareSet.delete(id);
        btn.classList.remove("active");
        btn.closest(".coffee-card").classList.remove("is-compared");
    } else {
        if (compareSet.size >= 3) { alert("Du kannst maximal 3 Kaffees vergleichen."); return; }
        compareSet.add(id);
        btn.classList.add("active");
        btn.closest(".coffee-card").classList.add("is-compared");
    }
    updateCompareBar();
}

function updateCompareBar() {
    const bar    = document.getElementById("compareBar");
    const chips  = document.getElementById("compareChips");
    const nowBtn = document.getElementById("compareNowBtn");

    if (compareSet.size === 0) { bar.classList.remove("visible"); return; }
    bar.classList.add("visible");
    nowBtn.textContent = `Jetzt vergleichen (${compareSet.size})`;
    chips.innerHTML = [...compareSet].map(id => {
        const coffee = currentCoffees.find(c => c.id === id);
        if (!coffee) return "";
        return `<span class="compare-chip">${escapeHtml(coffee.name)}<button class="compare-chip-remove" data-remove-id="${escapeHtml(id)}">✕</button></span>`;
    }).join("");

    chips.querySelectorAll(".compare-chip-remove").forEach(b => {
        b.addEventListener("click", e => {
            e.stopPropagation();
            const removeId = b.dataset.removeId;
            compareSet.delete(removeId);
            const card = document.querySelector(`.coffee-card[data-id="${removeId}"]`);
            if (card) {
                card.classList.remove("is-compared");
                const cb = card.querySelector(".compare-btn");
                if (cb) cb.classList.remove("active");
            }
            updateCompareBar();
        });
    });
}

document.getElementById("compareNowBtn").addEventListener("click", openCompareModal);
document.getElementById("clearCompareBtn").addEventListener("click", () => {
    compareSet.forEach(id => {
        const card = document.querySelector(`.coffee-card[data-id="${id}"]`);
        if (card) {
            card.classList.remove("is-compared");
            const cb = card.querySelector(".compare-btn");
            if (cb) cb.classList.remove("active");
        }
    });
    compareSet.clear();
    updateCompareBar();
});

// ── Compare modal ─────────────────────────────────────────────────────────────

function openCompareModal() {
    const coffees = [...compareSet].map(id => currentCoffees.find(c => c.id === id)).filter(Boolean);
    if (coffees.length < 2) { alert("Bitte mindestens 2 Kaffees auswählen."); return; }

    const fields = [
        { label: "Rösterei",      val: c => c.roaster || "—" },
        { label: "Herkunft",      val: c => c.origin  || "—" },
        { label: "Typ",           val: c => c.type    || "—" },
        { label: "Prozess",       val: c => c.process || "—" },
        { label: "Röstung",       val: c => c.roastLevel || "—" },
        { label: "Preis",         val: c => c.price ? `€${c.price.toFixed(2)}` : "—" },
        { label: "Tasting Notes", val: c => (c.tastingNotes || []).join(", ") || "—" },
    ];

    const headerCols = coffees.map(c =>
        `<th>${escapeHtml(c.name)}<div class="compare-th-sub">${escapeHtml(c.roaster || "")}</div></th>`
    ).join("");

    const rows = fields.map(f => {
        const cells = coffees.map(c => `<td>${escapeHtml(f.val(c))}</td>`).join("");
        return `<tr><td class="compare-label">${f.label}</td>${cells}</tr>`;
    }).join("");

    modalContainer.innerHTML = `
        <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal compare-modal">
                <div class="modal-head">
                    <h2>Kaffee-Vergleich</h2>
                    <button class="close-btn" id="closeModal" aria-label="Schließen">×</button>
                </div>
                <div style="overflow-x: auto;">
                    <table class="compare-table">
                        <thead><tr><th></th>${headerCols}</tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;

    document.getElementById("closeModal").onclick = () => { modalContainer.innerHTML = ""; };
    document.getElementById("modalBackdrop").addEventListener("click", e => {
        if (e.target.id === "modalBackdrop") modalContainer.innerHTML = "";
    });
}

// ── Detail modal ──────────────────────────────────────────────────────────────

async function openDetailModal(coffeeId) {
    modalContainer.innerHTML = `
        <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal">
                <div class="modal-head">
                    <h2>Details</h2>
                    <button class="close-btn" id="closeModal" aria-label="Schließen">×</button>
                </div>
                <div id="detailContent">
                    <div class="loading-overlay" style="position:relative;height:80px;"><div class="spinner"></div></div>
                </div>
            </div>
        </div>`;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("closeModal").onclick = close;
    document.getElementById("modalBackdrop").addEventListener("click", e => {
        if (e.target.id === "modalBackdrop") close();
    });

    try {
        const [coffee, brew] = await Promise.all([API.getCoffee(coffeeId), API.getBrew(coffeeId)]);
        document.querySelector("#modalBackdrop .modal-head h2").textContent = coffee.name;
        const fields = [
            { label: "Rösterei",      val: coffee.roaster    || "—" },
            { label: "Herkunft",      val: coffee.origin     || "—" },
            { label: "Typ",           val: coffee.type       || "—" },
            { label: "Prozess",       val: coffee.process    || "—" },
            { label: "Röstung",       val: coffee.roastLevel || "—" },
            { label: "Preis",         val: coffee.price ? `€${coffee.price.toFixed(2)}` : "—" },
            { label: "Tasting Notes", val: (coffee.tastingNotes || []).join(", ") || "—" },
        ];
        document.getElementById("detailContent").innerHTML = `
            <div class="detail-grid">
                ${fields.map(f => `
                    <div class="detail-row">
                        <span class="detail-label">${f.label}</span>
                        <span>${escapeHtml(String(f.val))}</span>
                    </div>`).join("")}
            </div>
            <h3 class="detail-brew-title">☕ Brew-Empfehlungen</h3>
            ${renderBrewContent(brew)}`;
    } catch (err) {
        document.getElementById("detailContent").innerHTML =
            `<div class="alert alert-error">Fehler: ${escapeHtml(err.message)}</div>`;
    }
}

// ── World map ─────────────────────────────────────────────────────────────────

const COUNTRY_COORDS = {
    "Ethiopia":          [ 9.145,  40.489],
    "Colombia":          [ 4.570, -74.297],
    "Brazil":            [-14.235,-51.925],
    "Kenya":             [-0.023,  37.906],
    "Guatemala":         [15.783, -90.230],
    "Honduras":          [15.199, -86.241],
    "Peru":              [-9.189, -75.015],
    "Panama":            [ 8.537, -80.782],
    "Yemen":             [15.552,  48.516],
    "Indonesia":         [-0.789, 113.921],
    "Costa Rica":        [ 9.748, -83.753],
    "Nicaragua":         [12.865, -85.207],
    "Rwanda":            [-1.940,  29.873],
    "Tanzania":          [-6.369,  34.889],
    "Mexico":            [23.634,-102.552],
    "El Salvador":       [13.794, -88.896],
    "India":             [20.593,  78.962],
    "Vietnam":           [14.058, 108.277],
    "Ecuador":           [-1.831, -78.183],
    "Bolivia":           [-16.290,-63.588],
    "Papua New Guinea":  [-6.314, 143.956],
    "Jamaica":           [18.109, -77.297],
    "Uganda":            [ 1.373,  32.290],
    "Burundi":           [-3.373,  29.918],
    "Malawi":            [-13.254, 34.302],
    "Myanmar":           [16.871,  96.194],
    "China":             [35.861, 104.195],
    "Laos":              [19.856, 102.495],
    "Philippines":       [12.879, 121.774],
    "Haiti":             [18.971, -72.285],
    "Congo":             [-4.038,  21.758],
    "Cameroon":          [ 7.369,  12.354],
    "Madagascar":        [-18.766, 46.869],
};

// Known coffee sub-regions → their country
const REGION_TO_COUNTRY = {
    "yirgacheffe": "Ethiopia", "guji": "Ethiopia", "sidama": "Ethiopia",
    "harrar": "Ethiopia",      "jimma": "Ethiopia", "kaffa": "Ethiopia",
    "limu": "Ethiopia",        "gedeo": "Ethiopia",
    "huila": "Colombia",       "nariño": "Colombia",  "cauca": "Colombia",
    "tolima": "Colombia",      "antioquia": "Colombia",
    "minas gerais": "Brazil",  "cerrado": "Brazil",   "sul de minas": "Brazil",
    "nyeri": "Kenya",          "kirinyaga": "Kenya",  "murang'a": "Kenya",
    "blue mountain": "Jamaica",
    "kona": "USA",
    "sumatra": "Indonesia",    "java": "Indonesia",   "sulawesi": "Indonesia",
    "flores": "Indonesia",     "bali": "Indonesia",   "aceh": "Indonesia",
    "tarrazú": "Costa Rica",   "poas": "Costa Rica",
    "antigua": "Guatemala",    "huehuetenango": "Guatemala",
    "matagalpa": "Nicaragua",
    "cajamarca": "Peru",       "san martin": "Peru",
    "loja": "Ecuador",
};

function originToCountry(token) {
    const lower = token.toLowerCase().trim();
    for (const country of Object.keys(COUNTRY_COORDS)) {
        if (country.toLowerCase() === lower) return country;
    }
    return REGION_TO_COUNTRY[lower] || null;
}

function loadLeaflet() {
    return new Promise((resolve, reject) => {
        if (window.L) { resolve(); return; }
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function openWorldMap() {
    // Build country → coffee list
    const countryMap = new Map();
    allCoffees.forEach(c => {
        tokenize(c.origin).forEach(token => {
            const country = originToCountry(token);
            if (!country) return;
            if (!countryMap.has(country)) countryMap.set(country, []);
            countryMap.get(country).push(c);
        });
    });

    modalContainer.innerHTML = `
        <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal map-modal">
                <div class="modal-head">
                    <h2>Kaffee-Herkunft</h2>
                    <button class="close-btn" id="closeModal" aria-label="Schließen">×</button>
                </div>
                <div id="worldMapEl" class="world-map-container"></div>
                <p class="map-hint">Kreis anklicken → nach Herkunft filtern</p>
            </div>
        </div>`;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("closeModal").onclick = close;
    document.getElementById("modalBackdrop").addEventListener("click", e => {
        if (e.target.id === "modalBackdrop") close();
    });

    try {
        await loadLeaflet();
    } catch {
        document.getElementById("worldMapEl").innerHTML =
            `<p style="padding:2rem;text-align:center;color:var(--coffee-danger)">Karte konnte nicht geladen werden.</p>`;
        return;
    }

    const map = L.map("worldMapEl", { center: [10, 15], zoom: 2, minZoom: 1, maxZoom: 6 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 6,
    }).addTo(map);

    const maxCount = Math.max(...[...countryMap.values()].map(a => a.length), 1);

    countryMap.forEach((coffees, country) => {
        const coords = COUNTRY_COORDS[country];
        if (!coords) return;
        const count = coffees.length;

        const w = Math.round(20 + (count / maxCount) * 26); // 20–46 px
        const h = Math.round(w * 18 / 14);

        const icon = L.divIcon({
            html: `<svg viewBox="0 0 14 18" width="${w}" height="${h}"
                       xmlns="http://www.w3.org/2000/svg"
                       style="display:block;filter:drop-shadow(0 2px 4px rgba(58,36,24,0.45));">
                     <ellipse cx="7" cy="9" rx="6" ry="7.5" fill="#8B5E3C"/>
                     <path d="M7 1.8 Q7.8 5 7 9 Q6.2 13 7 16.2"
                           fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
                   </svg>`,
            className: "bean-map-marker",
            iconSize:   [w, h],
            iconAnchor: [w / 2, h / 2],
        });

        const marker = L.marker(coords, { icon }).addTo(map);

        marker.bindTooltip(
            `<strong>${country}</strong> &nbsp;${count} Kaffee${count !== 1 ? "s" : ""}`,
            { direction: "top", offset: [0, -(h / 2 + 6)], className: "bean-map-tip" }
        );

        marker.on("click", () => {
            close();
            activeOrigins.clear();
            activeOrigins.add(country);
            const container = document.getElementById("originMultiSelect");
            container.querySelectorAll("input[type='checkbox']").forEach(cb => {
                cb.checked = cb.value === country;
            });
            updateMsLabel(container.querySelector(".ms-label"), activeOrigins);
            filterCoffees();
        });
    });
}

document.getElementById("worldMapBtn").addEventListener("click", openWorldMap);

// ── Boot ──────────────────────────────────────────────────────────────────────

loadAllCoffees();
