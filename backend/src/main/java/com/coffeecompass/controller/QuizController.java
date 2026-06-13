package com.coffeecompass.controller;

import com.coffeecompass.dto.QuizRequest;
import com.coffeecompass.service.MatchService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
public class QuizController {

    private final MatchService matchService;

    public QuizController(MatchService matchService) {
        this.matchService = matchService;
    }

    @GetMapping(value = "/api/quiz/questions", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE})
    public ResponseEntity<List<Map<String, Object>>> questions() {
        List<Map<String, Object>> questions = new ArrayList<>();

        questions.add(question("roastPreference",
                "Welche Röstung magst du am liebsten?",
                List.of(
                        opt("light", "Hell — fruchtig & lebendig"),
                        opt("medium", "Mittel — ausgewogen"),
                        opt("dark", "Dunkel — kräftig & schokoladig")
                )));

        questions.add(question("flavorPreference",
                "Welches Geschmacksprofil zieht dich an?",
                List.of(
                        opt("fruity", "Fruchtig (Beeren, Zitrus)"),
                        opt("chocolate", "Schokoladig"),
                        opt("nutty", "Nussig"),
                        opt("floral", "Floral"),
                        opt("sweet", "Süß (Karamell, Honig, Vanille)")
                )));

        questions.add(question("brewMethod",
                "Wie brühst du am liebsten?",
                List.of(
                        opt("espresso", "Espresso"),
                        opt("pour-over", "Pour Over / V60"),
                        opt("french-press", "French Press"),
                        opt("filter", "Filter / Batch Brew")
                )));

        questions.add(question("strength",
                "Wie stark soll dein Kaffee sein?",
                List.of(
                        opt("mild", "Mild & sanft"),
                        opt("balanced", "Ausgewogen"),
                        opt("strong", "Kräftig & intensiv")
                )));

        return ResponseEntity.ok(questions);
    }

    @PostMapping(value = "/api/match", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE})
    public ResponseEntity<List<Map<String, Object>>> match(@RequestBody QuizRequest quiz) {
        return ResponseEntity.ok(matchService.match(quiz));
    }

    private Map<String, Object> question(String key, String text, List<Map<String, String>> options) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("key", key);
        q.put("question", text);
        q.put("options", options);
        return q;
    }

    private Map<String, String> opt(String value, String label) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("value", value);
        m.put("label", label);
        return m;
    }
}
