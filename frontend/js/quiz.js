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

const quizArea = document.getElementById("quizArea");
const modalContainer = document.getElementById("modalContainer");

let questions = [];
let currentStep = 0;
let answers = {};

async function init() {
    quizArea.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
    try {
        questions = await API.quizQuestions();
        renderStep();
    } catch (err) {
        quizArea.innerHTML = `<div class="alert alert-error">Konnte Quiz nicht laden: ${escapeHtml(err.message)}</div>`;
    }
}

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

    const max = Math.max(...matches.map(m => m.matchScore));

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
    quizArea.addEventListener("click", handleResultClick);
}

function renderMatchCard(m, maxScore) {
    const c = m.coffee;
    const pct = Math.round((m.matchScore / maxScore) * 100);
    const roastClass = c.roastLevel ? `roast-${c.roastLevel.toLowerCase()}` : "roast-medium";
    const notes = (c.tastingNotes || []).slice(0, 4)
        .map(n => `<span class="tasting-note">${escapeHtml(n)}</span>`).join("");

    return `
        <article class="coffee-card">
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
                <button data-action="save" data-id="${escapeHtml(c.id)}">★ Zu Favoriten</button>
            </div>
        </article>`;
}

async function handleResultClick(e) {
    const btn = e.target.closest("button[data-action='save']");
    if (!btn) return;
    const coffeeId = btn.dataset.id;
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

function restart() {
    currentStep = 0;
    answers = {};
    renderStep();
}

init();
