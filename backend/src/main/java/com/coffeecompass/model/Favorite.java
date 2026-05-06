package com.coffeecompass.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "favorites", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "coffee_id"})
})
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "coffee_id", nullable = false, length = 32)
    private String coffeeId;

    @Column(nullable = false, length = 200)
    private String coffeeName;

    @Column(length = 100)
    private String roaster;

    @Column(length = 20)
    private String roastLevel;

    @Column(length = 500)
    private String notes;

    @Column(nullable = false)
    private Integer rating = 0;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Favorite() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getCoffeeId() { return coffeeId; }
    public void setCoffeeId(String coffeeId) { this.coffeeId = coffeeId; }

    public String getCoffeeName() { return coffeeName; }
    public void setCoffeeName(String coffeeName) { this.coffeeName = coffeeName; }

    public String getRoaster() { return roaster; }
    public void setRoaster(String roaster) { this.roaster = roaster; }

    public String getRoastLevel() { return roastLevel; }
    public void setRoastLevel(String roastLevel) { this.roastLevel = roastLevel; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
