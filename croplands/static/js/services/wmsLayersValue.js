app.factory('wmsLayers', ['$interval', 'leafletData', function ($interval, leafletData) {
    var _layers, WMSCollection;
    WMSCollection = function (obj, idx) {
        this.playSpeed = 2000;
        this.idx = idx === undefined ? 0 : idx;
        _.extend(this, obj);
        this.change(0);
    };
    WMSCollection.prototype.hasLayers = function () {
        return this.layers && this.layers.length > 1;
    };

    WMSCollection.prototype.change = function (idx) {
        var currentLayer = this,
            currentWMSLayer = angular.copy(this.layerOptions.layers);

        this.layerOptions.layers = this.layers[idx].layer;
        this.layerOptions.layerLabel = this.layers[idx].label;

        leafletData.getMap().then(function (map) {
            map.eachLayer(function (layer) {
                if (layer.url === currentLayer._url && layer.options.layers === currentWMSLayer) {
                    var newParams = _.extend(layer.options, currentLayer.layerOptions);
                    console.log(newParams);
                    layer.setParams(newParams);
                }
            });
        });
    };

    WMSCollection.prototype.next = function () {
        if (!this.hasLayers()) {
            return;
        }
        if (this.idx === this.layers.length - 1) {
            this.idx = 0;
        } else {
            this.idx++;
        }
        this.change(this.idx);
    };

    WMSCollection.prototype.previous = function () {
        if (!this.hasLayers) {
            return;
        }
        if (this.idx === 0) {
            this.idx = this.layers.length - 1;
        } else {
            this.idx--;
        }
        this.change(this.idx);
    };

    WMSCollection.prototype.play = function () {
        if (!this.hasLayers) {
            return;
        }

        var self = this;
        if (this.loop) {
            $interval.cancel(this.loop);
            delete this.loop;
        } else {
            this.visible = true;
            this.loop = $interval(function () {
                self.next();
            }, this.playSpeed);
        }
    };

    WMSCollection.prototype.stop = function () {
        $interval.cancel(this.loop);
        delete this.loop;
    };

    _layers = {
        australiaACCA250m: new WMSCollection({
            id: 'australiaACCA250m',
            name: 'Australia 250m Cropland Products 2000 to Present from ACCA',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(-9.83464522447101, 110.000125), L.latLng(-45.00754522447101, 158.961625)),
                layers: 'Products:GCE 1km Crop Dominance year2000',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1
            },
            layers: [
                {layer: 'Products:Australia ACCA 250m v201512 year2000', label: '2000'},
                {layer: 'Products:Australia ACCA 250m v201512 year2001', label: '2001'},
                {layer: 'Products:Australia ACCA 250m v201512 year2002', label: '2002'},
                {layer: 'Products:Australia ACCA 250m v201512 year2003', label: '2003'},
                {layer: 'Products:Australia ACCA 250m v201512 year2004', label: '2004'},
                {layer: 'Products:Australia ACCA 250m v201512 year2005', label: '2005'},
                {layer: 'Products:Australia ACCA 250m v201512 year2006', label: '2006'},
                {layer: 'Products:Australia ACCA 250m v201512 year2007', label: '2007'},
                {layer: 'Products:Australia ACCA 250m v201512 year2008', label: '2008'},
                {layer: 'Products:Australia ACCA 250m v201512 year2009', label: '2009'},
                {layer: 'Products:Australia ACCA 250m v201512 year2010', label: '2010'},
                {layer: 'Products:Australia ACCA 250m v201512 year2011', label: '2011'},
                {layer: 'Products:Australia ACCA 250m v201512 year2012', label: '2012'},
                {layer: 'Products:Australia ACCA 250m v201512 year2013', label: '2013'},
                {layer: 'Products:Australia ACCA 250m v201512 year2014', label: '2014'}
            ],
            legend: [
                {label: '1 Croplands, rainfed, SC (Season 1 & 2), all crops', color: '#FFFF00'},
                {label: '2 Croplands, rainfed,SC, pastures', color: '#66FFFF'},
                {label: '3 Croplands, irrigated, SC, DC (Season 1 & 2), all crops', color: '#FF66FF'},
                {label: '4 Croplands, irrigated, SC, pastures', color: '#00B0F0'},
                {label: '5 Croplands, irrigated, continuous, orchards ', color: '#00B050'},
                {label: '6 Croplands,  fallow ', color: '#FBD4B4'}
            ]
        }),
        gfsad1000v00: {
            name: 'GCE 1km Crop Dominance',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:GCE 1km Crop Dominance year2000',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1
            },
            attribution: '<a href="https://powellcenter.usgs.gov/globalcroplandwater/sites/default/files/August%20HLA-final-1q-high-res.pdf">Thenkabail et al., 2012</a>',
            legend: [
                {label: 'Irrigated: Wheat and Rice Dominant', color: '#0000FF'},
                {label: 'Irrigated: Mixed Crops 1: Wheat, Rice, Barley, Soybeans', color: '#A020EF'},
                {label: 'Irrigated: Mixed Crops 2: Corn, Wheat, Rice, Cotton, Orchards', color: '#FF00FF'},
                {label: 'Rainfed: Wheat, Rice, Soybeans, Sugarcane, Corn, Cassava', color: '#00FFFF'},
                {label: 'Rainfed: Wheat and Barley Dominant', color: '#FFFF00'},
                {label: 'Rainfed: Corn and Soybeans Dominant', color: '#007A0B'},
                {label: 'Rainfed: Mixed Crops 1: Wheat, Corn, Rice, Barley, Soybeans', color: '#00FF00'},
                {label: 'Minor Fractions of Mixed Crops: Wheat, Maize, Rice, Barley, Soybeans', color: '#505012'},
                {label: 'Other Classes', color: '#B2B2B2'}
            ]
        },
        gfsad1000v10: {
            name: 'GCE 1km Multi-study Crop Mask',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:GCE 1km Crop Mask year2000',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1
            },
            attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Croplands, Irrigation major', color: '#FF00FF'},
                {label: 'Croplands, Irrigation minor', color: '#00FF00'},
                {label: 'Croplands, Rainfed', color: '#FFFF00'},
                {label: 'Croplands, Rainfed minor fragments', color: '#00FFFF'},
                {label: 'Croplands, Rainfed very minor fragments', color: '#D2B58C'}

            ]
        },
        us250v201512y2008: {
            name: 'United States Croplands 2008',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:United States ACCA 250m v201512 year2008',
                minZoom: 0,
                maxZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(49.4043, -124.5835), L.latLng(24.5025008881642, -66.8524020590759))
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Corn-Soybean', color: '#FFFF00'},
                {label: 'Wheat-Barley', color: '#FF0000'},
                {label: 'Potato', color: '#663300'},
                {label: 'Alfalfa', color: '#00FF00'},
                {label: 'Cotton', color: '#00FFFF'},
                {label: 'Rice', color: '#0000FF'},
                {label: 'Other Crops', color: '#FF6600'}
            ]
        },
        africaL4250v201512y2014: {
            name: 'Africa Crop Dominance 2014',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(37.3494, -25.3695), L.latLng(-34.83026000000001, 63.50536000000001)),
                layers: 'Products:Africa ACCA L4 250m v201512 year2014',
                minZoom: 0,
                maxZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                style: 'Africa ACCA L4 Dominance v201512'
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: "C; IR; sc; mc I/rice", color: "#aec7e8"},
                {label: "C; IR; sc; mc II/rice/sorghum", color: "#ff7f0e"},
                {label: "C; IR; dc; mc I/rice", color: "#ffbb78"},
                {label: "C; IR; dc; mc II/rice", color: "#2ca02c"},
                {label: "C; IR; cc; sugarcane/plantations/other crops", color: "#98df8a"},
                {label: "C; IR; cc; mc", color: "#d62728"},
                {label: "C; IR; fallow croplands", color: "#ff9896"},
                {label: "C; RF; sc; rice", color: "#9467bd"},
                {label: "C; RF; sc; maize/unknown", color: "#bcbd22"},
                {label: "C; RF; dc; maize/rice", color: "#8c564b"},
                {label: "C; RF; cc; plantation/unknown", color: "#c49c94"},
                {label: "C; RF; cc; sugarcane/plantation/unknown", color: "#e377c2"},
                {label: "C; IR; cc; mc", color: "#f7b6d2"},
                {label: "C; RF; fallow croplands", color: "#7f7f7f"},
                {label: "NC; IR; barren/built-up/rangelands", color: "#c7c7c7"},
                {label: "NC; RF; shrubs/rangelands/forest", color: "#c5b0d5"},
                {label: "NC; mixed", color: "#dbdb8d"}
            ]
        },
        southamerica30v201512: {
            name: 'South America Extent 30m',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:South America Extent 30m v201512',
                minZoom: 0,
                maxZoom: 15,
                maxNativeZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(12.835778465638036, -81.95811941094321), L.latLng(-56.073447989999984, -31.449983235209473))
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Cropland', color: '#00FF00'}
            ]
        },
        egypt30mv201512y2014: {
            name: 'Egypt 30m',
            type: 'wms',
            url: 'http://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                layers: 'Products:South America Extent 30m v201512',
                minZoom: 0,
                maxZoom: 15,
                maxNativeZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(12.835778465638036, -81.95811941094321), L.latLng(-56.073447989999984, -31.449983235209473))
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            legend: [
                {label: 'Cropland', color: '#00FF00'}
            ]
        }
    };

    return _layers;
}]);