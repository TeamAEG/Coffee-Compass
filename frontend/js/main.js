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
    const roastClass = c.roastLevel ? `roast-${c.roastLevel.toLowerCase()}` : "roast-medium";
    const roastLabel = c.roastLevel ? c.roastLevel : "—";
    const notes = (c.tastingNotes || []).slice(0, 4)
        .map(n => `<span class="tasting-note">${escapeHtml(n)}</span>`).join("");
    const meta = [c.origin, c.process, c.type].filter(Boolean)
        .map(m => `<span>${escapeHtml(m)}</span>`).join("");

    return `
        <article class="coffee-card expandable" data-id="${escapeHtml(c.id)}">
            <div class="coffee-card-head">
                <div>
                    <div class="coffee-name">${escapeHtml(c.name)}</div>
                    <div class="coffee-roaster">${escapeHtml(c.roaster || "—")}</div>
                </div>
                <span class="roast-badge ${roastClass}">${escapeHtml(roastLabel)}</span>
            </div>
            <div class="coffee-meta">${meta}</div>
            <div class="tasting-notes">${notes}</div>
            <div class="coffee-actions">
                <button data-action="${isFav ? 'unfav' : 'fav'}" data-id="${escapeHtml(c.id)}">
                    ${isFav ? '★ Favorit' : '☆ Speichern'}
                </button>
            </div>
            <div class="brew-expand" id="brew-${escapeHtml(c.id)}"><div class="brew-expand-inner"></div></div>
            <div class="brew-footer">☕ Klicke für Brew-Infos</div>
        </article>`;
}

listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (btn) {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const coffee = currentCoffees.find(c => c.id === id);
        if (!coffee) return;
        if (action === "fav" || action === "unfav") {
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
    } catch (err) {
        alert("Konnte nicht entfernen: " + err.message);
    } finally {
        btn.disabled = false;
    }
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
