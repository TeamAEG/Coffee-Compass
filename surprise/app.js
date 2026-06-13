const API_BASE = "https://coffee-compass.net/api";

const resultEl = document.getElementById("result");
const btn = document.getElementById("surpriseBtn");

let coffees = null;
let questions = null;

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function loadPools() {
    const [coffeeRes, questionRes] = await Promise.all([
        fetch(`${API_BASE}/coffees`),
        fetch(`${API_BASE}/quiz/questions`)
    ]);
    if (!coffeeRes.ok || !questionRes.ok) throw new Error("Daten konnten nicht geladen werden");
    coffees = await coffeeRes.json();
    questions = await questionRes.json();
}

async function surprise() {
    btn.disabled = true;
    resultEl.innerHTML = `<p class="loading">Mische die Bohnen...</p>`;
    try {
        if (!coffees || !questions) await loadPools();

        const coffee = randomFrom(coffees);
        const brewRes = await fetch(`${API_BASE}/coffees/${encodeURIComponent(coffee.id)}/brew`);
        if (!brewRes.ok) throw new Error("Brew-Empfehlung konnte nicht geladen werden");
        const brew = await brewRes.json();

        const question = randomFrom(questions);
        const option = randomFrom(question.options);

        resultEl.innerHTML = renderResult(coffee, brew, question, option);
    } catch (err) {
        resultEl.innerHTML = `<p class="error">Ups, da ist was schiefgelaufen: ${escapeHtml(err.message)}</p>`;
    } finally {
        btn.disabled = false;
    }
}

function renderResult(coffee, brew, question, option) {
    const notes = (coffee.tastingNotes || [])
        .map(n => `<span class="chip">${escapeHtml(n)}</span>`)
        .join("");

    const methods = (brew.methods || [])
        .map(m => `
            <div class="method">
                <strong>${escapeHtml(m.name)}</strong> — ${escapeHtml(m.setup)}<br>
                ${m.waterTempC}°C · ${escapeHtml(m.ratio)} · ${escapeHtml(m.time)}<br>
                <em>${escapeHtml(m.description)}</em>
            </div>`)
        .join("");

    return `
        <h2>${escapeHtml(coffee.name)}</h2>
        <p class="meta">${escapeHtml(coffee.roaster || "—")} · ${escapeHtml(coffee.origin || "—")}</p>
        <div class="chips">${notes}</div>
        <hr>
        <h3>Brew-Empfehlung</h3>
        ${methods}
        <hr>
        <h3>Spruch des Tages</h3>
        <p class="fortune">${escapeHtml(question.question)}<br>→ <strong>${escapeHtml(option.label)}</strong></p>
    `;
}

btn.addEventListener("click", surprise);
surprise();
