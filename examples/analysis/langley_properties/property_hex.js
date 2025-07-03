console.log("Script is Running");

// === Region Injection ===
window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM Loaded");

  const region = new URLSearchParams(window.location.search).get("region");
  console.log("📍 Region param:", region);

  const hashparams = new URLSearchParams(window.location.hash.slice(1));
  const searchParam = hashparams.get('widget_7');
  console.log(hashparams, searchParam);

  const display = document.getElementById("selected-region");
  if (display) {
    display.textContent = `Selected Region: ${region}`;
    console.log("✅ Text injected into selected-region");
  }
});

// === Initialize Map ===
const map = L.map('map').setView([49.2827, -123.1207], 14);
const satelliteLayer = L.tileLayer(
  'http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
  { maxZoom: 18 }
).addTo(map);

// === Globals ===
const test_points = "../../../data/langley_assessments.geojson";
const admin_polys  = "../../../data/NR_AREAS.geojson";

const hexLayerGroup      = L.layerGroup().addTo(map);
const hexLabelGroup      = L.layerGroup().addTo(map);
const adminBoundaryGroup = L.layerGroup().addTo(map);

let geojsonData = null;
let showHexLabels = false;
let geojsonLayer;
let adminGeoJSON = null;
let allFeatures = [];

// === Resolution Descriptions ===
const resolutionDescriptions = {
  /* same as before */
  0:  "Cell size: ~4.35 Million km² (½ Canada)",
  1:  "Cell size: ~610,000 km² (France)",
  /* ... */
  15: "Cell size: ~1 m² (Floor Lamp)"
};

// === Compute Stats ===
function computeStats(h3Values) {
  const values = Object.values(h3Values);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
  return { mean, stdDev };
}

function interpretZScore(z) {
  if (z >= 2)  return "Much higher than average";
  if (z >= 1)  return "Above average";
  if (z >= -1) return "Near average";
  if (z >= -2) return "Below average";
               return "Much lower than average";
}

// === Discrete 7-class Color Scale ===
const colorScale = [
  '#d73027',
  '#fc8d59',
  '#fee08b',
  '#d9ef8b',
  '#91cf60',
  '#1a9850',
  '#006837'
];

function getColorFromZScore(z) {
  // normalize z in [-2, 3] to t in [0,1]
  const clamped = Math.max(-2, Math.min(3, z));
  const t = (clamped + 2) / 5;
  const idx = Math.min(
    colorScale.length - 1,
    Math.floor(t * colorScale.length)
  );
  return colorScale[idx];
}

// === Aggregator: count + land + building sum ===
function aggregateStatsByH3(data, resolution) {
  const h3Stats = {};
  data.features.forEach(f => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return;
    const [lng, lat] = g.coordinates;
    const idx = h3.latLngToCell(lat, lng, resolution);
    if (!h3Stats[idx]) h3Stats[idx] = { count: 0, landSum: 0, buildingSum: 0 };
    h3Stats[idx].count++;
    h3Stats[idx].landSum += parseFloat(f.properties.Total_Gross_Land_Assessment) || 0;
    h3Stats[idx].buildingSum += parseFloat(f.properties.Total_Gross_Building_Assessment) || 0;
  });
  return h3Stats;
}

// === Draw Hexes with combined metric ===
function drawAggregatedH3(stats) {
  hexLayerGroup.clearLayers();
  hexLabelGroup.clearLayers();
  const totals = {};
  Object.entries(stats).forEach(([idx, s]) => {
    totals[idx] = s.landSum + s.buildingSum;
  });
  const { mean, stdDev } = computeStats(totals);
  Object.entries(stats).forEach(([h3Idx, { count, landSum, buildingSum }]) => {
    const total = landSum + buildingSum;
    const z = stdDev ? (total - mean) / stdDev : 0;
    const fillColor = getColorFromZScore(z);
    const boundary = h3.cellToBoundary(h3Idx, true).map(c=>[c[1],c[0]]);
    const center   = h3.cellToLatLng(h3Idx).reverse();
    L.polygon(boundary, { color:'#333', weight:1, fillColor, fillOpacity:0.7 })
      .bindPopup(`
        <div style="font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#234075;">
          <h4 style="margin:0 0 8px 0;font-size:15px;color:#234075;
                     border-bottom:1px solid #e3a82b;padding-bottom:4px;">
            Cell Info</h4>
          <div><strong>H3 Cell:</strong> ${h3Idx}</div>
          <div><strong>Count:</strong> ${count}</div>
          <div><strong>Land:</strong> $${landSum.toLocaleString()}</div>
          <div><strong>Building:</strong> $${buildingSum.toLocaleString()}</div>
          <div><strong>Total:</strong> $${total.toLocaleString()}</div>
          <div><strong>Z:</strong> ${z.toFixed(2)}</div>
          <div><strong>Interpretation:</strong> ${interpretZScore(z)}</div>
        </div>
      `)
      .addTo(hexLayerGroup);
    if (showHexLabels) {
      L.tooltip({ permanent:true, direction:'center', className:'hex-label' })
       .setContent(h3Idx).setLatLng(center).addTo(hexLabelGroup);
    }
  });
}

// === Update & Debounce ===
function updateAggregation(res) {
  console.log('▶ updateAggregation(', res, ')');
  const stats = aggregateStatsByH3(geojsonData, res);
  console.log('   → cells:', Object.keys(stats).length);
  drawAggregatedH3(stats);
  document.getElementById('resolution-value').innerText   = res;
  document.getElementById('resolution-message').innerText =
    resolutionDescriptions[res] || 'Unknown resolution';
}
function debounce(fn, d) { let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),d);} }

// === Fetch & Init ===
fetch(test_points)
  .then(r=>r.ok? r.json(): Promise.reject(r.statusText))
  .then(data=>{
    geojsonData = data;
    console.log('Laoded features:', data.features.length);
    const inp = document.getElementById('resolution');
    let initRes = parseInt(inp.value,10) || 9;
    inp.value = initRes;
    updateAggregation(initRes);
    const deb = debounce(updateAggregation,200);
    inp.addEventListener('input', e=>deb(parseInt(e.target.value,10)));
    document.getElementById('showHexIds')
      .addEventListener('change',()=>{showHexLabels=!showHexLabels;updateAggregation(parseInt(inp.value,10));});
  })
  .catch(e=>console.error('Error loading GeoJSON:', e));

// === Admin & Controls ===
fetch(admin_polys).then(r=>r.json()).then(data=>{
  adminGeoJSON = data; allFeatures = data.features;
  const dd = document.getElementById('regionFilter');
  [...new Set(allFeatures.map(f=>f.properties.REGION_NAME))]
    .sort().forEach(region=>{const o=document.createElement('option');o.value=region;o.textContent=region;dd.appendChild(o)});
  dd.addEventListener('change',()=>{
    if(geojsonLayer)map.removeLayer(geojsonLayer);
    adminBoundaryGroup.clearLayers();
    const sel=dd.value;
    const filt = sel==='All'?allFeatures:allFeatures.filter(f=>f.properties.REGION_NAME===sel);
    geojsonLayer=L.geoJSON(filt).addTo(map);
    if(geojsonLayer.getBounds().isValid()){
      map.fitBounds(geojsonLayer.getBounds());
      const coords=get_latlngs_from_geojsonLayer(geojsonLayer);
      const cr=parseInt(document.getElementById('resolution').value,10);
      const cells=h3.polygonToCells(coords,cr);
      h3.cellsToMultiPolygon(cells,false)
        .forEach(poly=>poly.forEach(ring=>{L.polygon(ring.map(([lat,lng])=>[lat,lng]),{color:'red',weight:2,fillColor:'#f03',fillOpacity:0.1}).addTo(adminBoundaryGroup);}));
    }
  });
});
L.control.layers({"Satellite":satelliteLayer},{"H3 Hexagons":hexLayerGroup,"H3 Labels":hexLabelGroup,"Admin Boundaries":adminBoundaryGroup},{collapsed:false}).addTo(map);
function get_latlngs_from_geojsonLayer(layer){const all=[];layer.eachLayer(l=>{if(l instanceof L.Polygon||l instanceof L.Polyline){const c=l.getLatLngs().flat(Infinity).map(ll=>[ll.lat,ll.lng]);all.push(c)}});return all;}
function getUrlParam(n){return new URLSearchParams(window.location.search).get(n);}
