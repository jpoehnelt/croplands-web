/* leaflet-ng - 2016-08-10
* https://github.com/justinwp/leaflet-ng#readme
* Copyright (c) 2016 ;
* Last Modified: Wed Aug 10 2016 15:36:49
*/
angular.module("leaflet-ng-core", []);
angular.module("leaflet-ng-core").directive('lfBounds', ['leafletHelpers', function (leafletHelpers) {
    return {
        restrict: "A",
        scope: false,
        replace: false,
        require: 'leaflet',
        link: function (scope, element, attrs, ctrl) {
            var leafletScope = ctrl.getScope(), safeApply = leafletHelpers.safeApply;

            ctrl.getMap().then(function (map) {

                map.on('moveend', function () {
                    var bounds = map.getBounds();

                    safeApply(leafletScope, function () {
                        leafletScope.lfBounds = {
                            northEast: {
                                lng: bounds.getEast(),
                                lat: bounds.getNorth()
                            },
                            southWest: {
                                lng: bounds.getWest(),
                                lat: bounds.getSouth()
                            }
                        };
                    });
                });
            });
        }
    }
}]);
angular.module("leaflet-ng-core").directive('lfCenter', ['leafletHelpers', function (leafletHelpers) {
    return {
        restrict: "A",
        scope: false,
        replace: false,
        require: 'leaflet',
        link: function (scope, element, attrs, ctrl) {
            var leafletScope = ctrl.getScope(), safeApply = leafletHelpers.safeApply;

            ctrl.getMap().then(function (map) {
                leafletScope.$watch('lfCenter', function (center) {
                    map.setView([center.lat, center.lng], center.zoom);
                }, true);

                map.on('moveend', function (/* event */) {
                    safeApply(scope, function () {
                        angular.extend(leafletScope.lfCenter, {
                            lat: map.getCenter().lat,
                            lng: map.getCenter().lng,
                            zoom: map.getZoom(),
                            autoDiscover: false
                        });
                    });
                });
            });
        }
    }
}]);

angular.module("leaflet-ng-core").directive('leaflet', ['$q', 'leafletData', function ($q, leafletData) {
    return {
        restrict: "EA",
        replace: true,
        scope: {
            lfDefaults: '=',
            lfLayers: '=',
            lfCenter: '=',
            lfMarkers: '=',
            lfBounds: '=',
            lfEvents: '='
        },
        transclude: true,
        template: '<div class="angular-leaflet-map"><div ng-transclude></div></div>',
        controller: function ($scope) {
            this._leafletMap = $q.defer();
            this.getMap = function () {
                return this._leafletMap.promise;
            };

            this.getScope = function () {
                return $scope;
            };
        },
        link: function (scope, element, attrs, ctrl) {

            // Create the Leaflet Map Object with the options
            var map = new L.Map(element[0], scope.lfDefaults);


            leafletData.set('map', map, attrs.id);
            ctrl._leafletMap.resolve(map);

            // Resolve the map object to the promises
            map.whenReady(function () {
                console.log('map ready');

                if (angular.isDefined(scope.lfDefaults) && angular.isDefined(scope.lfDefaults.zoomControlPosition)) {
                    map.zoomControl.setPosition(scope.lfDefaults.zoomControlPosition);
                }

                leafletData.set('map', map, attrs.id);

                // add events
                angular.forEach(scope.lfEvents, function (f, event) {
                    console.log(event);
                    map.on(event, f);
                })

            });

            scope.$on('$destroy', function () {
                map.remove();
                leafletData.destroy(attrs.id);
            });
        }
    }
}]);

angular.module('leaflet-ng-core').factory('leafletData', [function () {
    var _data = {};

    function defaultMap(mapId) {
        if (!angular.isDefined(mapId)) {
            return 'main';
        } else {
            return mapId;
        }
    }

    function set(key, obj, mapId) {

        mapId = defaultMap(mapId);
        if (!angular.isDefined(_data[key])) {
            _data[key] = {}
        }
        _data[key][mapId] = obj;
    }

    function get(key, mapId) {
        mapId = defaultMap(mapId);
        if (angular.isDefined(_data[key]) && angular.isDefined(_data[key][mapId])) {
            return _data[key][mapId];
        }
    }

    return {
        set: set,
        get: get,
        getMap: function (mapId) {
            return get('map', mapId);
        },
        destroy: function (mapId) {
            mapId = defaultMap(mapId);

            angular.forEach(_data, function (value, key) {
                if (value.hasOwnProperty(mapId)) {
                    delete _data[key][mapId];
                }
            })
        }
    };

}]);

angular.module('leaflet-ng-core').factory('leafletHelpers', [function () {

    return {
        safeApply: function safeApply($scope, fn) {
            var phase = $scope.$root.$$phase;
            if (phase === '$apply' || phase === '$digest') {
                $scope.$eval(fn);
            } else {
                $scope.$evalAsync(fn);
            }
        }
    };

}]);

angular.module('leaflet-ng-layers', ['leaflet-ng-core'])
angular.module('leaflet-ng-layers').directive('lfLayers', ['leafletLayers', 'leafletData', '$q', function (leafletLayers, leafletData, $q) {
    var layerTypes = leafletLayers.getAll();

    return {
        restrict: "A",
        scope: false,
        replace: false,
        require: 'leaflet',
        controller: function ($scope) {
            $scope._leafletLayers = $q.defer();
            this.getLayers = function () {
                return $scope._leafletLayers.promise;
            };
        },
        link: function (scope, element, attrs, ctrl) {
            var leafletScope = ctrl.getScope(),
                layers = leafletScope.lfLayers, leafletLayers;

            ctrl.getMap().then(function (map) {
                var mapId = attrs.id;
                leafletLayers = leafletData.get('layers', mapId);
                leafletLayers = angular.isDefined(leafletLayers) ? leafletLayers : {};
                leafletLayers.baselayers = angular.isDefined(leafletLayers.baselayers) ? leafletLayers.baselayers : {};
                leafletLayers.overlays = angular.isDefined(leafletLayers.overlays) ? leafletLayers.overlays : {};
                scope._leafletLayers.resolve(leafletLayers);

                leafletScope.$watch('lfLayers.baselayers', function (newBaselayers, oldBaselayers) {
                    layerCompare(newBaselayers, oldBaselayers, 'baselayers');
                }, true);

                leafletScope.$watch('lfLayers.overlays', function (newOverlays, oldOverlays) {
                    layerCompare(newOverlays, oldOverlays, 'overlays');

                }, true);

                function layerCompare(newLayers, oldLayers, type) {
                    angular.forEach(oldLayers, function (layer, layerName) {
                        if (!angular.isDefined(newLayers[layerName])) {
                            map.removeLayer(leafletLayers[type][layerName])
                        }
                    });

                    // modify or add other layers
                    angular.forEach(newLayers, function (layer, layerName) {
                        var leafletLayer;
                        // create layer if it does not exist
                        if (!angular.isDefined(leafletLayers[type][layerName])) {
                            // create layer
                            leafletLayer = layerTypes[layer.type].createLayer(layer.params);
                            // save to internal
                            leafletLayers.overlays[layerName] = leafletLayer;
                        }
                        // get the existing layer and update it if changed
                        else {
                            // get layer
                            leafletLayer = leafletLayers[type][layerName];
                            // only update based upon options
                            if (!angular.equals(newLayers[layerName].params.options, oldLayers[layerName].params.options)) {
                                angular.extend(leafletLayer.options, newLayers[layerName].params.options);
                                leafletLayer.redraw();
                            }
                        }

                        if (layer.visible) {
                            map.addLayer(leafletLayer);
                        } else {
                            map.removeLayer(leafletLayer);
                        }

                    });
                }

                leafletData.set('layers', leafletLayers, mapId);

            });
        }
    };
}]);

angular.module('leaflet-ng-layers').factory('leafletLayers', ['$log', function ($log) {
    // minimal set of pre-defined layers
    var _layers = {
        'xyz': {
            createLayer: function (params) {
                return L.tileLayer(params.url, params.options);
            }
        },
        'wms': {
            createLayer: function (params) {
                return L.tileLayer.wms(params.url, params.options);
            }
        }

    };

    function set(type, definition) {

        if (_layers.hasOwnProperty(type)) {
            $log.error('[leaflet-ng-core] Layer already defined.');
        }

        _layers[type] = definition;
    }

    function get(type) {
        return _layers[type];
    }

    return {
        set: set,
        get: get,
        getAll: function () {
            return _layers;
        }
    };

}]);

angular.module('leaflet-ng-markers', ['leaflet-ng-core']);
angular.module('leaflet-ng-markers').directive('lfMarkers', ['leafletData', '$q', '$log', function (leafletData, $q, $log) {
    return {
        restrict: "A",
        scope: false,
        replace: false,
        require: 'leaflet',
        controller: function ($scope) {
            $scope._leafletMarkers = $q.defer();
            this.getMarkers = function () {
                return $scope._leafletMarkers.promise;
            };
        },
        link: function (scope, element, attrs, ctrl) {
            var leafletScope = ctrl.getScope(),
                markers = leafletScope.lfMarkers, leafletMarkers;

            ctrl.getMap().then(function (map) {
                var mapId = attrs.id;
                leafletMarkers = leafletData.get('markers', mapId);
                leafletMarkers = angular.isDefined(leafletMarkers) ? leafletMarkers : {};
                scope._leafletMarkers.resolve(leafletMarkers);

                leafletScope.$watch('lfMarkers', function (newMarkers, oldMarkers) {
                    angular.forEach(leafletMarkers, function (m, key) {
                        if (!angular.isDefined(newMarkers[key])) {
                            map.removeLayer(m);
                            delete leafletMarkers[key];
                        }
                    });

                    angular.forEach(newMarkers, function (params, key) {
                        var latLng = L.latLng([params.lat, params.lng]), m;

                        if (!angular.isDefined(leafletMarkers[key])) {
                            m = L.marker(latLng, params.options).addTo(map);
                            map.addLayer(m);
                            leafletMarkers[key] = m;
                        } else {
                            m = leafletMarkers[key];
                            m.setLatLng(latLng);
                            angular.extend(m.options, params.options);
                            m.update();
                        }
                    });

                }, true);

                leafletData.set('markers', leafletMarkers, mapId);

            });
        }
    };
}]);
