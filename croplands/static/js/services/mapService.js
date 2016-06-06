app.factory('mapService', ['wmsLayers', 'leafletData', '$http', '$q', '$interval', '$timeout', function (wmsLayers, leafletData, $http, $q, $interval, $timeout) {
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
                },
                ndvi_landsat_7_2014: {
                    layerOptions: {
                        opacity: 1,
                        minZoom: 0,
                        maxNativeZoom: 15,
                        zIndex: 0
                    },
                    visible: false,
                    name: 'NDVI Landsat 7 2014 Composite',
                    type: 'xyz',
                    url: 'http://tiles.croplands.org/ndvi_landsat_7_2014/{x}/{y}/{z}'
                }
            },
            overlays: {
                gfsad1000v00: wmsLayers.gfsad1000v00,
                gfsad1000v10: wmsLayers.gfsad1000v10,
                us250v201512y2008: wmsLayers.us250v201512y2008,
                africaL4250v201512y2014: wmsLayers.africaL4250v201512y2014,
                egypt30mv201512y2014: wmsLayers.egypt30mv201512y2014,
                southamerica30v201512: wmsLayers.southamerica30v201512,
                southAsia250v201601y2010: wmsLayers.southAsia250v201601y2010,
                australia: wmsLayers.australiaACCA250m,
                australia30mExtent: wmsLayers.australiaExtent30m
            }
        }
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
    return map;
}]);