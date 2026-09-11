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
    // zoomControl: true — dá botões +/- no mapa. O pinch-to-zoom (dedos) já
    // funcionava antes através do próprio Leaflet, independentemente disto.
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([38.7223, -9.1393], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var routeLine = L.polyline([], { color: '${color}', weight: 4 }).addTo(map);
    var marker = null;
    var hasCentered = false;
    // Última posição conhecida do utilizador — guardada para o botão de
    // recentrar (recenterMap) poder repor a vista sobre o ponto atual a
    // qualquer momento, mesmo que já se tenham passado várias atualizações
    // de GPS desde a última vez que o mapa foi centrado.
    var lastCoords = null;

    function updateRoute(coords, current) {
      routeLine.setLatLngs(coords.map(function (c) { return [c.lat, c.lng]; }));

      if (current) {
        lastCoords = current;
        if (!marker) {
          marker = L.circleMarker([current.lat, current.lng], {
            radius: 8, color: '#ffffff', weight: 2, fillColor: '${color}', fillOpacity: 1
          }).addTo(map);
          // Primeira posição: centra com um zoom inicial fixo (17).
          map.setView([current.lat, current.lng], 17);
          hasCentered = true;
        } else {
          marker.setLatLng([current.lat, current.lng]);
          // A partir daqui, o mapa volta a seguir o utilizador
          // automaticamente a cada posição nova — MAS usando sempre
          // map.getZoom() (o zoom ATUAL, escolhido pelo próprio utilizador
          // via pinch ou pelos botões +/-), nunca um valor fixo. Por isso
          // o zoom nunca é reposto sozinho a 17 — só a posição é que segue
          // o utilizador, o zoom fica sempre como ele o deixou.
          map.setView([current.lat, current.lng], map.getZoom());
        }
      }
    }

    // Botão de recentrar (📍) em ActiveExerciseScreen: com o seguimento
    // automático acima, só é mesmo necessário se o utilizador tiver
    // arrastado o mapa manualmente (pan) e quiser voltar a ver o seu ponto
    // no centro sem esperar pela próxima posição GPS. Também não altera o
    // zoom atual.
    function recenterMap() {
      if (lastCoords) {
        map.setView([lastCoords.lat, lastCoords.lng], map.getZoom());
      }
    }

    function clearRoute() {
      routeLine.setLatLngs([]);
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      hasCentered = false;
      lastCoords = null;
    }
    true;
  </script>
</body>
</html>
`;
};
