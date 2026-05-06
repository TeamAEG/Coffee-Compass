package com.coffeecompass.service;

import com.coffeecompass.dto.CoffeeDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CoffeeService {

    private static final Logger log = LoggerFactory.getLogger(CoffeeService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String externalBaseUrl;

    private final Map<String, CoffeeDto> coffeeIndex = new LinkedHashMap<>();

    public CoffeeService(RestTemplate restTemplate,
                         ObjectMapper objectMapper,
                         @Value("${app.external.thirdwave-base-url}") String externalBaseUrl) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.externalBaseUrl = externalBaseUrl;
    }

    @PostConstruct
    public void init() {
        loadSeedData();
        tryLoadExternalData();
        log.info("Coffee Compass loaded {} coffees in total", coffeeIndex.size());
    }

    private void loadSeedData() {
        try (InputStream is = getClass().getResourceAsStream("/seed-coffees.json")) {
            if (is == null) {
                log.warn("seed-coffees.json not found");
                return;
            }
            JsonNode root = objectMapper.readTree(is);
            for (JsonNode node : root) {
                CoffeeDto dto = objectMapper.treeToValue(node, CoffeeDto.class);
                coffeeIndex.put(dto.getId(), dto);
            }
            log.info("Loaded {} seed coffees", coffeeIndex.size());
        } catch (Exception e) {
            log.error("Failed to load seed data", e);
        }
    }

    private void tryLoadExternalData() {
        try {
            String url = externalBaseUrl + "/coffees";
            String body = restTemplate.getForObject(url, String.class);
            if (body == null) return;
            JsonNode root = objectMapper.readTree(body);
            JsonNode list = root.isArray() ? root : root.path("coffees");
            int added = 0;
            for (JsonNode node : list) {
                CoffeeDto dto = mapExternal(node);
                if (dto != null && !coffeeIndex.containsKey(dto.getId())) {
                    coffeeIndex.put(dto.getId(), dto);
                    added++;
                }
            }
            log.info("Loaded {} external coffees from {}", added, url);
        } catch (Exception e) {
            log.warn("External API unavailable, continuing with seed data only: {}", e.getMessage());
        }
    }

    private CoffeeDto mapExternal(JsonNode node) {
        String id = node.path("id").asText(null);
        String name = node.path("name").asText(null);
        if (id == null || name == null) return null;

        CoffeeDto dto = new CoffeeDto();
        dto.setId("ext-" + id);
        dto.setName(name);
        dto.setRoaster(node.path("roaster").asText(null));
        dto.setOrigin(node.path("origin").asText(null));
        dto.setType(node.path("type").asText(null));
        dto.setProcess(node.path("process").asText(null));
        dto.setRoastLevel(node.path("roastLevel").asText(null));
        dto.setDescription(node.path("description").asText(null));
        if (node.has("price")) dto.setPrice(node.path("price").asDouble());
        List<String> notes = new ArrayList<>();
        node.path("tastingNotes").forEach(n -> notes.add(n.asText()));
        dto.setTastingNotes(notes);
        return dto;
    }

    public List<CoffeeDto> findAll(String roastLevel, String origin, String search) {
        return coffeeIndex.values().stream()
                .filter(c -> roastLevel == null || roastLevel.isBlank()
                        || (c.getRoastLevel() != null && c.getRoastLevel().equalsIgnoreCase(roastLevel)))
                .filter(c -> origin == null || origin.isBlank()
                        || (c.getOrigin() != null && c.getOrigin().toLowerCase().contains(origin.toLowerCase())))
                .filter(c -> search == null || search.isBlank()
                        || c.getName().toLowerCase().contains(search.toLowerCase())
                        || (c.getRoaster() != null && c.getRoaster().toLowerCase().contains(search.toLowerCase()))
                        || (c.getTastingNotes() != null && c.getTastingNotes().stream()
                            .anyMatch(t -> t.toLowerCase().contains(search.toLowerCase()))))
                .collect(Collectors.toList());
    }

    public Optional<CoffeeDto> findById(String id) {
        return Optional.ofNullable(coffeeIndex.get(id));
    }

    public Collection<CoffeeDto> getAllRaw() {
        return coffeeIndex.values();
    }
}
