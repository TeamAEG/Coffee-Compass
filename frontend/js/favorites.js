Auth.requireLogin();

document.getElementById("usernameLabel").textContent = Auth.username() || "";
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.textContent = "Logout";
logoutBtn.addEventListener("click", () => {
    Auth.clear();
    window.location.href = "login.html";
});

const listEl = document.getElementById("favoritesList");
const messageBox = document.getElementById("messageBox");
const modalContainer = document.getElementById("modalContainer");

let favorites = [];

async function loadFavorites() {
    listEl.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
    messageBox.innerHTML = "";
    try {
        favorites = await API.listFavorites();
        render();
    } catch (err) {
        showError(messageBox, err.message);
        listEl.innerHTML = "";
    }
}

function render() {
    if (!favorites.length) {
        listEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">★</div>
                <p>Noch keine Favoriten. Speichere Kaffees auf der <a href="index.html">Entdecken-Seite</a>.</p>
            </div>`;
        return;
    }
    listEl.innerHTML = favorites.map(renderCard).join("");
}

function renderCard(f) {
    const roastClass = f.roastLevel ? `roast-${f.roastLevel.toLowerCase()}` : "roast-medium";
    const stars = renderStars(f.rating || 0, f.id, false);
    return `
        <article class="coffee-card" data-id="${f.id}">
            <div class="coffee-card-head">
                <div>
                    <div class="coffee-name">${escapeHtml(f.coffeeName)}</div>
                    <div class="coffee-roaster">${escapeHtml(f.roaster || "—")}</div>
                </div>
                <span class="roast-badge ${roastClass}">${escapeHtml(f.roastLevel || "—")}</span>
            </div>
            <div class="card-stars" data-fav-id="${f.id}">${stars}</div>
            ${f.notes ? `<div style="font-style: italic; color: var(--coffee-muted); font-size: 0.9rem; padding: 0.5rem 0;">"${escapeHtml(f.notes)}"</div>` : ""}
            <div class="coffee-actions">
                <button class="secondary" data-action="edit" data-id="${f.id}">Notizen</button>
                <button class="secondary detail-btn" data-action="detail" data-id="${f.id}" data-coffee-id="${escapeHtml(String(f.coffeeId))}">Details</button>
                <button class="danger" data-action="delete" data-id="${f.id}">Entfernen</button>
            </div>
        </article>`;
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

function renderStars(rating, favId) {
    let html = "";
    for (let i = 1; i <= 5; i++) {
        html += `<span class="card-star ${i <= rating ? 'filled' : ''}" data-rating="${i}" data-fav-id="${favId}">${beanSvg(i <= rating)}</span>`;
    }
    return html;
}

listEl.addEventListener("click", async (e) => {
    const star = e.target.closest(".card-star");
    if (star) {
        const favId = star.dataset.favId;
        const newRating = parseInt(star.dataset.rating, 10);
        await updateRating(favId, newRating);
        return;
    }

    const btn = e.target.closest("button[data-action]");
    if (btn) {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === "detail") {
            openDetailModal(btn.dataset.coffeeId);
            return;
        }
        const fav = favorites.find(f => String(f.id) === String(id));
        if (!fav) return;
        if (action === "edit") openEditModal(fav);
        else if (action === "delete") deleteFavorite(fav);
        return;
    }

    const card = e.target.closest(".coffee-card");
    if (!card) return;
    const fav = favorites.find(f => String(f.id) === String(card.dataset.id));
    if (fav) openDetailModal(fav.coffeeId);
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
    const favId = container.dataset.favId;
    const fav = favorites.find(f => String(f.id) === String(favId));
    const rating = fav ? (fav.rating || 0) : 0;
    container.querySelectorAll(".card-star").forEach(s => {
        const filled = parseInt(s.dataset.rating, 10) <= rating;
        s.classList.toggle("filled", filled);
        s.innerHTML = beanSvg(filled);
    });
});

async function updateRating(favId, rating) {
    try {
        const updated = await API.patchFavorite(favId, { rating });
        const idx = favorites.findIndex(f => String(f.id) === String(favId));
        if (idx >= 0) favorites[idx] = updated;
        render();
        const container = document.querySelector(`.card-stars[data-fav-id="${favId}"]`);
        if (container) popBeans(container, rating);
    } catch (err) {
        alert("Bewertung fehlgeschlagen: " + err.message);
    }
}

function openEditModal(fav) {
    modalContainer.innerHTML = `
        <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal">
                <div class="modal-head">
                    <div>
                        <h2>Notizen</h2>
                        <p style="color: var(--coffee-muted); font-size: 0.9rem;">${escapeHtml(fav.coffeeName)}</p>
                    </div>
                    <button class="close-btn" id="closeModal" aria-label="Schließen">×</button>
                </div>
                <form id="editForm">
                    <div class="form-group">
                        <label for="editNotes">Deine Notizen</label>
                        <textarea id="editNotes" rows="4" maxlength="500" placeholder="Wie hat er geschmeckt? Wann zubereitet?">${escapeHtml(fav.notes || "")}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Bewertung</label>
                        <div class="card-stars" id="editStars">${renderStars(fav.rating || 0, fav.id)}</div>
                    </div>
                    <div class="form-actions">
                        <button type="submit">Speichern</button>
                        <button type="button" class="secondary" id="cancelEdit">Abbrechen</button>
                    </div>
                </form>
            </div>
        </div>`;

    let currentRating = fav.rating || 0;

    const editStarsEl = document.getElementById("editStars");

    editStarsEl.addEventListener("click", (e) => {
        const star = e.target.closest(".card-star");
        if (!star) return;
        currentRating = parseInt(star.dataset.rating, 10);
        editStarsEl.innerHTML = renderStars(currentRating, fav.id);
        popBeans(editStarsEl, currentRating);
    });

    editStarsEl.addEventListener("mouseover", (e) => {
        const star = e.target.closest(".card-star");
        if (!star) return;
        const hoverRating = parseInt(star.dataset.rating, 10);
        editStarsEl.querySelectorAll(".card-star").forEach(s => {
            s.innerHTML = beanSvg(parseInt(s.dataset.rating, 10) <= hoverRating);
        });
    });

    editStarsEl.addEventListener("mouseout", (e) => {
        if (editStarsEl.contains(e.relatedTarget)) return;
        editStarsEl.querySelectorAll(".card-star").forEach(s => {
            s.innerHTML = beanSvg(parseInt(s.dataset.rating, 10) <= currentRating);
        });
    });

    document.getElementById("closeModal").onclick = closeModal;
    document.getElementById("cancelEdit").onclick = closeModal;
    document.getElementById("modalBackdrop").addEventListener("click", (e) => {
        if (e.target.id === "modalBackdrop") closeModal();
    });

    document.getElementById("editForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const notes = document.getElementById("editNotes").value;
        try {
            const updated = await API.updateFavorite(fav.id, {
                coffeeId: fav.coffeeId,
                coffeeName: fav.coffeeName,
                roaster: fav.roaster,
                roastLevel: fav.roastLevel,
                notes: notes,
                rating: currentRating
            });
            const idx = favorites.findIndex(f => f.id === fav.id);
            if (idx >= 0) favorites[idx] = updated;
            closeModal();
            render();
        } catch (err) {
            alert("Fehler: " + err.message);
        }
    });
}

async function deleteFavorite(fav) {
    if (!confirm(`"${fav.coffeeName}" aus Favoriten entfernen?`)) return;
    try {
        await API.deleteFavorite(fav.id);
        favorites = favorites.filter(f => f.id !== fav.id);
        render();
    } catch (err) {
        alert("Fehler: " + err.message);
    }
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

function closeModal() {
    modalContainer.innerHTML = "";
}

loadFavorites();
