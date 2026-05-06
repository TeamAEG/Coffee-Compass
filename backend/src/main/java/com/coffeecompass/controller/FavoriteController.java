package com.coffeecompass.controller;

import com.coffeecompass.dto.FavoriteRequest;
import com.coffeecompass.model.Favorite;
import com.coffeecompass.repository.FavoriteRepository;
import com.coffeecompass.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteRepository repository;

    public FavoriteController(FavoriteRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<Favorite>> list(@AuthenticationPrincipal AuthenticatedUser user) {
        requireAuth(user);
        return ResponseEntity.ok(repository.findByUserIdOrderByCreatedAtDesc(user.getUserId()));
    }

    @PostMapping
    public ResponseEntity<Favorite> create(@AuthenticationPrincipal AuthenticatedUser user,
                                           @Valid @RequestBody FavoriteRequest req) {
        requireAuth(user);
        if (repository.existsByUserIdAndCoffeeId(user.getUserId(), req.getCoffeeId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Favorite already exists");
        }
        Favorite fav = new Favorite();
        fav.setUserId(user.getUserId());
        fav.setCoffeeId(req.getCoffeeId());
        fav.setCoffeeName(req.getCoffeeName());
        fav.setRoaster(req.getRoaster());
        fav.setRoastLevel(req.getRoastLevel());
        fav.setNotes(req.getNotes());
        fav.setRating(req.getRating() == null ? 0 : req.getRating());
        return ResponseEntity.status(HttpStatus.CREATED).body(repository.save(fav));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Favorite> update(@AuthenticationPrincipal AuthenticatedUser user,
                                           @PathVariable Long id,
                                           @Valid @RequestBody FavoriteRequest req) {
        requireAuth(user);
        Favorite fav = repository.findByIdAndUserId(id, user.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Favorite not found"));
        fav.setCoffeeName(req.getCoffeeName());
        fav.setRoaster(req.getRoaster());
        fav.setRoastLevel(req.getRoastLevel());
        fav.setNotes(req.getNotes());
        fav.setRating(req.getRating() == null ? 0 : req.getRating());
        return ResponseEntity.ok(repository.save(fav));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Favorite> patch(@AuthenticationPrincipal AuthenticatedUser user,
                                          @PathVariable Long id,
                                          @RequestBody Map<String, Object> updates) {
        requireAuth(user);
        Favorite fav = repository.findByIdAndUserId(id, user.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Favorite not found"));

        if (updates.containsKey("notes")) fav.setNotes((String) updates.get("notes"));
        if (updates.containsKey("rating")) {
            Object r = updates.get("rating");
            if (r instanceof Number n) fav.setRating(n.intValue());
        }
        if (updates.containsKey("roastLevel")) fav.setRoastLevel((String) updates.get("roastLevel"));
        return ResponseEntity.ok(repository.save(fav));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user,
                                       @PathVariable Long id) {
        requireAuth(user);
        Favorite fav = repository.findByIdAndUserId(id, user.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Favorite not found"));
        repository.delete(fav);
        return ResponseEntity.noContent().build();
    }

    private void requireAuth(AuthenticatedUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
    }
}
