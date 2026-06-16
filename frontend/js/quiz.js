// =============================================================================
// QUIZ PAGE (quiz.js) – "Find Your Perfect Coffee"
//
// Quick map of this file:
//   Navbar              – Login/Logout button
//   Cached DOM elements & state
//   init                – load the quiz questions
//   renderStep          – show one question at a time, with progress bar
//   renderSubmit        – send answers to the backend, get top matches
//   renderResults / renderMatchCard – show the recommended coffees
//   Detail modal         – full coffee details + brew tips
//   handleResultClick   – save-to-favorites / open-details buttons on results
//   restart             – reset and start the quiz again
//   Boot                – starts everything
// =============================================================================

// ── Navbar: show "Login" or "Logout" depending on whether the user is signed in ──
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

// ── Cached DOM elements & shared state ───────────────────────────────────────
// `answers` collects { questionKey: chosenValue } as the user goes through the quiz.
const quizArea = document.getElementById("quizArea");
const modalContainer = document.getElementById("modalContainer");

let questions = [];
let currentStep = 0;
let answers = {};
let resultClickBound = false;

// Loads the quiz questions from the backend and shows the first one.
async function init() {
    quizArea.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
    try {
        questions = await API.quizQuestions();
        renderStep();
    } catch (err) {
        quizArea.innerHTML = `<div class="alert alert-error">Konnte Quiz nicht laden: ${escapeHtml(err.message)}</div>`;
    }
}

// Renders the current question (with progress bar + Zurück/Weiter buttons).
// Once all questions are answered, switches to the results view.
function renderStep() {
    if (currentStep >= questions.length) {
        renderSubmit();
        return;
    }
    const q = questions[currentStep];
    const progress = (currentStep / questions.length) * 100;
    const selected = answers[q.key];

    quizArea.innerHTML = `
        <div class="quiz-card">
            <div class="quiz-progress">
                <div class="quiz-progress-bar" style="width: ${progress}%"></div>
            </div>
            <p style="color: var(--coffee-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">
                Frage ${currentStep + 1} von ${questions.length}
            </p>
            <div class="quiz-question">${escapeHtml(q.question)}</div>
            <div class="quiz-options">
                ${q.options.map(opt => `
                    <button class="quiz-option ${selected === opt.value ? 'selected' : ''}"
                            data-value="${escapeHtml(opt.value)}"
                            data-key="${escapeHtml(q.key)}">
                        ${escapeHtml(opt.label)}
                    </button>
                `).join("")}
            </div>
            <div class="quiz-nav">
                <button class="secondary" id="prevBtn" ${currentStep === 0 ? 'disabled' : ''}>Zurück</button>
                <button id="nextBtn" ${!selected ? 'disabled' : ''}>
                    ${currentStep === questions.length - 1 ? 'Ergebnisse zeigen' : 'Weiter'}
                </button>
            </div>
        </div>`;

    document.querySelectorAll(".quiz-option").forEach(btn => {
        btn.addEventListener("click", () => {
            answers[btn.dataset.key] = btn.dataset.value;
            renderStep();
        });
    });

    document.getElementById("prevBtn").addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep--;
            renderStep();
        }
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
        currentStep++;
        renderStep();
    });
}

// Sends all collected answers to the backend and shows the resulting matches.
async function renderSubmit() {
    quizArea.innerHTML = `
        <div class="quiz-card">
            <div class="loading-overlay">
                <div class="spinner"></div>
                <p style="margin-top: 0.6rem;">Suche perfekten Kaffee...</p>
            </div>
        </div>`;
    try {
        const matches = await API.match(answers);
        renderResults(matches);
    } catch (err) {
        quizArea.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
}

// Shows the top coffee matches as cards, ranked by match score.
function renderResults(matches) {
    if (!matches.length) {
        quizArea.innerHTML = `
            <div class="quiz-card">
                <h2>Keine Treffer</h2>
                <p>Wir haben keinen passenden Kaffee gefunden. Probier andere Antworten!</p>
                <div class="form-actions"><button id="restartBtn">Neu starten</button></div>
            </div>`;
        document.getElementById("restartBtn").onclick = restart;
        return;
    }

    const max = Math.max(...matches.map(m => m.matchScore)); //"..." spread operator, unpacks Array

    quizArea.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <h2>Deine Top-Empfehlungen</h2>
            <p style="color: var(--coffee-muted);">Basierend auf deinen Antworten</p>
        </div>
        <div class="coffee-grid">
            ${matches.map(m => renderMatchCard(m, max)).join("")}
        </div>
        <div style="text-align: center; margin-top: 2rem;">
            <button id="restartBtn" class="secondary">Quiz neu starten</button>
        </div>`;

    document.getElementById("restartBtn").onclick = restart;
    // renderResults() can run again after a restart, so only attach this once —
    // otherwise duplicate listeners pile up and handleResultClick fires multiple
    // times per click.
    if (!resultClickBound) {
        quizArea.addEventListener("click", handleResultClick);
        resultClickBound = true;
    }
}

// Renders a single match card, including its match-score percentage.
function renderMatchCard(m, maxScore) {
    const c = m.coffee;
    const pct = Math.round((m.matchScore / maxScore) * 100);
    const roastClass = c.roastLevel ? `roast-${c.roastLevel.toLowerCase()}` : "roast-medium";
    const notes = (c.tastingNotes || []).slice(0, 4)
        .map(n => `<span class="tasting-note">${escapeHtml(n)}</span>`).join("");

    return `
        <article class="coffee-card" data-id="${escapeHtml(c.id)}">
            <div class="coffee-card-head">
                <div>
                    <div class="coffee-name">${escapeHtml(c.name)}</div>
                    <div class="coffee-roaster">${escapeHtml(c.roaster || "—")}</div>
                </div>
                <span class="roast-badge ${roastClass}">${escapeHtml(c.roastLevel || "—")}</span>
            </div>
            <div><span class="match-score">${pct}% Match</span></div>
            <div style="font-size: 0.9rem; color: var(--coffee-muted);">${escapeHtml(c.origin || "")}</div>
            <div class="tasting-notes">${notes}</div>
            <div class="coffee-actions">
                <button class="secondary detail-btn" data-action="detail" data-id="${escapeHtml(c.id)}">Details</button>
                <button data-action="save" data-id="${escapeHtml(c.id)}">★ Zu Favoriten</button>
            </div>
        </article>`;
}


// ── Detail modal ──────────────────────────────────────────────────────────────
// Same pattern as on the Discover page: fetch coffee + brew info and show them
// in a modal.
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

// Click handler for the results grid (event delegation): "Details" opens the
// modal above, "★ Zu Favoriten" saves that coffee to the user's favorites.
async function handleResultClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) {
        const card = e.target.closest(".coffee-card");
        if (card) openDetailModal(card.dataset.id);
        return;
    }
    const action = btn.dataset.action;
    const coffeeId = btn.dataset.id;

    if (action === "detail") {
        openDetailModal(coffeeId);
        return;
    }

    if (action === "save") {
        const card = btn.closest(".coffee-card");
        const name = card.querySelector(".coffee-name").textContent;
        const roaster = card.querySelector(".coffee-roaster").textContent;
        const roastLevel = card.querySelector(".roast-badge").textContent;

        if (!Auth.isLoggedIn()) {
            window.location.href = "login.html";
            return;
        }
        btn.disabled = true;
        try {
            await API.addFavorite({
                coffeeId, coffeeName: name, roaster,
                roastLevel: roastLevel === "—" ? null : roastLevel,
                notes: "", rating: 0
            });
            btn.textContent = "✓ Gespeichert";
        } catch (err) {
            if (err.message.includes("already")) {
                btn.textContent = "★ Bereits Favorit";
            } else {
                btn.textContent = "Fehler";
                btn.disabled = false;
            }
        }
    }
}

// Resets the quiz state and shows the first question again.
function restart() {
    currentStep = 0;
    answers = {};
    renderStep();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
