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
let userRatings = new Map();
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
        const [coffees, favs, ratings] = await Promise.all([
            API.listCoffees(params),
            API.listFavorites().catch(() => []),
            API.getRatings().catch(() => [])
        ]);
        currentCoffees = coffees;
        userFavorites = new Map(favs.map(f => [f.coffeeId, f]));
        userRatings = new Map(ratings.map(r => [r.coffeeId, r.rating]));
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
    const rating = userRatings.get(c.id) || 0;
    const isCompared = compareSet.has(c.id);
    const roastClass = c.roastLevel ? `roast-${c.roastLevel.toLowerCase()}` : "roast-medium";
    const roastLabel = c.roastLevel ? c.roastLevel : "—";
    const notes = (c.tastingNotes || []).slice(0, 4)
        .map(n => `<span class="tasting-note">${escapeHtml(n)}</span>`).join("");
    const meta = [c.origin, c.process, c.type].filter(Boolean)
        .map(m => `<span>${escapeHtml(m)}</span>`).join("");

    const starsHtml = Auth.isLoggedIn() ? `
        <div class="card-stars" data-coffee-id="${escapeHtml(c.id)}">
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

listEl.addEventListener("click", async (e) => {
    const star = e.target.closest(".card-star");
    if (star) {
        e.stopPropagation();
        if (!Auth.isLoggedIn()) { window.location.href = "login.html"; return; }
        const coffeeId = star.dataset.coffeeId;
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
        const id = btn.dataset.id;
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
    const rating = userRatings.get(coffeeId) || 0;
    container.querySelectorAll(".card-star").forEach(s => {
        const filled = parseInt(s.dataset.rating, 10) <= rating;
        s.classList.toggle("filled", filled);
        s.innerHTML = beanSvg(filled);
    });
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
        btn.textContent = "☆ Speichern";
        btn.dataset.action = "fav";
        btn.closest(".coffee-card").classList.remove("is-favorite");
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
            { label: "Rösterei",      val: coffee.roaster || "—" },
            { label: "Herkunft",      val: coffee.origin || "—" },
            { label: "Typ",           val: coffee.type || "—" },
            { label: "Prozess",       val: coffee.process || "—" },
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

function popBeans(container, rating) {
    container.querySelectorAll(".card-star").forEach(s => {
        if (parseInt(s.dataset.rating, 10) > rating) return;
        s.classList.remove("bean-popping");
        void s.offsetWidth; // force reflow so re-clicking the same rating re-triggers
        s.style.animationDelay = `${(parseInt(s.dataset.rating, 10) - 1) * 45}ms`;
        s.classList.add("bean-popping");
        s.addEventListener("animationend", () => {
            s.classList.remove("bean-popping");
            s.style.animationDelay = "";
        }, { once: true });
    });
}

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
