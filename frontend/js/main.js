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

const listEl = document.getElementById("coffeeList");
const messageBox = document.getElementById("messageBox");
const searchInput = document.getElementById("search");
const roastFilter = document.getElementById("roastFilter");
const originFilter = document.getElementById("originFilter");
const resetBtn = document.getElementById("resetBtn");
const modalContainer = document.getElementById("modalContainer");

let currentCoffees = [];
let userFavorites = new Map();
const compareSet = new Set();

let debounceTimer = null;
function debounce(fn, ms = 300) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
}

async function loadCoffees() {
    listEl.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><p style="margin-top: 0.6rem;">Lade Kaffees...</p></div>`;
    messageBox.innerHTML = "";
    try {
        const params = {
            search: searchInput.value.trim(),
            roastLevel: roastFilter.value,
            origin: originFilter.value.trim()
        };
        const [coffees, favs] = await Promise.all([
            API.listCoffees(params),
            API.listFavorites().catch(() => [])
        ]);
        currentCoffees = coffees;
        userFavorites = new Map(favs.map(f => [f.coffeeId, f]));
        renderCoffees(coffees);
    } catch (err) {
        showError(messageBox, "Fehler beim Laden: " + err.message);
        listEl.innerHTML = "";
    }
}

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
    const isFav = userFavorites.has(c.id);
    const fav = userFavorites.get(c.id);
    const rating = fav ? (fav.rating || 0) : 0;
    const isCompared = compareSet.has(c.id);
    const roastClass = c.roastLevel ? `roast-${c.roastLevel.toLowerCase()}` : "roast-medium";
    const roastLabel = c.roastLevel ? c.roastLevel : "—";
    const notes = (c.tastingNotes || []).slice(0, 4)
        .map(n => `<span class="tasting-note">${escapeHtml(n)}</span>`).join("");
    const meta = [c.origin, c.process, c.type].filter(Boolean)
        .map(m => `<span>${escapeHtml(m)}</span>`).join("");

    const starsHtml = isFav ? `
        <div class="card-stars" data-coffee-id="${escapeHtml(c.id)}">
            ${[1,2,3,4,5].map(i =>
                `<span class="card-star ${i <= rating ? 'filled' : ''}" data-rating="${i}" data-coffee-id="${escapeHtml(c.id)}">★</span>`
            ).join("")}
        </div>` : "";

    return `
        <article class="coffee-card expandable ${isFav ? 'is-favorite' : ''} ${isCompared ? 'is-compared' : ''}" data-id="${escapeHtml(c.id)}">
            <div class="coffee-card-head">
                <div>
                    <div class="coffee-name">${escapeHtml(c.name)}</div>
                    <div class="coffee-roaster">${escapeHtml(c.roaster || "—")}</div>
                </div>
                <span class="roast-badge ${roastClass}">${escapeHtml(roastLabel)}</span>
            </div>
            <div class="coffee-meta">${meta}</div>
            <div class="tasting-notes">${notes}</div>
            ${starsHtml}
            <div class="coffee-actions">
                <button class="compare-btn ${isCompared ? 'active' : ''}" data-action="compare" data-id="${escapeHtml(c.id)}" title="Zum Vergleich hinzufügen">⇄</button>
                <button data-action="${isFav ? 'unfav' : 'fav'}" data-id="${escapeHtml(c.id)}">
                    ${isFav ? '★ Favorit' : '☆ Speichern'}
                </button>
            </div>
            <div class="brew-expand" id="brew-${escapeHtml(c.id)}"><div class="brew-expand-inner"></div></div>
            <div class="brew-footer">☕ Klicke für Brew-Infos</div>
        </article>`;
}

listEl.addEventListener("click", async (e) => {
    const star = e.target.closest(".card-star");
    if (star) {
        e.stopPropagation();
        if (!Auth.isLoggedIn()) { window.location.href = "login.html"; return; }
        const coffeeId = star.dataset.coffeeId;
        const newRating = parseInt(star.dataset.rating, 10);
        const fav = userFavorites.get(coffeeId);
        if (!fav) return;
        try {
            await API.patchFavorite(fav.id, { rating: newRating });
            userFavorites.set(coffeeId, { ...fav, rating: newRating });
            const container = document.querySelector(`.card-stars[data-coffee-id="${coffeeId}"]`);
            if (container) {
                container.querySelectorAll(".card-star").forEach(s => {
                    s.classList.toggle("filled", parseInt(s.dataset.rating) <= newRating);
                });
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
        const id = btn.dataset.id;
        const coffee = currentCoffees.find(c => c.id === id);
        if (!coffee) return;
        if (action === "compare") {
            toggleCompare(id, btn);
        } else if (action === "fav" || action === "unfav") {
            if (!Auth.isLoggedIn()) { window.location.href = "login.html"; return; }
            if (action === "fav") await addFavorite(coffee, btn);
            else await removeFavorite(coffee, btn);
        }
        return;
    }

    const card = e.target.closest(".coffee-card.expandable");
    if (!card) return;
    const id = card.dataset.id;
    const brewEl = document.getElementById(`brew-${id}`);
    if (!brewEl) return;

    const isOpen = brewEl.classList.contains("open");
    if (isOpen) { brewEl.classList.remove("open"); return; }

    brewEl.classList.add("open");
    const inner = brewEl.querySelector(".brew-expand-inner");
    if (inner.dataset.loaded) return;
    inner.dataset.loaded = "true";
    inner.innerHTML = `<div class="loading-overlay" style="position:relative;height:60px;"><div class="spinner"></div></div>`;
    try {
        const brew = await API.getBrew(id);
        inner.innerHTML = renderBrewContent(brew);
    } catch (err) {
        inner.innerHTML = `<div class="alert alert-error">Fehler: ${escapeHtml(err.message)}</div>`;
    }
});

async function addFavorite(coffee, btn) {
    btn.disabled = true;
    try {
        const fav = await API.addFavorite({
            coffeeId: coffee.id,
            coffeeName: coffee.name,
            roaster: coffee.roaster,
            roastLevel: coffee.roastLevel,
            notes: "",
            rating: 0
        });
        userFavorites.set(coffee.id, fav);
        btn.textContent = "★ Favorit";
        btn.dataset.action = "unfav";
        const card = btn.closest(".coffee-card");
        card.classList.add("is-favorite");
        const starsDiv = document.createElement("div");
        starsDiv.className = "card-stars";
        starsDiv.dataset.coffeeId = coffee.id;
        starsDiv.innerHTML = [1,2,3,4,5].map(i =>
            `<span class="card-star" data-rating="${i}" data-coffee-id="${escapeHtml(coffee.id)}">★</span>`
        ).join("");
        card.querySelector(".coffee-actions").before(starsDiv);
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
        btn.textContent = "☆ Speichern";
        btn.dataset.action = "fav";
        const card = btn.closest(".coffee-card");
        card.classList.remove("is-favorite");
        const starsDiv = card.querySelector(".card-stars");
        if (starsDiv) starsDiv.remove();
    } catch (err) {
        alert("Konnte nicht entfernen: " + err.message);
    } finally {
        btn.disabled = false;
    }
}

function toggleCompare(id, btn) {
    if (compareSet.has(id)) {
        compareSet.delete(id);
        btn.classList.remove("active");
        btn.closest(".coffee-card").classList.remove("is-compared");
    } else {
        if (compareSet.size >= 3) {
            alert("Du kannst maximal 3 Kaffees vergleichen.");
            return;
        }
        compareSet.add(id);
        btn.classList.add("active");
        btn.closest(".coffee-card").classList.add("is-compared");
    }
    updateCompareBar();
}

function updateCompareBar() {
    const bar = document.getElementById("compareBar");
    const chips = document.getElementById("compareChips");
    const nowBtn = document.getElementById("compareNowBtn");

    if (compareSet.size === 0) {
        bar.classList.remove("visible");
        return;
    }
    bar.classList.add("visible");
    nowBtn.textContent = `Jetzt vergleichen (${compareSet.size})`;
    chips.innerHTML = [...compareSet].map(id => {
        const coffee = currentCoffees.find(c => c.id === id);
        if (!coffee) return "";
        return `<span class="compare-chip">${escapeHtml(coffee.name)}<button class="compare-chip-remove" data-remove-id="${escapeHtml(id)}">✕</button></span>`;
    }).join("");

    chips.querySelectorAll(".compare-chip-remove").forEach(b => {
        b.addEventListener("click", (e) => {
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

function openCompareModal() {
    const coffees = [...compareSet].map(id => currentCoffees.find(c => c.id === id)).filter(Boolean);
    if (coffees.length < 2) { alert("Bitte mindestens 2 Kaffees auswählen."); return; }

    const fields = [
        { label: "Rösterei",      val: c => c.roaster || "—" },
        { label: "Herkunft",      val: c => c.origin || "—" },
        { label: "Typ",           val: c => c.type || "—" },
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
    document.getElementById("modalBackdrop").addEventListener("click", (e) => {
        if (e.target.id === "modalBackdrop") modalContainer.innerHTML = "";
    });
}

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

searchInput.addEventListener("input", () => debounce(loadCoffees, 350));
roastFilter.addEventListener("change", loadCoffees);
originFilter.addEventListener("input", () => debounce(loadCoffees, 350));
resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    roastFilter.value = "";
    originFilter.value = "";
    loadCoffees();
});

loadCoffees();
