# Coffee Compass ☕🧭

Eine Webanwendung zum Entdecken, Speichern und Empfehlen von Kaffees auf Basis persönlicher Vorlieben.

https://coffee-compass.net/

## Tech Stack

- **Backend**: Java 21, Spring Boot 3.2, Maven, H2 (file-based), JWT
- **Frontend**: HTML5, CSS, Vanilla JS (kein Framework)
- **Externe API**: [Loffee Labs Bean Base API](https://beta.loffeelabs.com/developers/documentation)

## Projektstruktur

```
coffee-compass/
├── backend/                  Spring Boot REST API
│   ├── pom.xml
│   └── src/main/java/com/coffeecompass/
│       ├── config/           Security, CORS, RestTemplate
│       ├── controller/       REST Endpoints
│       ├── dto/              Request/Response Objekte
│       ├── model/            JPA Entities
│       ├── repository/       Data Access
│       ├── security/         JWT Filter, JWT Util
│       └── service/          Business-Logik
├── frontend/                 Statisches Frontend
│   ├── index.html            Discover-Seite (Suche, Filter, Autocomplete)
│   ├── login.html            Login/Register
│   ├── favorites.html        Meine Favoriten
│   ├── quiz.html             Find Your Perfect Coffee
│   ├── css/styles.css
│   └── js/
│       ├── api.js            HTTP-Client, Auth, shared helpers
│       ├── utils.js          Shared UI utilities (beanSvg, popBeans, renderBrewContent)
│       ├── main.js           Discover-Seite
│       ├── favorites.js      Favoriten-Seite
│       └── quiz.js           Quiz-Seite
└── surprise/                 Zweite, eigenständige FE-Komponente (S2)
    ├── index.html            "Kaffee-Überraschung" — eine Seite, ein Button
    ├── style.css             Eigenes Styling, unabhängig von frontend/css
    └── app.js                Eigener HTTP-Client (kein Re-Use von js/api.js)
```

## Externe API — Loffee Labs Bean Base

Beim Start ruft das Backend `GET /beans?limit=200` mit einem API-Key im `Authorization`-Header auf. Die Antwort wird auf das interne `CoffeeDto` gemappt.

```
GET https://beta.loffeelabs.com/api/v2/beans?limit=200
Authorization: <API_KEY>
```

**Caching-Strategie (API-Limit schonen):**

1. Beim Start prüft `CoffeeService`, ob die H2-Tabelle `coffee_cache` Einträge enthält, die jünger als 24 Stunden sind.
2. Wenn ja → Daten aus H2 laden (kein Loffee-Labs-Call).
3. Wenn nein → API aufrufen, Ergebnisse in H2 persistieren.
4. Wenn die API nicht erreichbar ist → veraltete H2-Daten als Fallback nutzen; falls kein Cache vorhanden, nur Seed-Daten verwenden.

Da H2 file-basiert ist (`/opt/coffee-compass/data/coffeecompass`), überlebt der Cache Server-Neustarts. Loffee Labs wird also maximal **einmal pro 24 Stunden** aufgerufen, unabhängig davon, wie viele Clients zugreifen oder wie oft der Server neu startet.

Zusätzlich sendet `GET /api/coffees` den HTTP-Header `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`, damit Browser und CDNs die Antwort ebenfalls cachen.

Relevante Felder aus der API-Antwort:

| Loffee Labs Feld | CoffeeDto Feld |
|---|---|
| `roast-name` | `name` |
| `roaster` | `roaster` |
| `origin` + `region` | `origin` |
| `degree` | `roastLevel` (normalisiert zu light/medium/dark) |
| `tasting-tag` | `tastingNotes` |
| `process` | `process` |
| `variety` | `type` |
| `price-low` | `price` |

## API-Übersicht

| Methode | Endpoint                      | Auth | Beschreibung                            |
|---------|-------------------------------|------|-----------------------------------------|
| POST    | /api/auth/register            | nein | Account erstellen                       |
| POST    | /api/auth/login               | nein | Login → JWT zurück                      |
| GET     | /api/coffees                  | nein | Liste aller Kaffees (Query-Params: `roastLevel`, `origin`, `search` — für direkte API-Nutzung; Frontend filtert client-side) |
| GET     | /api/coffees/{id}             | nein | Detail eines Kaffees                    |
| GET     | /api/coffees/{id}/brew        | nein | Brew-Empfehlungen                       |
| GET     | /api/quiz/questions           | nein | Quiz-Fragen                             |
| POST    | /api/match                    | nein | Quiz-Antworten → Top-5-Treffer          |
| GET     | /api/favorites                | ja   | Eigene Favoriten                        |
| POST    | /api/favorites                | ja   | Kaffee zu Favoriten hinzufügen          |
| PUT     | /api/favorites/{id}           | ja   | Favorit komplett ersetzen               |
| PATCH   | /api/favorites/{id}           | ja   | Favorit teilweise updaten (z.B. rating) |
| DELETE  | /api/favorites/{id}           | ja   | Favorit löschen                         |
| GET     | /api/ratings                  | ja   | Eigene Bewertungen abrufen              |
| POST    | /api/ratings/{coffeeId}       | ja   | Kaffee bewerten (1–5)                   |
| DELETE  | /api/ratings/{coffeeId}       | ja   | Bewertung entfernen                     |

Auth-Header für geschützte Endpoints:
```
Authorization: Bearer <JWT>
```

## Zweite FE-Komponente — Kaffee-Überraschung (`surprise/`)

Eigenständige, einseitige Komponente (eigenes HTML/CSS/JS, kein Re-Use von
`frontend/css` oder `frontend/js`). Ein Klick auf "Überrasch mich" liefert
einen zufälligen Kaffee samt Brew-Empfehlung und einem Quiz-Spruch des Tages.

Genutzte BE-Endpoints (alle `permitAll`, kein Login nötig):

| Methode | Endpoint                  | Verwendung                              |
|---------|---------------------------|------------------------------------------|
| GET     | /api/coffees               | Pool an Kaffees, daraus wird zufällig einer gewählt |
| GET     | /api/coffees/{id}/brew      | Brew-Empfehlung für den gewählten Kaffee  |
| GET     | /api/quiz/questions         | Liefert die Quiz-Frage/-Option für den "Spruch des Tages" |

Lokal starten (z.B. mit dem VS Code "Live Server"-Plugin oder
`npx serve -p 8081 surprise`) auf Port **8081** — dieser Origin ist bereits in
`app.cors.allowed-origins` freigegeben, es ist also keine Backend-Änderung
nötig.

## Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `JWT_SECRET` | Secret für JWT-Signierung (HMAC-SHA256) — **mind. 32 Zeichen**, sonst startet die App nicht |
| `LOFFEE_API_KEY` | API-Key für die Loffee Labs Bean Base API |

## Deployment Security

| Maßnahme | Wo umgesetzt |
|---|---|
| Rate Limiting (Login, Registration, alle Endpoints) | nginx — konfiguriert auf dem Deployment-Server |
| HTTPS / TLS | nginx (Reverse Proxy vor Spring Boot) |
| JWT-Secret-Stärke (min. 32 Bytes) | `JwtUtil` — App startet nicht bei zu kurzem Secret |
| Passwort-Mindestlänge (8 Zeichen) | `AuthRequest` DTO Validierung |
| Auth-Pflicht für `/api/favorites` und `/api/ratings` | `SecurityConfig` |

> **Bekanntes Risiko:** `anyRequest().permitAll()` in `SecurityConfig` — neu hinzugefügte Endpoints sind standardmäßig öffentlich, solange keine explizite Regel ergänzt wird. Neue Endpoints immer mit `.authenticated()` oder `.permitAll()` explizit absichern.

## Erfüllte Requirements

### MUST (21 Punkte)

| ID | Anforderung                                    | Wo erfüllt                                                 |
|----|------------------------------------------------|------------------------------------------------------------|
| M1 | Backend als eigenständige Komponente          | Eigenständige Spring-Boot-App in `backend/`                |
| M2 | Frontend als eigenständige Komponente in HTML5/CSS/JS | `frontend/` mit reinem HTML/CSS/JS, ohne Framework  |
| M3 | HTTP(S)-Kommunikation FE↔BE                    | Alle FE-Aufrufe gehen über HTTP an `localhost:8080`        |
| M4 | Asynchroner Datentransfer (AJAX)              | Alle Calls über `fetch()` async, in `js/api.js`            |
| M5 | JSON-Antworten                                 | Spring Boot liefert standardmäßig JSON, alle Endpoints     |
| M6 | GET, POST, PUT, DELETE im BE                  | `FavoriteController` deckt alle 4 ab; auch in anderen Controllern |
| M7 | GET, POST, PUT, DELETE im FE                  | `js/api.js` und `js/favorites.js` nutzen alle 4            |
| M8 | Mind. ein externer REST-Service               | `CoffeeService` ruft Loffee Labs Bean Base API auf         |
| M9 | Session-Management                             | JWT mit Bearer-Token in `Authorization`-Header             |

### SHOULD (8 Punkte)

| ID | Anforderung                                            | Wo erfüllt                                                |
|----|--------------------------------------------------------|-----------------------------------------------------------|
| S1 | Zweiter externer REST-Service                          | **Noch zu ergänzen**                                      |
| S2 | Zweite, eigenständige FE-Komponente mit ≥3 BE-Endpoints | `surprise/` — eigenes HTML/CSS/JS, kein Re-Use von `frontend/`. Nutzt `GET /api/coffees`, `GET /api/coffees/{id}/brew`, `GET /api/quiz/questions` |
| S3 | W3C-Konformes HTML                                    | Valider HTML5 — testbar auf https://validator.w3.org      |
| S4 | Responsive Design                                      | Media Queries in `styles.css` für Mobile (<768px) & Desktop |

### COULD (5 Punkte)

| ID | Anforderung                          | Wo erfüllt                                            |
|----|--------------------------------------|-------------------------------------------------------|
| C1 | Dritter externer REST-Service        | **Noch zu ergänzen**                                  |
| C2 | JSON & XML Antworten                 | `produces = {APPLICATION_JSON, APPLICATION_XML}` auf allen GET/POST/PUT/PATCH-Endpoints (`jackson-dataformat-xml`) |
| C3 | PATCH-Endpoint                       | `PATCH /api/favorites/{id}` in `FavoriteController`   |

## Nächste Schritte

- [ ] Zweiten und dritten externen REST-Service einbinden (S1, C1)
- [ ] Tests in `backend/src/test/java`
- [ ] Scheduled Cache-Refresh (z.B. `@Scheduled` alle 24h) damit kein Server-Neustart für frische Daten nötig ist

## Konzepte erklärt

**JWT (JSON Web Token):** Ein signierter Token, der nach erfolgreichem Login an
das Frontend zurückgegeben wird. Der Token enthält die UserID und einen
Ablaufzeitpunkt, ist mit einem Secret signiert (HMAC-SHA256). Bei jedem Request
sendet das Frontend ihn im Header — das Backend prüft die Signatur und weiß,
welcher User authentifiziert ist. Vorteil: stateless, kein Server-Memory nötig.

**REST:** Architekturstil, der HTTP-Methoden semantisch nutzt. GET liest,
POST erstellt, PUT ersetzt komplett, PATCH ändert teilweise, DELETE löscht.
Resourcen werden über URLs adressiert (`/api/favorites/42`).

**CORS:** Browser blockieren standardmäßig Requests von einem anderen Origin.
Spring Boot konfiguriert CORS-Header (`Access-Control-Allow-Origin`), damit das
Frontend von `localhost:5500` das Backend auf `localhost:8080` ansprechen darf.

**JPA/Hibernate:** Object-Relational Mapping. Java-Klassen mit `@Entity` werden
auf DB-Tabellen abgebildet. `Spring Data JPA` generiert Queries aus Methoden-Namen
(`findByUsername` → `SELECT * FROM users WHERE username = ?`).

**BCrypt:** Hash-Algorithmus für Passwörter. Hat einen Salt eingebaut und ist
absichtlich langsam, um Brute-Force zu erschweren. Wir speichern nie das
Klartext-Passwort, nur den Hash.

**HTTP Caching (`Cache-Control`):** Der Server teilt dem Browser mit, wie lange
eine Antwort lokal gecacht werden darf. `max-age=3600` bedeutet: 1 Stunde gilt
die gecachte Antwort als frisch, kein erneuter Request nötig.
`stale-while-revalidate=86400` erlaubt dem Browser, die veraltete Antwort noch
bis zu 24 Stunden auszuliefern, während er im Hintergrund eine neue holt.

**Client-side Filtering:** Das Frontend lädt beim Start einmalig den gesamten
Kaffee-Katalog und filtert danach komplett im Browser. Das ergibt sofortige
Filter-Reaktion ohne weitere API-Calls und ist bis zu einigen tausend Einträgen
problemlos performant.
