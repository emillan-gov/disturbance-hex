// Leaflet map setup
const map = L.map('map').setView([49.2827, -123.1207], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Current state
let currentHexLayerGroup = L.layerGroup().addTo(map);
let geojsonData = null;

// Color scale function for fill
function getColor(count) {
  return count >= 10 ? '#800026' :
         count >= 5  ? '#FD8D3C' :
         count >= 2  ? '#FED976' :
                       '#FFEDA0';
}

// Aggregate points into H3 cells at a given resolution
function aggregatePointsByH3(geojsonData, resolution) {
  const h3Counts = {};

  geojsonData.features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const h3Index = h3.latLngToCell(lat, lng, resolution);

    if (h3Counts[h3Index]) {
      h3Counts[h3Index]++;
    } else {
      h3Counts[h3Index] = 1;
    }
  });

  return h3Counts;
}

// Draw hexagons from aggregation data
function drawAggregatedH3(h3Counts) {
  currentHexLayerGroup.clearLayers();

  Object.entries(h3Counts).forEach(([h3Index, count]) => {
    const boundary = h3.cellToBoundary(h3Index, true);
    const polygon = L.polygon(boundary, {
      color: '#333',
      weight: 1,
      fillColor: getColor(count),
      fillOpacity: 0.6
    }).bindPopup(`Count: ${count}`);

    currentHexLayerGroup.addLayer(polygon);
  });
}

// On zoom, update hex resolution and redraw
function updateAggregationOnZoom() {
  const zoom = map.getZoom();
  const resolution = Math.max(5, Math.min(10, Math.floor(zoom)));
  const h3Counts = aggregatePointsByH3(geojsonData, resolution);
  drawAggregatedH3(h3Counts);
}

// Load GeoJSON and trigger initial draw
fetch('sample_points.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData = data;
    updateAggregationOnZoom();  // Initial draw

    map.on('zoomend', updateAggregationOnZoom);  // Update on zoom
  })
  .catch(err => console.error('Error loading GeoJSON:', err));
