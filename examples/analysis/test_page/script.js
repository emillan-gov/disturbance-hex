// Create a Leaflet map
var map = L.map('map').setView([49.2827, -123.1207], 14);
// Add a base map
L.tileLayer('http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', { maxZoom: 18}).addTo(map);
const h3Resolution = 9;
// var test_points = "sample_points.geoJSON"
const hexLayerGroup = L.layerGroup().addTo(map);
var test_points = "caribou.geoJSON"

// Downtown Vancouver as a cell
// const VAN = h3.latLngToCell(49.2827, -123.1207, h3Resolution)
// console.log(VAN);
// L.polygon(h3.cellToBoundary(VAN)).addTo(map).setStyle({color: 'red'});

// Create a hexagon grid around downtown Vancouver
// const disks = h3.gridDisk(VAN, 3);
// disks.map(d => { 
//   // console.log(d) 
//   // h3.cellToBoundary(d)    
//   var p0 = L.polygon(h3.cellToBoundary(d)).addTo(map).setStyle({color: 'red'});
// })

const canvasRenderer = L.canvas({ padding: 0.5 });

function getColor(count) {
  return count >= 10 ? '#800026' :
         count >= 5 ? '#FD8D3C' :
         count >= 1 ? '#FED976' :
                      '#FFFFFF';
}

function aggregatePointsByH3(geojsonData, resolution) {
  const h3Counts = {};

  geojsonData.features.forEach(feature => {
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      const h3Index = h3.latLngToCell(lat, lng, resolution);
      h3Counts[h3Index] = (h3Counts[h3Index] || 0) + 1;
    }
  });

  console.log(h3Counts);
  return h3Counts;
}

function drawAggregatedH3(h3Counts) {
  hexLayerGroup.clearLayers();

  Object.entries(h3Counts).forEach(([h3Index, count]) => {
    const boundary = h3.cellToBoundary(h3Index, true).map(coord => [coord[1], coord[0]]);
    const polygon = L.polygon(boundary, {
      color: '#333',
      weight: 1,
      fillColor: getColor(count),
      fillOpacity: 0.6
    }).bindPopup(`Count: ${count}`);

    hexLayerGroup.addLayer(polygon);
  });
}


// Generate Lat Longs from Geojson   
function loglatlngsAndDrawH3Cells(geojsonData) {
  // Create empty Variable to store the cells
  const point_cells = [];

  // Loop through the features in the GeoJSON
  geojsonData.features.forEach((feature, index) => {
    // Check if the feature is a point  
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      console.log(`Feature ${index + 1}: lat = ${lat}, lng = ${lng}`);

      const cell = h3.latLngToCell(lat, lng, h3Resolution);
      point_cells.push(cell);

      const boundary = h3.cellToBoundary(cell, true).map(coord => [coord[1], coord[0]]);
      L.polygon(boundary, {
        color: '#007cbf',
        weight: 1,
        fillOpacity: 0.3
      }).addTo(map);


    } else {
      console.error(`Feature ${index + 1} is not a point`);
    }
  });
  return point_cells;
}



// Load GeoJSON data and call the function
fetch(test_points)
  .then(response => response.json())
  .then(geojsonData => {
    // loglatlngsAndDrawH3Cells(geojsonData);
    const h3Counts = aggregatePointsByH3(geojsonData, h3Resolution)
    drawAggregatedH3(h3Counts)
  })
  .catch(error => {
    console.error('Error loading GeoJSON data:', error);
  });