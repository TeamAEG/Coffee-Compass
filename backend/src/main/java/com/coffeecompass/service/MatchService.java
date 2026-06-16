package com.coffeecompass.service;

import com.coffeecompass.dto.CoffeeDto;
import com.coffeecompass.dto.QuizRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MatchService {

    // Maps each quiz flavor option to the tasting note keywords it covers.
    // This lets "fruity" match a coffee labelled "blueberry" or "citrus"
    // without requiring an exact word match.
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

    // Scores every coffee in the catalogue against the user's quiz answers,
    // then returns the top 5 matches sorted by score descending.
    // Coffees with a score of 0 or below are excluded entirely.
    public List<Map<String, Object>> match(QuizRequest quiz) {
        List<ScoredCoffee> scored = new ArrayList<>();

        for (CoffeeDto coffee : coffeeService.getAllRaw()) {
            int score = scoreCoffee(coffee, quiz);
            if (score > 0) {
                scored.add(new ScoredCoffee(coffee, score));
            }
        }

        // b before a → descending order (highest score first)
        scored.sort((a, b) -> Integer.compare(b.score, a.score));

        // Wrap each result in a map so the raw score is included in the JSON
        // response alongside the coffee — the frontend uses it to display
        // the "% Match" badge relative to the top result.
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

    // Point values are weighted so roast preference (the strongest signal)
    // dominates, flavor notes add up cumulatively, and brew method is a
    // tiebreaker. Avoided notes apply a heavy penalty to push bad matches
    // below zero so they are filtered out entirely.
    private int scoreCoffee(CoffeeDto coffee, QuizRequest quiz) {
        int score = 0;

        // Roast match is the single biggest signal — worth more than any
        // other category on its own (+40)
        if (quiz.getRoastPreference() != null && coffee.getRoastLevel() != null
                && quiz.getRoastPreference().equalsIgnoreCase(coffee.getRoastLevel())) {
            score += 40;
        }

        // Each matching tasting note adds +15, so coffees with many relevant
        // notes score significantly higher than those with just one
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

        // Strength (mild/balanced/strong) maps to roast level (light/medium/dark)
        if (quiz.getStrength() != null && coffee.getRoastLevel() != null) {
            String s = quiz.getStrength().toLowerCase();
            String r = coffee.getRoastLevel().toLowerCase();
            if (s.equals("strong") && r.equals("dark")) score += 20;
            if (s.equals("balanced") && r.equals("medium")) score += 20;
            if (s.equals("mild") && r.equals("light")) score += 20;
        }

        // Brew method is a secondary signal — espresso suits medium/dark,
        // pour over suits light/medium, French press suits dark
        if (quiz.getBrewMethod() != null && coffee.getRoastLevel() != null) {
            String b = quiz.getBrewMethod().toLowerCase();
            String r = coffee.getRoastLevel().toLowerCase();
            if (b.contains("espresso") && (r.equals("medium") || r.equals("dark"))) score += 10;
            if (b.contains("pour") && (r.equals("light") || r.equals("medium"))) score += 10;
            if (b.contains("french") && r.equals("dark")) score += 10;
        }

        // Avoided notes apply a -25 penalty per matching note — large enough
        // to sink a coffee below zero and exclude it from results entirely
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

    // Temporary pairing of a coffee and its calculated score, used only
    // during sorting before the final response is built
    private record ScoredCoffee(CoffeeDto coffee, int score) {}
}
