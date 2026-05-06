Auth.requireLogin();

document.getElementById("usernameLabel").textContent = Auth.username() || "";
document.getElementById("logoutBtn").addEventListener("click", () => {
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
            <div class="rating" data-fav-id="${f.id}">${stars}</div>
            ${f.notes ? `<div style="font-style: italic; color: var(--coffee-muted); font-size: 0.9rem; padding: 0.5rem 0;">"${escapeHtml(f.notes)}"</div>` : ""}
            <div class="coffee-actions">
                <button class="secondary" data-action="edit" data-id="${f.id}">Bearbeiten</button>
                <button class="danger" data-action="delete" data-id="${f.id}">Entfernen</button>
            </div>
        </article>`;
}

function renderStars(rating, favId, interactive) {
    let html = "";
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= rating ? 'filled' : ''}" data-rating="${i}" data-fav-id="${favId}">★</span>`;
    }
    return html;
}

listEl.addEventListener("click", async (e) => {
    const star = e.target.closest(".star");
    if (star) {
        const favId = star.dataset.favId;
        const newRating = parseInt(star.dataset.rating, 10);
        await updateRating(favId, newRating);
        return;
    }

    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const fav = favorites.find(f => String(f.id) === String(id));
    if (!fav) return;

    if (btn.dataset.action === "edit") openEditModal(fav);
    else if (btn.dataset.action === "delete") deleteFavorite(fav);
});

async function updateRating(favId, rating) {
    try {
        const updated = await API.patchFavorite(favId, { rating });
        const idx = favorites.findIndex(f => String(f.id) === String(favId));
        if (idx >= 0) favorites[idx] = updated;
        render();
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
                        <h2>Favorit bearbeiten</h2>
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
                        <div class="rating" id="editStars">${renderStars(fav.rating || 0, fav.id)}</div>
                    </div>
                    <div class="form-actions">
                        <button type="submit">Speichern</button>
                        <button type="button" class="secondary" id="cancelEdit">Abbrechen</button>
                    </div>
                </form>
            </div>
        </div>`;

    let currentRating = fav.rating || 0;

    document.getElementById("editStars").addEventListener("click", (e) => {
        const star = e.target.closest(".star");
        if (!star) return;
        currentRating = parseInt(star.dataset.rating, 10);
        document.getElementById("editStars").innerHTML = renderStars(currentRating, fav.id);
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

function closeModal() {
    modalContainer.innerHTML = "";
}

loadFavorites();
