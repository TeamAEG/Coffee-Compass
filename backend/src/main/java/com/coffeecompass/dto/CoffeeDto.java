package com.coffeecompass.dto;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;

import java.util.List;

@JacksonXmlRootElement(localName = "coffee")
public class CoffeeDto {
    private String id;
    private String name;
    private String roaster;
    private String origin;
    private String type;
    private String process;
    private String roastLevel;
    private List<String> tastingNotes;
    private Double price;
    private String description;

    public CoffeeDto() {}

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

    public List<String> getTastingNotes() { return tastingNotes; }
    public void setTastingNotes(List<String> tastingNotes) { this.tastingNotes = tastingNotes; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
