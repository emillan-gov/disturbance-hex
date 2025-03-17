# %%
import geopandas as gpd
import numpy as np
import h3

coast_area = gpd.read_file(r"W:\gss\sandbox\emillan\github_clones\disturbance-hex\data\coast.json")
coast_area.describe()
# %%

numeric_columns = ()
h3_res = 5

def geo_to_h3(row):
    return h3.geo_to_h3(row.geometry.y, row.geometry.x, h3_res)

