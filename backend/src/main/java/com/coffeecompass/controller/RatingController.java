package com.coffeecompass.controller;

import com.coffeecompass.dto.RatingRequest;
import com.coffeecompass.model.Rating;
import com.coffeecompass.repository.RatingRepository;
import com.coffeecompass.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/ratings")
public class RatingController {

    private final RatingRepository repository;

    public RatingController(RatingRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<Rating>> list(@AuthenticationPrincipal AuthenticatedUser user) {
        requireAuth(user);
        return ResponseEntity.ok(repository.findByUserId(user.getUserId()));
    }

    @PostMapping("/{coffeeId}")
    public ResponseEntity<Rating> upsert(@AuthenticationPrincipal AuthenticatedUser user,
                                         @PathVariable String coffeeId,
                                         @Valid @RequestBody RatingRequest req) {
        requireAuth(user);
        Rating rating = repository.findByUserIdAndCoffeeId(user.getUserId(), coffeeId)
                .orElseGet(() -> {
                    Rating r = new Rating();
                    r.setUserId(user.getUserId());
                    r.setCoffeeId(coffeeId);
                    return r;
                });
        rating.setRating(req.getRating());
        return ResponseEntity.ok(repository.save(rating));
    }

    @DeleteMapping("/{coffeeId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user,
                                       @PathVariable String coffeeId) {
        requireAuth(user);
        repository.findByUserIdAndCoffeeId(user.getUserId(), coffeeId)
                .ifPresent(repository::delete);
        return ResponseEntity.noContent().build();
    }

    private void requireAuth(AuthenticatedUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
    }
}
