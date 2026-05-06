package com.coffeecompass.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FavoriteRequest {

    @NotBlank
    @Size(max = 32)
    private String coffeeId;

    @NotBlank
    @Size(max = 200)
    private String coffeeName;

    @Size(max = 100)
    private String roaster;

    @Size(max = 20)
    private String roastLevel;

    @Size(max = 500)
    private String notes;

    @Min(0)
    @Max(5)
    private Integer rating = 0;

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
}
