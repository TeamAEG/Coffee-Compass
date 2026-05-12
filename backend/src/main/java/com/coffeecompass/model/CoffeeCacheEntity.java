package com.coffeecompass.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "coffee_cache")
public class CoffeeCacheEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String roaster;
    private String origin;
    private String type;
    private String process;
    private String roastLevel;

    @Column(columnDefinition = "TEXT")
    private String tastingNotes;

    private Double price;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Instant fetchedAt;

    public CoffeeCacheEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRoaster() { return roaster; }
    public void setRoaster(String roaster) { this.roaster = roaster; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getProcess() { return process; }
    public void setProcess(String process) { this.process = process; }

    public String getRoastLevel() { return roastLevel; }
    public void setRoastLevel(String roastLevel) { this.roastLevel = roastLevel; }

    public String getTastingNotes() { return tastingNotes; }
    public void setTastingNotes(String tastingNotes) { this.tastingNotes = tastingNotes; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getFetchedAt() { return fetchedAt; }
    public void setFetchedAt(Instant fetchedAt) { this.fetchedAt = fetchedAt; }
}
