package com.coffeecompass.service;

import com.coffeecompass.dto.CoffeeDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
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
    private final String loffeeBaseUrl;
    private final String loffeeApiKey;

    private final Map<String, CoffeeDto> coffeeIndex = new LinkedHashMap<>();

    public CoffeeService(RestTemplate restTemplate,
                         ObjectMapper objectMapper,
                         @Value("${app.external.loffee-base-url}") String loffeeBaseUrl,
                         @Value("${app.external.loffee-api-key}") String loffeeApiKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.loffeeBaseUrl = loffeeBaseUrl;
        this.loffeeApiKey = loffeeApiKey;
    }

    @PostConstruct
    public void init() {
        if (!tryLoadExternalData()) {
            log.warn("Falling back to seed data");
            loadSeedData();
        }
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

    private boolean tryLoadExternalData() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", loffeeApiKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            int added = 0;
            added += fetchBeans(loffeeBaseUrl + "/beans?limit=200", entity);
            added += fetchBeans(loffeeBaseUrl + "/beans?limit=200&origin=Austria", entity);

            log.info("Loaded {} coffees from Loffee Labs", added);
            return added > 0;
        } catch (Exception e) {
            log.warn("Loffee Labs API unavailable: {}", e.getMessage());
            return false;
        }
    }

    private int fetchBeans(String url, HttpEntity<Void> entity) throws Exception {
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
        String body = response.getBody();
        if (body == null) return 0;

        JsonNode root = objectMapper.readTree(body);
        JsonNode list = root.isArray() ? root : root.path("data");
        if (list.isMissingNode()) list = root.path("beans");

        int added = 0;
        for (JsonNode node : list) {
            CoffeeDto dto = mapLoffee(node);
            if (dto != null && !coffeeIndex.containsKey(dto.getId())) {
                coffeeIndex.put(dto.getId(), dto);
                added++;
            }
        }
        return added;
    }

    private CoffeeDto mapLoffee(JsonNode node) {
        String id = node.path("id").asText(null);
        String name = node.path("roast-name").asText(null);
        if (id == null || name == null || name.isBlank()) return null;

        CoffeeDto dto = new CoffeeDto();
        dto.setId("loffee-" + id);
        dto.setName(name);

        JsonNode roasterNode = node.path("roaster");
        if (roasterNode.isObject()) {
            dto.setRoaster(roasterNode.path("name").asText(null));
        } else {
            dto.setRoaster(roasterNode.asText(null));
        }

        String origin = node.path("origin").asText(null);
        String region = node.path("region").asText(null);
        if (origin != null && region != null && !region.isBlank() && !region.equalsIgnoreCase(origin)) {
            dto.setOrigin(region + ", " + origin);
        } else {
            dto.setOrigin(origin);
        }

        dto.setType(node.path("variety").asText(null));
        dto.setProcess(node.path("process").asText(null));
        dto.setDescription(node.path("description").asText(null));

        String degree = node.path("degree").asText(null);
        if (degree != null) {
            String lower = degree.toLowerCase();
            if (lower.contains("light"))       dto.setRoastLevel("light");
            else if (lower.contains("dark"))   dto.setRoastLevel("dark");
            else if (lower.contains("medium") || lower.contains("med")) dto.setRoastLevel("medium");
            else                               dto.setRoastLevel(degree);
        }

        if (node.has("price-low") && !node.path("price-low").isNull()) {
            dto.setPrice(node.path("price-low").asDouble());
        }

        List<String> notes = new ArrayList<>();
        JsonNode tastingTag = node.path("tasting-tag");
        if (tastingTag.isArray()) {
            tastingTag.forEach(n -> notes.add(n.asText()));
        } else {
            String tasting = node.path("tasting").asText(null);
            if (tasting != null && !tasting.isBlank()) {
                Arrays.stream(tasting.split(","))
                      .map(String::trim)
                      .filter(s -> !s.isEmpty())
                      .forEach(notes::add);
            }
        }
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
