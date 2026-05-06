package com.coffeecompass.service;

import com.coffeecompass.dto.CoffeeDto;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class BrewService {

    public Map<String, Object> recommendFor(CoffeeDto coffee) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("coffeeId", coffee.getId());
        result.put("coffeeName", coffee.getName());

        String roast = coffee.getRoastLevel() == null ? "medium" : coffee.getRoastLevel().toLowerCase();
        List<Map<String, Object>> methods = new ArrayList<>();

        switch (roast) {
            case "light" -> {
                methods.add(method("Pour Over", "V60 oder Chemex", 96,
                        "1:16", "3:00", "Hebt die Säure und florale Noten hervor"));
                methods.add(method("Aeropress", "Inverted method", 92,
                        "1:14", "1:30", "Klare, helle Tasse mit fokussierten Aromen"));
                methods.add(method("Filter", "Batch Brew", 94,
                        "1:17", "4:00", "Sanfter Charakter, leichte Süße"));
            }
            case "medium" -> {
                methods.add(method("Espresso", "9 bar", 93,
                        "1:2", "0:28", "Ausgewogene Süße und Körper"));
                methods.add(method("Pour Over", "Kalita Wave", 94,
                        "1:16", "3:30", "Klassisches Profil mit voller Mitte"));
                methods.add(method("French Press", "Vollimmersion", 95,
                        "1:15", "4:00", "Reichhaltiger Körper und Schokoladennoten"));
            }
            case "dark" -> {
                methods.add(method("Espresso", "9 bar", 92,
                        "1:2", "0:30", "Bitter-süß, kräftige Crema"));
                methods.add(method("Moka Pot", "Stovetop", 90,
                        "1:7", "4:00", "Intensiv, dicht, klassisch italienisch"));
                methods.add(method("Cold Brew", "Konzentrat", 20,
                        "1:8", "16h", "Weich, schokoladig, sehr niedrige Säure"));
            }
            default -> methods.add(method("Pour Over", "V60", 94,
                    "1:16", "3:00", "Universelle Methode für die meisten Bohnen"));
        }

        result.put("roastLevel", roast);
        result.put("methods", methods);
        return result;
    }

    private Map<String, Object> method(String name, String setup, int waterTempC,
                                       String ratio, String time, String description) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("setup", setup);
        m.put("waterTempC", waterTempC);
        m.put("ratio", ratio);
        m.put("time", time);
        m.put("description", description);
        return m;
    }
}
