# Building GeoJSON Data Files

This directory should contain 15 GeoJSON files for the local building geometry:

## Required Files:

### Amsterdam (3 zones)
- `ams_centrum_buildings.json`
- `ams_zuidas_buildings.json`
- `ams_depijp_buildings.json`

### Rotterdam (3 zones)
- `rot_centrum_buildings.json`
- `rot_blaak_buildings.json`
- `rot_zuidplein_buildings.json`

### Den Haag (3 zones)
- `dhg_centrum_buildings.json`
- `dhg_statenkwartier_buildings.json`
- `dhg_binckhorst_buildings.json`

### Utrecht (3 zones)
- `utr_centrum_buildings.json`
- `utr_sciencepark_buildings.json`
- `utr_leidscherijn_buildings.json`

### Eindhoven (3 zones)
- `ein_centrum_buildings.json`
- `ein_strijps_buildings.json`
- `ein_hightech_buildings.json`

## GeoJSON Format

Each file should be a GeoJSON FeatureCollection with building polygons from the Dutch PDOK WFS API.

Required properties for each feature:
- `h_dak_max` - Maximum roof height in meters
- `h_maaiveld` - Ground level height in meters

The building height will be calculated as: `h_dak_max - h_maaiveld`

## Data Source

These files should be sourced from the Dutch PDOK (Publieke Dienstverlening Op de Kaart) WFS API:
https://www.pdok.nl/

## Note

Until these files are created, the application will fall back to the Overpass API for building geometry.
