package com.coffeecompass.repository;

import com.coffeecompass.model.CoffeeCacheEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;

public interface CoffeeCacheRepository extends JpaRepository<CoffeeCacheEntity, String> {
    boolean existsByFetchedAtAfter(Instant cutoff);
}
