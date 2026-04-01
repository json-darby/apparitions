---
name: apparitions-engine
description: "Core architectural philosophy, visual constraints (Brutalist Noir), language logic, and data pipeline for the Apparitions Digital Archaeology & Geospatial Engine."
---

# Apparitions: Digital Archaeology & Geospatial Engine
## System Knowledge & Agent Behaviours

### 1. Architectural Philosophy & Datasets
* **The Framework**: The application relies strictly on `deck.gl` as a standalone WebGL2 rendering engine.
* **Zero-Dependency Basemaps**: Do not invoke commercial basemap providers. The background must remain a pitch-black void.
* **The Geometry Engine**: Use the open-source TU Delft 3D BAG OGC 3D Tileset for all building geometry. Do not use the Overpass API for buildings.
* **Live Transit**: Query the open Dutch public transport feed (v0.ovapi.nl) to fetch real-time coordinate paths.
* **Atmospheric Sync**: Query the free open-meteo.com API to map live weather conditions to custom post-processing shaders.

### 2. Visual & Aesthetic Constraints (Brutalist Noir)
* **Semantic Surface Styling**: Intercept the 3D BAG semantic tags. Paint all `WallSurface` geometry a flat, deep charcoal grey (`#1A1A1A`). Paint all `RoofSurface` geometry a matte ash grey (`#2A2A2A`) to define architectural volume.
* **Target Highlighting**: When a target destination is selected or queried via the vocabulary list, override the semantic greys and flood the specific 3D volume with a highly saturated, emissive red (`#FF0000`).
* **Ghostlike Particles**: Render the real-time OVAPI transit data using a `deck.gl` `TripsLayer`. The particles must be clinical white, featuring a high opacity head and a fading, transparent trail to create a spectral effect across the dark road network.
* **Typography**: All user interface elements, menus, and tooltips must use a stark, white monospace font.

### 3. Language Acquisition Logic
* **Bilingual State Management**: The application must support seamless toggling between Dutch and English via a physical-style UI switch. State changes must update the DOM instantly without re-rendering the heavy 3D geometry.
* **Contextual Interception**: Hovering over interactive elements (red-highlighted buildings or ghostlike transit trails) must display a brutalist tooltip containing the relevant vocabulary.
* **Audio Integration**: Clicking a valid vocabulary target must trigger the Web Speech API to pronounce the Dutch word, applying a muffled, low-pass radio filter to simulate intercepting a transmission.

### 4. Data Pipeline & Vocabulary Ingestion
* **Dynamic Fetching**: Do not hardcode the vocabulary. The application must asynchronously `fetch()` the local `the_list.json` file at runtime.
* **Auto-Updating**: This architecture ensures any modifications made to the JSON file are immediately reflected in the interactive tooltips upon the next spatial query or page reload.

### 5. Performance & Offline Resilience
* **Tile Streaming**: Rely on deck.gl's native `Tile3DLayer` culling to ensure only visible 3D BAG tiles are loaded into memory, maintaining high framerates.
* **Shader Efficiency**: Keep weather effects (e.g. digital rain particles, global fog density) handled entirely by the GPU via `luma.gl` custom fragment shaders.

### 6. Linguistic Standards
* **Language Requirement**: The agent must use strict British English spelling and grammar across all code comments, textual content, and documentation output (for example, 'colour', 'behaviour', 'initialise').
