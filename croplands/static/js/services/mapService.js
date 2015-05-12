app.factory('mapService', ['wmsLayers', 'leafletData', '$http', '$q', function (wmsLayers, leafletData, $http, $q) {
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
                gee: {
                    layerOptions: {
                        opacity: 0.7},
                    visible: false,
                    name: 'Test',
                    type: 'xyz',
                    url: 'https://earthengine.googleapis.com//map/1d1122f9f537c93784d37d1c15675544/{z}/{x}/{y}?token=ebae1e7ff0843b5625c9e4c807aea231',
                    legend: [
                        {
                            "color": "#1f77b4",
                            "label": "Noncrop Barren/Other"
                        },
                        {
                            "color": "#aec7e8",
                            "label": "Noncrop Forest/Grass/Rangelands/Shrubs"
                        },
                        {
                            "color": "#ff7f0e",
                            "label": "Irrigated Double Rice/Mixed"
                        },
                        {
                            "color": "#ffbb78",
                            "label": "Irrigated Single Rice/Sugarcane"
                        },
                        {
                            "color": "#2ca02c",
                            "label": "Rainfed Double Rice/Tef/Mixed"
                        },
                        {
                            "color": "#98df8a",
                            "label": "Rainfed Single Banana/Tef/Sorghum/Tobacco/Wheat"
                        },
                        {
                            "color": "#d62728",
                            "label": "Rainfed Single Maize/Rice/Pigeonpea/Sorghum/Mixed"
                        },
                        {
                            "color": "#ff9896",
                            "label": "Rainfed Single Sugarcane"
                        },
                        {
                            "color": "#9467bd",
                            "label": "Continuous Plantation"
                        }
                    ],
                    refresh: true
                }
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
}]);