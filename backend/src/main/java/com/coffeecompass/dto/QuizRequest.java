package com.coffeecompass.dto;

import java.util.List;

public class QuizRequest {
    private String roastPreference;
    private String flavorPreference;
    private String brewMethod;
    private String strength;
    private List<String> avoidNotes;

    public String getRoastPreference() { return roastPreference; }
    public void setRoastPreference(String roastPreference) { this.roastPreference = roastPreference; }

    public String getFlavorPreference() { return flavorPreference; }
    public void setFlavorPreference(String flavorPreference) { this.flavorPreference = flavorPreference; }

    public String getBrewMethod() { return brewMethod; }
    public void setBrewMethod(String brewMethod) { this.brewMethod = brewMethod; }

    public String getStrength() { return strength; }
    public void setStrength(String strength) { this.strength = strength; }

    public List<String> getAvoidNotes() { return avoidNotes; }
    public void setAvoidNotes(List<String> avoidNotes) { this.avoidNotes = avoidNotes; }
}
