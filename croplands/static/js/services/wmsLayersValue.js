app.factory('wmsLayers', ['$interval', 'leafletData', 'log', function ($interval, leafletData, log) {
    var _layers, WMSCollection;
    WMSCollection = function (obj, defaultLayer, defaultStyle) {
        this.playSpeed = 2000;
        _.extend(this, obj);

        if (this.layers) {
            this.idx = defaultLayer === undefined ? 0 : defaultLayer;
            console.log(this.idx);
            this.layerOptions.layers = this.layers[this.idx].layer;
            this.layerOptions.layerLabel = this.layers[this.idx].label;
        }

        if (this.styles) {
            var style, styles;

            if (defaultStyle) {
                style = this.styles[defaultStyle];
            } else {
                styles = _.values(this.styles);
                style = styles[styles.length - 1];
            }

            this.legend = style.legend;
            this.layerOptions.styles = style.id;
        }
    };

    WMSCollection.prototype.hasLayers = function () {
        return this.layers && this.layers.length > 1;
    };

    WMSCollection.prototype.hasStyles = function () {
        return this.styles && _.values(this.styles).length;
    };

    WMSCollection.prototype.changeImage = function (idx) {
        var currentWMSLayer = angular.copy(this.layerOptions.layers);

        this.layerOptions.layers = this.layers[idx].layer;
        this.layerOptions.layerLabel = this.layers[idx].label;

        this.redraw(currentWMSLayer);
    };

    WMSCollection.prototype.changeStyle = function (id) {
        var styleData;
        console.log(id);
        if (this.styles && this.styles[id]) {
            styleData = this.styles[id];
            this.layerOptions.styles = styleData.id;
        } else {
            log.error("[WMS] No style available.");
            return;
        }

        if (styleData.legend) {
            this.legend = styleData.legend;
        }

        this.redraw(this.layerOptions.layers);
    };

    /**
     * Set the wms parameters using leaflet functionality.
     * @param currentWMSLayer - needed to identify layer to redraw
     */
    WMSCollection.prototype.redraw = function (currentWMSLayer) {
        var currentLayer = this;
        console.log(currentLayer.layerOptions);
        leafletData.getMap().then(function (map) {
            map.eachLayer(function (layer) {
                if (layer.url === currentLayer._url && layer.options.layers === currentWMSLayer) {
                    var newParams = _.extend(layer.options, currentLayer.layerOptions);
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
        this.changeImage(this.idx);
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
        this.changeImage(this.idx);
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
            name: 'Australia GCE 250m Cropland Products 2000 to Present from ACCA ',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: false,
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
        australiaExtent30m: new WMSCollection({
            id: 'australia_30m_v2016-6-1_y2014',
            name: 'Australia GCE 30m Cropland Extent Product 2014',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(-9.83464522447101, 110.000125), L.latLng(-45.00754522447101, 158.961625)),
                layers: 'Products:australia_30m_v2016-6-1_y2014',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 17,
                opacity: 1
            },
            legend: [
                {label: 'Croplands', color: '#FFFF00'},
                {label: 'Pasture', color: '#66FFFF'}
            ]
        }),
        gfsad1000v00: {
            name: 'Global GCE 1km Cropland Dominance and Other Products',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
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
            name: 'Global GCE 1km Multi-study Cropland Mask Product',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
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
            name: 'United States GCE 250m Croplands 2008 from ACCA',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
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
        southAsia250v201601y2010: {
            name: 'South Asia 250m Croplands 2010-2011 from ACCA',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                layers: 'Products:south_asia_250m',
                minZoom: 0,
                maxZoom: 16,
                opacity: 1,
                format: 'image/png',
                transparent: true,
                bounds: L.latLngBounds(L.latLng(37.0985, 60.895), L.latLng(6.006, 97.416))
            },
            legend: [
                {label: "Unclassified", color: "#000000"},
                {label: "Irrigated-SW/GW-DC-rice-wheat", color: "#006400"},
                {label: "Irrigated-SW/GW-DC-rice-rice", color: "#00ff00"},
                {label: "Irrgated-SW-DC-beans/cotton-wheat", color: "#a0c27c"},
                {label: "Irrigated-SW-DC-Sugarcane/rice-rice/Plantations", color: "#7e9e65"},
                {label: "Irrigated-DC-fallows/pulses-rice-fallow", color: "#c5e5a4"},
                {label: "Irrigated-GW-DC-rice-maize/chickpea", color: "#7fffd4"},
                {label: "Irrgated-TC-rice-mixedcrops-mixedcrops", color: "#40e0d0"},
                {label: "Irrigated-GW-DC-millet/sorghum/potato-wheat/mustartd", color: "#cfe09c"},
                {label: "Irrigated-SW-DC-cotton/chilli/maize-fallow/pulses", color: "#00ffff"},
                {label: "Rainfed-DC-rice-fallows-jute/rice/mixed crops", color: "#ffff00"},
                {label: "Rainfed-SC-rice-fallow/pulses", color: "#ffd700"},
                {label: "Rainfed-DC-millets-chickpea/Fallows", color: "#cdad00"},
                {label: "Rainfed-SC-cotton/pigeonpea/mixedcrops", color: "#8b6913"},
                {label: "Rainfed-SC-groundnut/millets/sorghum", color: "#cd853f"},
                {label: "Rainfed-SC-pigeonpea/mixedcrops", color: "#ee9a49"},
                {label: "Rainfed-SC-millet-fallows/mixedcrops-", color: "#d8a585"},
                {label: "Rainfed-SC-fallow-chickpea-", color: "#e6bc8a"},
                {label: "Rainfed-SC-millets/fallows-LS", color: "#e0cab4"},
                {label: "Rainfed-SC-mixedcrops/Plantations", color: "#bd5e4d"},
                {label: "Shrublands/trees/Rainfed-mixedcrops30%", color: "#a020f0"},
                {label: "Other LULC", color: "#c0c0c0"}
            ]
        },
        africaL4250v201512y2014: new WMSCollection({
            name: 'Africa GCE 250m Cropland Products 2014 from ACCA',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: false,
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(37.3494, -25.3695), L.latLng(-34.83026000000001, 63.50536000000001)),
                layers: 'Products:Africa ACCA L4 250m v201512 year2014',
                minZoom: 0,
                maxZoom: 17,
                opacity: 1,
                format: 'image/png',
                transparent: true            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            styles: {
                'Africa ACCA L1 Extent v201512': {
                    name: 'Mask',
                    id: 'Africa ACCA L1 Extent v201512',
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]
                },
                'Africa ACCA L2 Water v201512': {
                    name: 'Irrigated',
                    id: 'Africa ACCA L2 Water v201512',
                    legend: [
                        {label: 'Irrigated', color: '#aec7e8'},
                        {label: 'Rainfed', color: '#9467bd'}
                    ]
                },
                'Africa ACCA L3 Intensity v201512': {
                    name: 'Intensity',
                    id: 'Africa ACCA L3 Intensity v201512',
                    legend: [
                        {label: "Single", color: "#aec7e8"},
                        {label: "Double", color: "#ffbb78"},
                        {label: "Continuous", color: "#98df8a"}
                    ]
                }//,
//                'Africa ACCA L4 Dominance v201512': {
//                    name: 'Dominance',
//                    id: 'Africa ACCA L4 Dominance v201512',
//                    legend: [
//                        {label: "C; IR; sc; mc I/rice", color: "#aec7e8"},
//                        {label: "C; IR; sc; mc II/rice/sorghum", color: "#ff7f0e"},
//                        {label: "C; IR; dc; mc I/rice", color: "#ffbb78"},
//                        {label: "C; IR; dc; mc II/rice", color: "#2ca02c"},
//                        {label: "C; IR; cc; sugarcane/plantations/other crops", color: "#98df8a"},
//                        {label: "C; IR; cc; mc", color: "#d62728"},
//                        {label: "C; IR; fallow croplands", color: "#ff9896"},
//                        {label: "C; RF; sc; rice", color: "#9467bd"},
//                        {label: "C; RF; sc; maize/unknown", color: "#bcbd22"},
//                        {label: "C; RF; dc; maize/rice", color: "#8c564b"},
//                        {label: "C; RF; cc; plantation/unknown", color: "#c49c94"},
//                        {label: "C; RF; cc; sugarcane/plantation/unknown", color: "#e377c2"},
//                        {label: "C; IR; cc; mc", color: "#f7b6d2"},
//                        {label: "C; RF; fallow croplands", color: "#7f7f7f"},
//                        {label: "NC; IR; barren/built-up/rangelands", color: "#c7c7c7"},
//                        {label: "NC; RF; shrubs/rangelands/forest", color: "#c5b0d5"},
//                        {label: "NC; mixed", color: "#dbdb8d"}
//                    ]
//                }
            }
        }),
        southamerica30v201512: {
            name: 'South America GCE 30m Cropland Mask Product 2014',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                layers: 'Products:South America Extent 30m v201512',
                minZoom: 0,
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
        egypt30mv201512y2014: new WMSCollection({
            name: 'Egypt GCE 30m Cropland Products 2014',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(37.3494, 24.3695), L.latLng(21.9, 36)),
                layers: 'Products:Egypt Extent 30m v201512 year2014',
                minZoom: 0,
                maxNativeZoom: 15,
                opacity: 1,
                format: 'image/png',
                transparent: true
            },
//        attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
            styles: {
                'Africa ACCA L1 Extent v201512': {
                    name: 'Mask',
                    id: 'Africa ACCA L1 Extent v201512',
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]
                },
                'Africa ACCA L2 Water v201512': {
                    name: 'Irrigated',
                    id: 'Africa ACCA L2 Water v201512',
                    legend: [
                        {label: 'Irrigated', color: '#aec7e8'},
                        {label: 'Rainfed', color: '#9467bd'}
                    ]
                }
            }
        }),
         africa_30m_extent_v201605_y2014: new WMSCollection({
            id: 'africa_30m_extent_v201605_y2014',
            name: 'Africa GCE 30m Cropland Extent Product 2014',
            type: 'wms',
            url: 'https://wms.croplands.org/geoserver/Products/wms',
            visible: true,
            layerOptions: {
                bounds: L.latLngBounds(L.latLng(37.3494, -25.3695), L.latLng(-34.83026000000001, 63.50536000000001)),
                layers: 'Products:africa_30m_extent_v201605_y2014',
                format: 'image/png',
                transparent: true,
                minZoom: 0,
                maxNativeZoom: 18,
                opacity: 1
            },
            legend: [
                {label: 'Cropland', color: '#00FF00'}
            ]
        })
    };

    return _layers;
}
]);