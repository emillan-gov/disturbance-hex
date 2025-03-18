## Overview
[H3](https://h3geo.org/) is an open-source, hexagon-based hierarchical spatial 
index developed by Uber. It provides a powerful way to divide the world into 
grids for spatial analysis, aggregation, and visualization.

H3 is especially useful in geospatial workflows for:
- Spatial binning and heatmaps
- Point clustering
- Spatial joins and indexing
- Resolution-independent analysis
- Overlaying administrative or natural boundaries with consistent hexagons

---

## 🔹 Key Features

- **Hexagonal cells**: Better spatial adjacency and equal area than squares.
- **Hierarchical**: 16 levels of resolution (`0` = coarse, `15` = fine).
- **Geospatial operations**: K-rings, polygon filling, neighbor lookup, etc.
- **GeoJSON-friendly**: Easy to integrate with GIS tools.

---
## Architecture 
Github Pages only allows client side, static content so currently there is no 
opportunity to create more complex applications. As a result, this repo contains
a simplified data repository with publicly available data and basic html, css
and javascript content. 

H3 was created in C but has bindings in many languages including python, so it
might be appropriate to use in flask applications in the government openshift 
env.
--