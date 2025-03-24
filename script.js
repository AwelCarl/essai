var map = L.map('map').setView([46.2276, 2.2137], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

var pointsLayer = L.layerGroup().addTo(map);
var regionsLayer;
var dates = [];
var currentDateIndex = 0;
var playInterval;
var speed = 1000;
var minPower = 0;
var maxPower = 450;
var showAllPrevious = false;
var showPoints = true;
var colorScale = chroma.scale(['blue', 'yellow', 'red']).domain([0, 450]);

var legend = L.control({position: 'topright'});
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = '<h4>Puissance (kW)</h4><div id="legend-content"></div>';
    return div;
};
legend.addTo(map);

function updateLegend() {
    const legendContent = document.getElementById('legend-content');
    legendContent.innerHTML = '';

    const steps = 5;
    const powerRange = maxPower - minPower;
    const stepSize = powerRange / steps;

    const legendContainer = document.createElement('div');
    legendContainer.style.display = 'flex';
    legendContainer.style.alignItems = 'center';

    for (let i = 0; i <= steps; i++) {
        const power = minPower + i * stepSize;
        const color = colorScale(power).hex();
        
        const colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = color;
        colorBox.style.display = 'inline-block';
        
        legendContainer.appendChild(colorBox);
    }

    const labels = document.createElement('div');
    labels.style.display = 'flex';
    labels.style.justifyContent = 'space-between';
    labels.style.width = '100%';
    labels.innerHTML = `<span>${minPower}</span><span>${maxPower}</span>`;

    legendContent.appendChild(legendContainer);
    legendContent.appendChild(labels);
}

fetch('bornes_recharge_mensuel.json')
    .then(response => response.json())
    .then(data => {
        dates = Object.keys(data).sort().filter(date => date >= "2014-01");
        
        var timeline = L.control({position: 'bottomleft'});
        timeline.onAdd = function(map) {
            var div = L.DomUtil.create('div', 'timeline-control');
            var input = L.DomUtil.create('input', 'timeline-input', div);
            input.type = 'range';
            input.min = 0;
            input.max = dates.length - 1;
            input.value = 0;
            
            input.addEventListener('input', function() {
                currentDateIndex = parseInt(this.value);
                updateMap(true);
            });
            
            return div;
        };
        timeline.addTo(map);

        fetch('regions-france.geojson')
            .then(response => response.json())
            .then(regionsData => {
                regionsLayer = L.geoJSON(regionsData, {
                    style: function(feature) {
                        return {
                            fillColor: '#FFF',
                            weight: 2,
                            opacity: 1,
                            color: 'white',
                            fillOpacity: 0.7
                        };
                    },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup('');
                    }
                }).addTo(map);
            });

        function updateMap(skipInterval) {
            if (currentDateIndex >= dates.length) {
                clearInterval(playInterval);
                return;
            }

            var currentDate = dates[currentDateIndex];
            document.getElementById('current-date').textContent = currentDate;

            document.querySelector('.timeline-input').value = currentDateIndex;

            pointsLayer.clearLayers();

            var regionData = {};

            var startIndex = showAllPrevious ? 0 : currentDateIndex;
            for (var i = startIndex; i <= currentDateIndex; i++) {
                var date = dates[i];
                data[date].forEach(point => {
                    if (point.puissance_nominale >= minPower && point.puissance_nominale <= maxPower) {
                        if (showPoints) {
                            L.circleMarker([point.latitude, point.longitude], {
                                radius: 5,
                                fillColor: colorScale(point.puissance_nominale).hex(),
                                color: "#000",
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.8
                            }).bindPopup(`
                                <b>Code INSEE:</b> ${point.code_insee}<br>
                                <b>Nombre de PDC:</b> ${point.nbre_pdc}<br>
                                <b>Puissance nominale:</b> ${point.puissance_nominale} kW
                            `).addTo(pointsLayer);
                        }

                        if (!regionData[point.code_insee]) {
                            regionData[point.code_insee] = {count: 0, totalPower: 0};
                        }
                        regionData[point.code_insee].count++;
                        regionData[point.code_insee].totalPower += point.puissance_nominale;
                    }
                });
            }

            if (regionsLayer) {
                regionsLayer.eachLayer(function(layer) {
                    var regionCode = layer.feature.properties.code;
                    var regionStats = regionData[regionCode] || {count: 0, totalPower: 0};
                    var averagePower = regionStats.count > 0 ? regionStats.totalPower / regionStats.count : 0;
                    
                    layer.setStyle({
                        fillColor: colorScale(averagePower).hex()
                    });
                    layer.bindPopup(`
                        <b>Région:</b> ${layer.feature.properties.nom}<br>
                        <b>Nombre de bornes:</b> ${regionStats.count}<br>
                        <b>Puissance moyenne:</b> ${averagePower.toFixed(2)} kW
                    `);
                });
            }

            updateLegend();

            if (!skipInterval) {
                currentDateIndex++;
            }
        }

        document.getElementById('play').addEventListener('click', () => {
            clearInterval(playInterval);
            playInterval = setInterval(() => updateMap(false), speed);
        });

        document.getElementById('pause').addEventListener('click', () => {
            clearInterval(playInterval);
        });

        document.getElementById('speed').addEventListener('input', function() {
            speed = 2100 - this.value;
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = setInterval(() => updateMap(false), speed);
            }
        });

        document.getElementById('min-power').addEventListener('input', function() {
            minPower = parseInt(this.value);
            document.getElementById('min-power-value').textContent = minPower;
            updateMap(true);
        });

        document.getElementById('max-power').addEventListener('input', function() {
            maxPower = parseInt(this.value);
            document.getElementById('max-power-value').textContent = maxPower;
            updateMap(true);
        });

        document.getElementById('show-all-previous').addEventListener('change', function() {
            showAllPrevious = this.checked;
            updateMap(true);
        });

        document.getElementById('toggle-points').addEventListener('change', function() {
            showPoints = this.checked;
            if (showPoints) {
                map.addLayer(pointsLayer);
            } else {
                map.removeLayer(pointsLayer);
            }
            updateMap(true);
        });

        updateMap(true);
    });
