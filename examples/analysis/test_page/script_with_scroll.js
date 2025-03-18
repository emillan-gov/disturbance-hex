// === Initialize Map ===
const map = L.map('map').setView([49.2827, -123.1207], 14);
L.tileLayer('http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', {
  maxZoom: 18
}).addTo(map);

// === Globals ===
// const test_points = "caribou.geojson";
const test_points = "../../../data/GSR_SKI_RESORTS_SV.geojson";
// const test_points = "../../../data/GSR_GOLF_RESORTS_SV.geojson";
// const test_points = "../../../data/BTM_Land_Use_Recreation_Areas.geojson";
const admin_polys = "../../../data/NR_AREAS.geojson";
const hexLayerGroup = L.layerGroup().addTo(map);
const hexLabelGroup = L.layerGroup().addTo(map);
const adminBoundaryGroup = L.layerGroup().addTo(map);

let geojsonData = null;
let showHexLabels = false;
let geojsonLayer;
let adminGeoJSON = null;
let allFeatures = [];

const resolutionDescriptions = {
  0: "Cell size: ~4.35 Million km² (1/2 the Size of Canada)",
  1: "Cell size: ~610,000 km² (Size of France)",
  2: "Cell size: ~87,000 km² (Size of Austria)",
  3: "Cell size: ~12,000 km² (3 Luxembourgs)",
  4: "Cell size: ~1,770 km² (1/3 of Prince Edward Island)",
  5: "Cell size: ~250 km² (1/2 of Pacific Rim National Park)",
  6: "Cell size: ~3,600 Hectares (2.5 University Endowment Lands)",
  7: "Cell size: ~500 Hectares (Stanley Park)",
  8: "Cell size: ~73 Hectares (P&E Fairgrounds)",
  9: "Cell size: ~10.5 Hectares (14 Full Soccer Fields)",
  10: "Cell size: ~1.5 Hectares (2 CAF Football Fields)",
  11: "Cell size: ~0.2 Hectares (Standard Suburban Home Lot)",
  12: "Cell size: ~300 m² (Single Family Home)",
  13: "Cell size: ~45 m² (Small Bedroom)",
  14: "Cell size: ~6 m² (Twin Bed)",
  15: "Cell size: ~1 m² (Floor Lamp)"
};

// === Compute Mean and Standard Deviation ===
function computeStats(h3Counts) {
  const values = Object.values(h3Counts);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  return { mean, stdDev };
}

function interpretZScore(z) {
  if (z >= 2) return "Much higher than average";
  if (z >= 1) return "Above average";
  if (z >= -1) return "Near average";
  if (z >= -2) return "Below average";
  return "Much lower than average";
}

function getColorFromZScore(z, normalized = true) {
  // This function builds RBG Values based on the provided Z score in a Red to
  // yellow Range. 
  const clampedZ = Math.max(-2, Math.min(3, z)); //This limits z score to range, removing outliers

  if (normalized) {
    t = (clampedZ + 2) / 5; // Normalize to [0, 1]
  } else {
    t = z; // Use raw value (assuming it's already in [0, 1] range)
  }
  
  const r = 255;
  const g = Math.round(255 * (1 - t));
  const b = 0;
  return `rgb(${r},${g},${b})`;
}

function aggregatePointsByH3(data, resolution) {
  const h3Counts = {};

  data.features.forEach(feature => {
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      const h3Index = h3.latLngToCell(lat, lng, resolution);
      h3Counts[h3Index] = (h3Counts[h3Index] || 0) + 1;
    }
  });

  return h3Counts;
}

function drawAggregatedH3(h3Counts) {
  hexLayerGroup.clearLayers();
  hexLabelGroup.clearLayers();

  const { mean, stdDev } = computeStats(h3Counts);

  Object.entries(h3Counts).forEach(([h3Index, count]) => {
    const z = stdDev > 0 ? (count - mean) / stdDev : 0;
    const fillColor = getColorFromZScore(z, normalized=true);
    const boundary = h3.cellToBoundary(h3Index, true).map(coord => [coord[1], coord[0]]);
    const center = h3.cellToLatLng(h3Index).reverse();

    const polygon = L.polygon(boundary, {
      color: '#333',
      weight: 1,
      fillColor: fillColor,
      fillOpacity: 0.7
    }).bindPopup(`
      <div style="font-family: 'Helvetica Neue', sans-serif; font-size: 13px; line-height: 1.4; color: #234075;">
        <h4 style="margin: 0 0 8px 0; font-size: 15px; color: #234075; border-bottom: 1px solid #e3a82b; padding-bottom: 4px;">
          Cell Info
        </h4>
        <div><strong>H3 Cell:</strong> ${h3Index}</div>
        <div><strong>Point Count:</strong> ${count}</div>
        <div><strong>Z-Score:</strong> ${z.toFixed(2)}</div>
        <div><strong>Fill Color:</strong> <span style="color:${fillColor}; font-weight:bold;">${fillColor}</span></div>
        <div><strong>Interpretation:</strong> ${interpretZScore(z)}</div>
      </div>
    `);

    hexLayerGroup.addLayer(polygon);

    if (showHexLabels) {
      const label = L.tooltip({
        permanent: true,
        direction: 'center',
        className: 'hex-label'
      }).setContent(h3Index).setLatLng(center);

      hexLabelGroup.addLayer(label);
    }
  });
}

function updateAggregation(resolution) {
  const h3Counts = aggregatePointsByH3(geojsonData, resolution);
  drawAggregatedH3(h3Counts);

  document.getElementById('resolution-value').innerText = resolution;
  document.getElementById('resolution-message').innerText = resolutionDescriptions[resolution] || "Unknown resolution";
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function get_latlngs_from_geojsonLayer(input_layer) {
  const allCoords = [];

  input_layer.eachLayer(layer => {
    if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
      const coords = layer.getLatLngs();
      const flatCoords = coords.flat(Infinity).map(latlng => [latlng.lat, latlng.lng]);
      allCoords.push(flatCoords);
    }
  });
  return allCoords;
}

// === Load GeoJSON test points ===
fetch(test_points)
  .then(response => response.json())
  .then(data => {
    geojsonData = data;

    const resolutionInput = document.getElementById('resolution');
    const resolutionDisplay = document.getElementById('resolution-value');
    const resolutionMessage = document.getElementById('resolution-message');
    const initialResolution = parseInt(resolutionInput.value);

    updateAggregation(initialResolution);

    const debouncedUpdate = debounce(updateAggregation, 200);

    resolutionInput.addEventListener('input', (e) => {
      const newRes = parseInt(e.target.value);
      debouncedUpdate(newRes);
    });

    const labelToggle = document.getElementById('showHexIds');
    if (labelToggle) {
      labelToggle.addEventListener('change', (e) => {
        showHexLabels = e.target.checked;
        const currentRes = parseInt(resolutionInput.value);
        updateAggregation(currentRes);
      });
    }
  })
  .catch(error => {
    console.error('Error loading GeoJSON data:', error);
  });

// === Load Admin Polygons and Setup Region Filter Dropdown ===
fetch(admin_polys)
  .then(response => response.json())
  .then(data => {
    adminGeoJSON = data;
    allFeatures = data.features;

    const dropdown = document.getElementById('regionFilter');
    const regions = Array.from(new Set(allFeatures.map(f => f.properties.REGION_NAME))).sort();

    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      dropdown.appendChild(option);
    });

    dropdown.addEventListener('change', () => {
      const selected = dropdown.value;

      if (geojsonLayer) map.removeLayer(geojsonLayer);
      adminBoundaryGroup.clearLayers();

      const filtered = selected === "All"
        ? allFeatures
        : allFeatures.filter(f => f.properties.REGION_NAME === selected);

      geojsonLayer = L.geoJSON(filtered).addTo(map);

      if (geojsonLayer.getBounds().isValid()) {
        map.fitBounds(geojsonLayer.getBounds());

        const polygonCoords = get_latlngs_from_geojsonLayer(geojsonLayer);
        const currentRes = parseInt(document.getElementById('resolution').value);
        const admin_bound = h3.polygonToCells(polygonCoords, currentRes);

        const multipolygon = h3.cellsToMultiPolygon(admin_bound, false);

        multipolygon.forEach(polygon => {
          polygon.forEach(ring => {
            const latlngs = ring.map(([lat, lng]) => [lat, lng]);
            const boundary = L.polygon(latlngs, {
              color: 'red',
              weight: 2,
              fillColor: '#f03',
              fillOpacity: 0.1
            });
            adminBoundaryGroup.addLayer(boundary);
          });
        });
      }
    });
  });

// === Layer Control (Legend) ===
const baseLayers = {
  "Satellite": satelliteLayer
};

const overlays = {
  "H3 Hexagons": hexLayerGroup,
  "H3 Labels": hexLabelGroup,
  "Admin Boundaries": adminBoundaryGroup
};

L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(map);

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

window.addEventListener("DOMContentLoaded", () => {
  const region = getUrlParam("region");
  console.log(region);
});