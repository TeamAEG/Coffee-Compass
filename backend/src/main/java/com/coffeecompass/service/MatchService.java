package com.coffeecompass.service;

import com.coffeecompass.dto.CoffeeDto;
import com.coffeecompass.dto.QuizRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MatchService {

    private static final Map<String, Set<String>> FLAVOR_GROUPS = Map.of(
            "fruity", Set.of("berry", "fruit", "citrus", "lemon", "orange", "blueberry", "strawberry", "apple", "peach", "tropical"),
            "chocolate", Set.of("chocolate", "cocoa", "cacao", "fudge", "brownie", "dark chocolate"),
            "nutty", Set.of("nut", "almond", "hazelnut", "peanut", "walnut", "praline"),
            "floral", Set.of("floral", "jasmine", "rose", "lavender", "bergamot"),
            "sweet", Set.of("caramel", "honey", "vanilla", "maple", "toffee", "brown sugar", "molasses")
    );

    private final CoffeeService coffeeService;

    public MatchService(CoffeeService coffeeService) {
        this.coffeeService = coffeeService;
    }

    public List<Map<String, Object>> match(QuizRequest quiz) {
        List<ScoredCoffee> scored = new ArrayList<>();

        for (CoffeeDto coffee : coffeeService.getAllRaw()) {
            int score = scoreCoffee(coffee, quiz);
            if (score > 0) {
                scored.add(new ScoredCoffee(coffee, score));
            }
        }

        scored.sort((a, b) -> Integer.compare(b.score, a.score));

        return scored.stream()
                .limit(5)
                .map(sc -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("coffee", sc.coffee);
                    m.put("matchScore", sc.score);
                    return m;
                })
                .collect(Collectors.toList());
    }

    private int scoreCoffee(CoffeeDto coffee, QuizRequest quiz) {
        int score = 0;

        if (quiz.getRoastPreference() != null && coffee.getRoastLevel() != null
                && quiz.getRoastPreference().equalsIgnoreCase(coffee.getRoastLevel())) {
            score += 40;
        }

        if (quiz.getFlavorPreference() != null && coffee.getTastingNotes() != null) {
            Set<String> wantedFlavors = FLAVOR_GROUPS.getOrDefault(
                    quiz.getFlavorPreference().toLowerCase(), Collections.emptySet());
            for (String note : coffee.getTastingNotes()) {
                String lower = note.toLowerCase();
                if (wantedFlavors.stream().anyMatch(lower::contains)) {
                    score += 15;
                }
            }
        }

        if (quiz.getStrength() != null && coffee.getRoastLevel() != null) {
            String s = quiz.getStrength().toLowerCase();
            String r = coffee.getRoastLevel().toLowerCase();
            if (s.equals("strong") && r.equals("dark")) score += 20;
            if (s.equals("balanced") && r.equals("medium")) score += 20;
            if (s.equals("mild") && r.equals("light")) score += 20;
        }

        if (quiz.getBrewMethod() != null && coffee.getRoastLevel() != null) {
            String b = quiz.getBrewMethod().toLowerCase();
            String r = coffee.getRoastLevel().toLowerCase();
            if (b.contains("espresso") && (r.equals("medium") || r.equals("dark"))) score += 10;
            if (b.contains("pour") && (r.equals("light") || r.equals("medium"))) score += 10;
            if (b.contains("french") && r.equals("dark")) score += 10;
        }

        if (quiz.getAvoidNotes() != null && coffee.getTastingNotes() != null) {
            for (String avoid : quiz.getAvoidNotes()) {
                String al = avoid.toLowerCase();
                for (String note : coffee.getTastingNotes()) {
                    if (note.toLowerCase().contains(al)) {
                        score -= 25;
                    }
                }
            }
        }

        return score;
    }

    private record ScoredCoffee(CoffeeDto coffee, int score) {}
}
