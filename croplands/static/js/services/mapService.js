app.factory('mapService', ['wmsLayers', 'leafletData', '$http', '$q', '$interval', '$timeout', function (wmsLayers, leafletData, $http, $q, $interval, $timeout) {
    var CroplandMap = function (name, type, assetName, years, layerOptions, legend) {
        this._getUrl = function (year) {
            return 'https://tiles.croplands.org/' + this.assetName + '/{x}/{y}/{z}?year=' + year;
//            return 'http://127.0.0.1:8000/tiles/' + this.assetName + '/{x}/{y}/{z}?year=' + year;
        };


        this.play = function () {
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

        this.name = name;
        this.assetName = assetName;
        this.type = type;
        this.zIndex = 10;
        this.url = this._getUrl(2014);
        this.years = years;
        this.activeYear = 2014;
        this.layerOptions = layerOptions;
        this.legend = [];
        this.refresh = true;
        this.playSpeed = 4000;
        this.legend = legend;
        this.setYear = function (year) {
            this.activeYear = year;
            this.url = this._getUrl(year);
        };
        this.next = function () {
            if (this.years) {
                var idx = _.indexOf(this.years, this.activeYear);
                if (idx === this.years.length - 1) {
                    this.activeYear = this.years[0];
                } else {
                    this.activeYear = this.years[idx + 1];
                }
                this.url = this._getUrl(this.activeYear);
            }
        };
        this.previous = function () {
            if (this.years) {
                var idx = _.indexOf(this.years, this.activeYear);
                if (idx === 0) {
                    this.activeYear = this.years[this.years.length - 1];
                } else {
                    this.activeYear = this.years[idx - 1];
                }
                this.url = this._getUrl(this.activeYear);
            }
        };
        this.reset = function () {
            if (this.years) {
                this.url = this._getUrl(this.years[this.years.length - 1]);
            }
        };
        this.stop = function () {
            $interval.cancel(this.loop);
            delete this.loop;
        };

    };


    var map = {
        allowedEvents: {
            map: {
                enable: ['moveend', 'click'],
                logic: 'emit'
            },
            marker: {
                enable: ['click'],
                logic: 'emit'
            }
        },
        bounds: {
            northEast: {
                lat: 90,
                lng: 180
            },
            southWest: {
                lat: -90,
                lng: -180
            }
        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        layers: {
            baselayers: {
                googleHybrid: {
                    name: 'Satellite',
                    layerType: 'HYBRID',
                    type: 'google',
                    visible: true
                },
                googleTerrain: {
                    name: 'Terrain',
                    layerType: 'TERRAIN',
                    type: 'google',
                    visible: false
                },

                googleRoadmap: {
                    name: 'Streets',
                    layerType: 'ROADMAP',
                    type: 'google',
                    visible: false
                }

            },
            overlays: {
                gfsad1000v00: wmsLayers.gfsad1000v00,
                gfsad1000v10: wmsLayers.gfsad1000v10,
                locations: {
                    name: 'Locations',
                    type: 'markercluster',
                    visible: false,
                    layerOptions: {
                        showCoverageOnHover: false,
                        chunkedLoading: true,
                        disableClusteringAtZoom: 10,
                        removeOutsideVisibleBounds: true
                    }
                },
                ndvi: {
                    layerOptions: {
                        opacity: 0.7},
                    visible: false,
                    name: 'NDVI Annual Composite Landsat 7',
                    type: 'xyz',
                    url: 'http://tiles.croplands.org/ndvi_landsat_7_2014/{x}/{y}/{z}'
                },
                australia: new CroplandMap('Australia 250m ACCA', 'xyz', 'australia_acca', [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
                    {},
                    [
                        {label: 'Croplands, rainfed, SC (season 1 &2), all crops', color: '#FFFF00'},
                        {label: 'Croplands, rainfed,SC, pastures', color: '#66FFFF'},
                        {label: 'Croplands, irrigated, SC, DC (Season1 &2), all crops', color: '#FF66FF'},
                        {label: 'Croplands, irrigated, SC, pastures', color: '#00B0F0'},
                        {label: 'Croplands, irrigated, continuous, orchards ', color: '#00B050'},
                        {label: 'Croplands,  fallow ', color: '#FBD4B4'}
                    ]),
                africa: new CroplandMap('Africa 250m ACCA', 'xyz', 'africa_acca',
                    [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
                    {},
                    [
                        {label: 'Irrigated, Single, Mixed Crops I / Rice', color: '#0E1771'},
                        {label: 'Irrigated, Single, Mixed Crops II / Rice / Sorghum', color: '#1E5CFF'},
                        {label: 'Irrigated, Double, Mixed Crops I / Rice', color: '#00B30C'},
                        {label: 'Irrigated, Double, Mixed Crops II / Rice', color: '#8B7140'},
                        {label: 'Irrigated, Continuous, Sugarcane / Plantation / Other', color: '#DFFFB7'},
                        {label: 'Irrigated, Continuous, Mixed Crops', color: '#FEA800'},
                        {label: 'Rainfed, Single, Rice', color: '#F8FF00'},
                        {label: 'Rainfed, Single, Maize / Unknown', color: '#00FFE3'},
                        {label: 'Rainfed, Double, Maize / Rice', color: '#73FF71'},
                        {label: 'Rainfed, Continuous, Plantation / Unknown', color: '#FD0000'},
                        {label: 'Rainfed, Continuous, Sugarcane / Plantation / Other', color: '#FF50DC'},
                        {label: 'Rainfed, Unclassified Croplands', color: '#953663'},
                        {label: 'Fallow Croplands', color: '#FFBABB'},
                        {label: 'Not Croplands', color: '#000000'}
                    ]
                )
            }
        },
        paths: {
            selection: {
                opacity: 0.75,
                weight: 2,
                type: "rectangle",
                created: false,
                cropped: false,
                visible: false,
                dashArray: '3, 3',
                color: '#428bca',
                fillColor: 'rgba(150,200,255,0.9)',
                latlngs: [
                    {lat: 0, lng: 0},
                    {lat: 0, lng: 0}
                ]
            }
        },
        markers: []

    };

    map.zoom = function (lat, lon, zoom) {
        if (zoom) {
            map.center.zoom = zoom;
        }
        map.center.lat = lat;
        map.center.lng = lon;
    };
    map.zoomIn = function () {
        this.center.zoom += 1;
    };
    map.zoomOut = function () {
        this.center.zoom -= 1;
    };
    map.getAfricaMap = function (code, cluster) {
        var params = {};

        if (code) {
            params.code = code;
        }
        if (cluster) {
            params.cluster_code = cluster;
        }

        if (code || cluster) {
            params.background = 'true';
        }

        params.background = 'true';

        return $http({method: 'GET', url: 'https://api.croplands.org/gee/maps/africa/v3', params: params});
    };

    map.geeTileUrl = function (mapId, token) {
        return 'https://earthengine.googleapis.com//map/' + mapId + '/{z}/{x}/{y}?token=' + token;
    };

    return map;
}])
;