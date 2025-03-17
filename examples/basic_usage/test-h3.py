# %% Import Libraries
import h3
import geopandas as gpd
from shapely.geometry import mapping, Polygon
import geojson
import json
import os

# %% Load BC GeoJSON
file_path = r"W:\gss\sandbox\emillan\github_clones\disturbance-hex\data\coast.json"
gdf = gpd.read_file(file_path)
gdf = gdf.to_crs(epsg=4326)  # Ensure WGS84

shape = gdf.geometry.unary_union  # Merge all geometries into one

# %% Convert to LatLngPoly
def to_latlngpoly(geom):
    if geom.geom_type == "Polygon":
        exterior = [(lat, lon) for lon, lat in geom.exterior.coords]
        holes = [[(lat, lon) for lon, lat in ring.coords] for ring in geom.interiors]
        return h3.LatLngPoly(exterior, holes)
    elif geom.geom_type == "MultiPolygon":
        return [
            to_latlngpoly(part)
            for part in geom.geoms
        ]
    else:
        raise ValueError(f"Unsupported geometry type: {geom.geom_type}")

latlng_polys = to_latlngpoly(shape)

# %% Polyfill H3 Grid
resolution = 4
if isinstance(latlng_polys, list):
    h3_cells = set()
    for poly in latlng_polys:
        h3_cells.update(h3.polygon_to_cells(poly, resolution))
else:
    h3_cells = h3.polygon_to_cells(latlng_polys, resolution)

print(f"✅ Generated {len(h3_cells)} H3 cells at resolution {resolution}")

# %% Convert to GeoJSON features
individual_hex = h3_cells[0]
# %%
print(dir(individual_hex.__class__))
# %%
print(help(h3.cell_to_boundary))
# %%
boundary = h3.cell_to_boundary(individual_hex)
# %%
print(boundary)
# %%
