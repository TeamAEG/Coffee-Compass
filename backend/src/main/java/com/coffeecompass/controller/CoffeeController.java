package com.coffeecompass.controller;

import com.coffeecompass.dto.CoffeeDto;
import com.coffeecompass.service.BrewService;
import com.coffeecompass.service.CoffeeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coffees")
public class CoffeeController {

    private final CoffeeService coffeeService;
    private final BrewService brewService;

    public CoffeeController(CoffeeService coffeeService, BrewService brewService) {
        this.coffeeService = coffeeService;
        this.brewService = brewService;
    }

    @GetMapping
    public ResponseEntity<List<CoffeeDto>> list(
            @RequestParam(required = false) String roastLevel,
            @RequestParam(required = false) String origin,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(coffeeService.findAll(roastLevel, origin, search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CoffeeDto> detail(@PathVariable String id) {
        return ResponseEntity.ok(coffeeService.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coffee not found")));
    }

    @GetMapping("/{id}/brew")
    public ResponseEntity<Map<String, Object>> brew(@PathVariable String id) {
        CoffeeDto coffee = coffeeService.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coffee not found"));
        return ResponseEntity.ok(brewService.recommendFor(coffee));
    }
}
