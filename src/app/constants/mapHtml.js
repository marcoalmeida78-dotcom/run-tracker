// --- HTML DO MAPA (Leaflet + tiles OpenStreetMap Standard) ---
// A cor do traço/bola é sempre verde-lima (ver constants/mapColors.js),
// independentemente do esquema de cores da app.
export const getLeafletMapHtml = (routeColor) => {
  const color = routeColor || '#9ACD32';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background-color: #f0f0f0; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([38.7223, -9.1393], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var routeLine = L.polyline([], { color: '${color}', weight: 4 }).addTo(map);
    var marker = null;
    var hasCentered = false;

    function updateRoute(coords, current) {
      routeLine.setLatLngs(coords.map(function (c) { return [c.lat, c.lng]; }));

      if (current) {
        if (!marker) {
          marker = L.circleMarker([current.lat, current.lng], {
            radius: 8, color: '#ffffff', weight: 2, fillColor: '${color}', fillOpacity: 1
          }).addTo(map);
        } else {
          marker.setLatLng([current.lat, current.lng]);
        }
        map.setView([current.lat, current.lng], hasCentered ? map.getZoom() : 17);
        hasCentered = true;
      }
    }

    function clearRoute() {
      routeLine.setLatLngs([]);
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      hasCentered = false;
    }
    true;
  </script>
</body>
</html>
`;
};
