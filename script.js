class ChargingMap {
    constructor() {
        this.config = {
            MAP_CENTER: [46.2276, 2.2137],
            MAP_ZOOM: 6,
            INITIAL_SPEED: 1000,
            COLOR_SCALE: ['yellow', 'red'],
            TILE_LAYER_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            DATA_FILES: {
                monthly: 'bornes_recharge_mensuel.json',
                quarterly: 'bornes_recharge_trimestriel.json'
            }
        };

        this.domElements = {
            play: document.getElementById('play'),
            pause: document.getElementById('pause'),
            speed: document.getElementById('speed'),
            currentDate: document.getElementById('current-date'),
            timeline: document.getElementById('timeline'),
            minPower: document.getElementById('min-power'),
            maxPower: document.getElementById('max-power'),
            minPowerValue: document.getElementById('min-power-value'),
            maxPowerValue: document.getElementById('max-power-value'),
            showAllPrevious: document.getElementById('show-all-previous'),
            periodSwitch: document.getElementById('period-switch'),
            periodLabel: document.getElementById('period-label')
        };

        this.state = {
            currentDateIndex: 0,
            playInterval: null,
            speed: this.config.INITIAL_SPEED,
            minPower: 0,
            maxPower: 450,
            showAllPrevious: false,
            isQuarterly: false,
            currentData: {},
            dates: []
        };

        this.initMap();
        this.initLegend();
        this.initEventListeners();
        this.loadData();
    }

    initMap() {
        this.map = L.map('map').setView(this.config.MAP_CENTER, this.config.MAP_ZOOM);
        L.tileLayer(this.config.TILE_LAYER_URL, {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        this.markers = L.layerGroup().addTo(this.map);
        this.colorScale = chroma.scale(this.config.COLOR_SCALE).domain([0, 450]);
    }

    initLegend() {
        this.legend = L.control({ position: 'topright' });
        this.legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<h4>Puissance (kW)</h4><div id="legend-content"></div>';
            return div;
        };
        this.legend.addTo(this.map);
    }

    async loadData() {
        try {
            const fileName = this.state.isQuarterly ? 
                this.config.DATA_FILES.quarterly : 
                this.config.DATA_FILES.monthly;
            
            const response = await fetch(fileName);
            this.state.currentData = await response.json();
            
            this.state.dates = Object.keys(this.state.currentData)
                .sort()
                .filter(date => date >= "2014-01");
            
            this.updateTimelineControls();
            this.createTimelineMarkers();
            this.updateMap(true);
        } catch (error) {
            console.error('Erreur de chargement des données:', error);
        }
    }

    updateTimelineControls() {
        this.domElements.timeline.max = this.state.dates.length - 1;
        this.domElements.timeline.value = 0;
        this.state.currentDateIndex = 0;
    }

    createTimelineMarkers() {
        const container = document.getElementById('timeline-markers');
        container.innerHTML = '';
    
        const years = [...new Set(this.state.dates.map(date => {
            return date.split('-')[0];
        }))];
    
        const startYear = parseInt(years[0]);
        const endYear = parseInt(years[years.length - 1]);
    
        years.forEach(year => {
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.textContent = year;
            const position = ((parseInt(year) - startYear) / (endYear - startYear)) * 100;
            marker.style.left = `${position}%`;
            container.appendChild(marker);
        });
    }

    updateMap(skipInterval = false) {
        if (this.state.currentDateIndex >= this.state.dates.length) {
            this.stopPlayback();
            return;
        }
    
        const currentDate = this.state.dates[this.state.currentDateIndex];
    
        if (currentDate.includes('-Q')) {
            this.domElements.currentDate.textContent = currentDate.split('-')[0];
        } else if (currentDate.match(/^\d{4}-\d{2}$/)) {
            this.domElements.currentDate.textContent = currentDate;
        } else {
            this.domElements.currentDate.textContent = currentDate;
        }
    
        this.domElements.timeline.value = this.state.currentDateIndex;
    
        this.markers.clearLayers();
        this.renderMarkers(currentDate);
    
        if (!skipInterval) {
            this.state.currentDateIndex++;
        }
    }

    renderMarkers(currentDate) {
        const startIndex = this.state.showAllPrevious ? 0 : this.state.currentDateIndex;
        
        for (let i = startIndex; i <= this.state.currentDateIndex; i++) {
            const date = this.state.dates[i];
            if (this.state.currentData[date]) {
                this.state.currentData[date].forEach(point => {
                    if (point.puissance_nominale >= this.state.minPower && 
                        point.puissance_nominale <= this.state.maxPower) {
                        this.createMarker(point);
                    }
                });
            }
        }
        
        this.updateLegend();
    }

    createMarker(point) {
        return L.circleMarker([point.latitude, point.longitude], {
            radius: 5,
            fillColor: this.colorScale(point.puissance_nominale).hex(),
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(this.createPopupContent(point))
            .addTo(this.markers);
    }

    createPopupContent(point) {
        return `
            <b>Code INSEE:</b> ${point.code_insee}<br>
            <b>Nombre de PDC:</b> ${point.nbre_pdc}<br>
            <b>Puissance nominale:</b> ${point.puissance_nominale} kW
        `;
    }

    updateLegend() {
        const legendContent = document.getElementById('legend-content');
        legendContent.innerHTML = '';
        
        const steps = 5;
        const powerRange = this.state.maxPower - this.state.minPower;
        const stepSize = powerRange / steps;
    
        const legendContainer = document.createElement('div');
        legendContainer.className = 'legend-container';
    
        for (let i = 0; i <= steps; i++) {
            const power = this.state.minPower + i * stepSize;
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = this.colorScale(power).hex();
            colorBox.style.width = '20px';
            colorBox.style.height = '20px';
            
            const label = document.createElement('span');
            label.textContent = Math.round(power);
            label.style.marginLeft = '5px';
            
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.marginBottom = '5px';
            item.appendChild(colorBox);
            item.appendChild(label);
            
            legendContainer.appendChild(item);
        }
    
        legendContent.appendChild(legendContainer);
    }

    initEventListeners() {
        this.domElements.play.addEventListener('click', () => this.startPlayback());
        this.domElements.pause.addEventListener('click', () => this.stopPlayback());
        
        this.domElements.speed.addEventListener('input', (e) => {
            this.state.speed = 2100 - e.target.value;
            if (this.state.playInterval) this.startPlayback();
        });

        this.domElements.minPower.addEventListener('input', (e) => {
            this.updatePowerRange('min', e.target.value);
            this.updateMap(true);
        });
            
        this.domElements.maxPower.addEventListener('input', (e) => {
            this.updatePowerRange('max', e.target.value);
            this.updateMap(true);
        });

        const powerPresets = {
            'ultra-low-power': [0, 11],
            'low-power': [11, 22],
            'medium-power': [40, 60],
            'high-power': [250, 450]
        };

        Object.entries(powerPresets).forEach(([id, range]) => {
            document.getElementById(id).addEventListener('click', () => 
                this.setCustomPowerRange(...range));
        });

        this.domElements.showAllPrevious.addEventListener('change', (e) => {
            this.state.showAllPrevious = e.target.checked;
            this.updateMap(true);
        });

        this.domElements.periodSwitch.addEventListener('change', (e) => {
            this.state.isQuarterly = e.target.checked;
            this.domElements.periodLabel.textContent = 
                this.state.isQuarterly ? 'Annuel' : 'Mensuel';
            this.loadData();
        });

        this.domElements.timeline.addEventListener('input', (e) => {
            this.state.currentDateIndex = parseInt(e.target.value);
            this.updateMap(true);
        });
    }

    startPlayback() {
        this.stopPlayback();
        this.state.playInterval = setInterval(() => this.updateMap(), this.state.speed);
    }

    stopPlayback() {
        if (this.state.playInterval) {
            clearInterval(this.state.playInterval);
            this.state.playInterval = null;
        }
    }

    updatePowerRange(type, value) {
        const power = parseInt(value);
        this.state[`${type}Power`] = power;
        this.domElements[`${type}PowerValue`].textContent = power;
        this.updateMap(true);
        this.updateLegend();
    }

    setCustomPowerRange(min, max) {
        this.state.minPower = min;
        this.state.maxPower = max;
        this.domElements.minPower.value = min;
        this.domElements.maxPower.value = max;
        this.domElements.minPowerValue.textContent = min;
        this.domElements.maxPowerValue.textContent = max;
        this.updateMap(true);
        this.updateLegend();
    }
}

new ChargingMap();
