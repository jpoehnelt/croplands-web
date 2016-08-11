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
;
/*
 * Google layer using Google Maps API
 */

/* global google: true */

L.Google = L.Layer.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		opacity: 1,
		continuousWorld: false,
		noWrap: false,
		mapOptions: {
			backgroundColor: '#dddddd'
		}
	},

	// Possible types: SATELLITE, ROADMAP, HYBRID, TERRAIN
	initialize: function(type, options) {
		L.Util.setOptions(this, options);

		this._ready = google.maps.Map !== undefined;
		if (!this._ready) L.Google.asyncWait.push(this);

		this._type = type || 'SATELLITE';
	},

	onAdd: function(map, insertAtTheBottom) {
		this._map = map;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();
		this._initMapObject();

		// set up events
		map.on('viewreset', this._resetCallback, this);

		this._limitedUpdate = L.Util.throttle(this._update, 150, this);
		map.on('move', this._update, this);

		map.on('zoomanim', this._handleZoomAnim, this);

		// 20px instead of 1em to avoid a slight overlap with google's attribution
		map._controlCorners.bottomright.style.marginBottom = '20px';

		this._reset();
		this._update();
	},

	onRemove: function(map) {
		map._container.removeChild(this._container);

		map.off('viewreset', this._resetCallback, this);

		map.off('move', this._update, this);

		map.off('zoomanim', this._handleZoomAnim, this);

		map._controlCorners.bottomright.style.marginBottom = '0em';
	},

	getAttribution: function() {
		return this.options.attribution;
	},

	setOpacity: function(opacity) {
		this.options.opacity = opacity;
		if (opacity < 1) {
			L.DomUtil.setOpacity(this._container, opacity);
		}
	},

	setElementSize: function(e, size) {
		e.style.width = size.x + 'px';
		e.style.height = size.y + 'px';
	},

	_initContainer: function() {
		var tilePane = this._map._container,
			first = tilePane.firstChild;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-google-layer');
			this._container.id = '_GMapContainer_' + L.Util.stamp(this);
			this._container.style.zIndex = 'auto';
		}

		tilePane.insertBefore(this._container, first);

		this.setOpacity(this.options.opacity);
		this.setElementSize(this._container, this._map.getSize());
	},

	_initMapObject: function() {
		if (!this._ready) return;
		this._google_center = new google.maps.LatLng(0, 0);
		var map = new google.maps.Map(this._container, {
			center: this._google_center,
			zoom: 0,
			tilt: 0,
			mapTypeId: google.maps.MapTypeId[this._type],
			disableDefaultUI: true,
			keyboardShortcuts: false,
			draggable: false,
			disableDoubleClickZoom: true,
			scrollwheel: false,
			streetViewControl: false,
			styles: this.options.mapOptions.styles,
			backgroundColor: this.options.mapOptions.backgroundColor
		});

		var _this = this;
		this._reposition = google.maps.event.addListenerOnce(map, 'center_changed',
			function() { _this.onReposition(); });
		this._google = map;

		google.maps.event.addListenerOnce(map, 'idle',
			function() { _this._checkZoomLevels(); });
		google.maps.event.addListenerOnce(map, 'tilesloaded',
			function() { _this.fire('load'); });
		// Reporting that map-object was initialized.
		this.fire('MapObjectInitialized', { mapObject: map });
	},

	_checkZoomLevels: function() {
		//setting the zoom level on the Google map may result in a different zoom level than the one requested
		//(it won't go beyond the level for which they have data).
		// verify and make sure the zoom levels on both Leaflet and Google maps are consistent
		if ((this._map.getZoom() !== undefined) && (this._google.getZoom() !== Math.round(this._map.getZoom()))) {
			//zoom levels are out of sync. Set the leaflet zoom level to match the google one
			this._map.setZoom( this._google.getZoom() );
		}
	},

	_resetCallback: function(e) {
		this._reset(e.hard);
	},

	_reset: function(clearOldContainer) {
		this._initContainer();
	},

	_update: function(e) {
		if (!this._google) return;
		this._resize();

		var center = this._map.getCenter();
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		if (this._map.getZoom() !== undefined)
			this._google.setZoom(Math.round(this._map.getZoom()));

		this._checkZoomLevels();
	},

	_resize: function() {
		var size = this._map.getSize();
		if (this._container.style.width === size.x &&
				this._container.style.height === size.y)
			return;
		this.setElementSize(this._container, size);
		this.onReposition();
	},


	_handleZoomAnim: function (e) {
		var center = e.center;
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(Math.round(e.zoom));
	},


	onReposition: function() {
		if (!this._google) return;
		google.maps.event.trigger(this._google, 'resize');
	}
});

L.Google.asyncWait = [];
L.Google.asyncInitialize = function() {
	var i;
	for (i = 0; i < L.Google.asyncWait.length; i++) {
		var o = L.Google.asyncWait[i];
		o._ready = true;
		if (o._container) {
			o._initMapObject();
			o._update();
		}
	}
	L.Google.asyncWait = [];
};
;
var gfsad = {};
gfsad.decToHex = function (n) {
    // return two digit hex number
    if (n > 255) {
        throw "Cannot convert to hex.";
    }
    return (n + 0x100).toString(16).substr(-2).toUpperCase();
};;
var app = angular.module("app", ["leaflet-ng-core", "leaflet-ng-layers", "leaflet-ng-markers", "ngRoute", 'mgcrea.ngStrap', 'server']);
app.config(['$tooltipProvider', '$routeProvider', '$sceDelegateProvider', '$locationProvider', 'server', function ($tooltipProvider, $routeProvider, $sceDelegateProvider, $locationProvider, server) {
    $routeProvider
        .when('/app/map', {
            templateUrl: '/static/templates/map.html',
            controller: 'MapController',
            reloadOnSearch: false
        }).when('/app/data', {
            templateUrl: '/static/templates/data.html',
            controller: 'DataController'
        }).when('/app/data/search', {
            templateUrl: '/static/templates/data/search.html',
            controller: 'DataSearchController',
            reloadOnSearch: false
        }).when('/app/data/record', {
            templateUrl: '/static/templates/data/record.html',
            controller: 'DataRecordController'
        }).when('/app/data/classify', {
            templateUrl: '/static/templates/data/classify.html',
            controller: 'ClassifyController'
        }).when('/app/data/street', {
            templateUrl: '/static/templates/data/street.html',
            controller: 'StreetController'
        }).when('/app/a/login', {
            templateUrl: '/static/templates/account/login.html',
            controller: 'LoginController'
        }).when('/app/a/register', {
            templateUrl: '/static/templates/account/register.html',
            controller: 'RegisterController'
        }).when('/app/a/forgot', {
            templateUrl: '/static/templates/account/forgot.html',
            controller: 'ForgotController'
        }).when('/app/a/reset', {
            templateUrl: '/static/templates/account/reset.html',
            controller: 'ResetController'
        }).when('/app/a/logout', {
            templateUrl: '/static/templates/account/logout.html',
            controller: 'LogoutController'
        }).when('/app/a/messages', {
            templateUrl: '/static/templates/account/messages.html',
            controller: 'MessagesController'
        }).otherwise({
            templateUrl: '/static/templates/404.html'
        });
    $locationProvider.html5Mode(true);
//    $locationProvider.hashPrefix('!/');

    angular.extend($tooltipProvider.defaults, {
        animation: 'am-fade-and-scale',
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });
    $sceDelegateProvider.resourceUrlWhitelist([
        // Allow same origin resource loads.ot
        'self',
        // Allow loading from our assets domain.  Notice the difference between * and **.
        'http://127.0.0.1:8000/**',
        'https://api.croplands.org/**',
            "http:" +server.address + '/**',
            "https:" +server.address + '/**'
    ]);
}]);
;
app.factory('DataRecord', ['mappings', '$http', '$rootScope', '$q', 'DataService', 'log', 'User', '$location','server', function (mappings, $http, $rootScope, $q, DataService, log, User, $location, server) {
    var _baseUrl = server.address,
        record = {
            paging: {},
            current: {}
        };

    record.paging.hasNext = function () {
        return DataService.records.length > record.index + 1;
    };

    record.paging.hasPrevious = function () {
        return record.index > 0;
    };

    record.paging.next = function () {
        if (record.paging.hasNext()) {
            record.goTo(++record.index);
        }
        return record.index;
    };

    record.paging.previous = function () {
        if (record.paging.hasPrevious()) {
            record.goTo(--record.index);
        }
    };

    record.get = function (id) {
        var deferred = $q.defer();
        $http({
            method: 'GET',
            url: _baseUrl + '/api/records/' + String(id)
        }).then(function (response) {
            deferred.resolve(response.data);
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };

    record.goTo = function (index) {
        if (index !== undefined) {
            record.index = index;
        }

        record.current = DataService.records[index];

        $location.path('/app/data/record').search({'id': record.current.id});
    };

    return record;
}]);
;
app.factory('DataService', ['mappings', '$http', '$rootScope', '$q', '$timeout', 'log', 'User', '$window', '$httpParamSerializer','server', function (mappings, $http, $rootScope, $q, $timeout, log, User, $window, $httpParamSerializer, server) {
    var _baseUrl = server.address,
        data = {
            records: [],
            count: {},
            columns: angular.copy(mappings),
            ordering: {},
            paging: {
                page: 1,
                page_size: 200
            },
            busy: false,
            bounds: false,
            ndviLimits: false,
            is_initialized: false
        }, canceler = $q.defer();


    function select(choices, value) {
        _.each(choices, function (option) {
            option.selected = value;
        });
    }

    function csvToJSON(csv, types) {
        var lines = csv.split("\n"),
            headers = lines[0].split(','),
            results;

        results = _.map(lines.slice(1, lines.length - 1), function (l) {
            var row = {};
            _.each(l.split(','), function (col, i) {
                var value = col;
                if (types && types[headers[i]]) {
                    value = types[headers[i]](col);
                }

                row[headers[i]] = value;
            });
            return row;
        });
        return results;
    }

    data.getParams = function () {
        var filters = {};
        _.each(data.columns, function (column, key) {
            var values = [];
            _.each(column.choices, function (option) {
                if (option.selected) {
                    values.push(option.id);
                }
            });
            filters[key] = values;
        });

        if (data.bounds) {
            filters.southWestBounds = data.bounds.southWest.lat + ',' + data.bounds.southWest.lng;
            filters.northEastBounds = data.bounds.northEast.lat + ',' + data.bounds.northEast.lng;
        }

        if (data.ndviLimits) {
            filters.ndvi_limit_upper = data.ndviLimits.upper.join(",");
            filters.ndvi_limit_lower = data.ndviLimits.lower.join(",");
        }

        return _.assign(filters, data.ordering, data.paging);
    };

    data.setDefault = function () {
        select(data.columns.land_use_type.choices, false);
        select(data.columns.crop_primary.choices, false);
        select(data.columns.water.choices, false);
        select(data.columns.intensity.choices, false);
        select(data.columns.year.choices, false);
        select(data.columns.source_type.choices, false);
    };

    data.reset = function () {
        log.info("[DataService] Reset");
        data.setDefault();
    };

    // load data from server
    data.load = function () {
        log.info("[DataService] Load");
        var deferred = $q.defer();
        data.busy = true;
        data.is_initialized = true;

        canceler.resolve();
        canceler = $q.defer();

        $http({
            url: _baseUrl + '/data/search',
            method: "GET",
            params: data.getParams(),
            timeout: canceler.promise
        }).then(function (response) {
            data.records = csvToJSON(response.data, {
                id: parseInt,
                month: parseInt,
                year: parseInt,
                lat: parseFloat,
                lon: parseFloat,
                crop_primary: parseInt,
                crop_secondary: parseInt,
                crop_tertiary: parseInt,
                water: parseInt,
                intensity: parseInt,
                land_use_type: parseInt
            });

            var headers = response.headers();
            data.count.total = headers['query-count-total'];
            data.count.filtered = headers['query-count-filtered'];
            deferred.resolve(response);
            $rootScope.$broadcast("DataService.load", data.records);
            data.busy = false;
        }, function (e) {
            deferred.reject(e);
        });

        return deferred.promise;
    };

    data.download = function () {
        var params = data.getParams(), query, url;
        params.page_size = 100000;
        query = $httpParamSerializer(params);

        url = _baseUrl + '/data/download' + '?' + query;
        $window.open(url);
    };

    data.init = function () {
        log.info("[DataService] Init");
        if (!data.is_initialized) {
            data.setDefault();
            data.load();
            data.is_initialized = true;
        }
    };

    return data;
}]);
;
app.factory('RatingService', ['$http', '$rootScope', 'log', 'User', '$q','locationFactory','server', function ($http, $rootScope, log, User, $q, locationFactory, server) {
    var ratingLookup = {},
//        _baseUrl = 'http://127.0.0.1:8000';
        _baseUrl = server.address;

    /**
     * Applies a rating to a record.
     * @param record
     * @param rating
     * @returns {*}
     */
    function rateRecord(record, rating) {
        var deferred = $q.defer();
        $http({
            method: 'POST',
            url: _baseUrl + '/api/ratings',
            data: {
                record_id: record.id,
                rating: rating
            }
        }).then(function (response) {
            record.user_rating = response.data;
            record.visited = true;
            locationFactory.setIcon(record);
            log.debug('[RatingService] Set the rating to: '+ String(rating));
            deferred.resolve(record);
        }, function (err) {
            log.error('[RatingService] Could not set rating.');
            deferred.reject(err);
        });

        return deferred.promise;
    }

    function getRecordRatings() {
        log.info('[RatingService] Getting Ratings for Records');
        var deferred = $q.defer(), id;
        if (User.isLoggedIn() && User.get().id) {

            id = User.get().id;

            $http({
                method: 'GET',
                url: _baseUrl + '/api/ratings?q={"filters":[{"name":"user_id","op":"eq","val":' + id + '}]}'
            }).then(function (response) {
                log.info(response);
                _.each(response.data.objects, function (r) {
                    ratingLookup[r.record_id] = r;
                });

                _.each(locationFactory.getRecords(), function (l){
                    if (ratingLookup[l.id]) {
                        l.user_rating = ratingLookup[l.id];
                        locationFactory.setIcon(l);
                    }
                });

                deferred.resolve();
            }, function (err) {
                log.error(err);
                deferred.reject(err);
            });

        } else {
            deferred.reject();
        }


        return deferred.promise;
    }

    $rootScope.$on('locationFactory.markers.downloaded', function (){
        getRecordRatings();
    });

    return {
        rateRecord: rateRecord,
        getRecordRatings: getRecordRatings
    };
}]);;
app.factory('User', [ '$http', '$window', '$q', 'log','$rootScope','$location','server', function ($http, $window, $q, log, $rootScope, $location, server) {
    var _user = {},
        _baseUrl = server.address;

    function getUser() {
        return _user;
    }

    function getRole() {
        var role;
        if (_user.role) {
            role = _user.role;
        } else {
            role = 'anon';
        }

//        log.debug('[UserService] getRole() : ' + role);

        return role;
    }

    function loadFromToken(token) {
        _user = JSON.parse($window.atob(token.split(".")[1]));
        _user.token = token;
        $window.localStorage.user = JSON.stringify(_user);
        // save token for future requests
        $http.defaults.headers.common.authorization = 'bearer ' + _user.token;
    }

    function isLoggedIn() {
        if (_user.expires && _user.token) {
            var secondsToExpiration = _user.expires - Math.floor(new Date().getTime() / 1000);
            return secondsToExpiration > 300;
        }

        return false;
    }

    function goNext() {
        var next;
        try {
            next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
            $location.path(next.path).search(next.params);
        }
        catch (e) {
            $window.location.href = "/";
        }
    }

    function changePassword(token, password) {
        var deferred = $q.defer();
        $http.post("https://api.croplands.org/auth/reset", {
            token: token,
            password: password
        }).then(function () {
            deferred.resolve(true);
        }, function () {
            deferred.resolve(false);
        });
        return deferred.promise;
    }

    function login(email, password) {
        log.info("[User] Logging in...");

        var deferred = $q.defer(),
            data = {email: email, password: password},
            headers = {'Content-Type': 'application/json'};


        $http.post(_baseUrl + "/auth/login", data, headers).then(function (r) {
                log.info("[User] Successfully logged in.");
                // Load user if token is present, may require confirmation before logging in
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
                $rootScope.$emit('User.change');
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function register(data) {
        var deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post(_baseUrl + "/auth/register", data, headers).then(function (r) {
                log.info("[User] Successfully registered.");
                // Load user if token is present, may require confirmation before logging in
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
                $rootScope.$emit('User.change');
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject(r);
                }
            }
        );

        return deferred.promise;
    }

    function forgot(email) {
        var data = {email: email},
            deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post(_baseUrl + "/auth/forgot", data, headers).then(function (r) {
                log.info("[User] Sending reset email.");
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function reset(password, token) {
        var data = {password: password, token: token},
            deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post(_baseUrl + "/auth/reset", data, headers).then(function (r) {
                log.info("[User] Changing password.");
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function logout() {
        log.info("[User] Removing user token.");

        if ($window.localStorage.user) {
            $window.localStorage.removeItem('user');
        }

        _user = {};

        delete $http.defaults.headers.common.authorization;
        delete $http.defaults.headers.post.authorization;
        delete $http.defaults.headers.put.authorization;
        delete $http.defaults.headers.patch.authorization;
        $rootScope.$emit('User.change');
    }

    function getFromStorage() {
        var user = JSON.parse($window.localStorage.user);
        loadFromToken(user.token);
        $rootScope.$emit('User.change');
    }

    // initialization
    function init() {
        // Check if user information is available in local storage
        log.info('Checking for existence of user token.');
        if ($window.localStorage.user) {
            getFromStorage();

        }

        // Watch for changes in other tabs
        angular.element($window).on('storage', function () {
            if ($window.localStorage.user) {
                getFromStorage();
            } else {
                _user = {};
            }
        });
    }

    init();


    return {
        changePassword: changePassword,
        getRole: getRole,
        isLoggedIn: isLoggedIn,
        login: login,
        logout: logout,
        register: register,
        forgot: forgot,
        reset: reset,
        get: getUser,
        goNext:goNext
    };

}]);;
app.constant('countries', [
        "Afghanistan", "Aland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola",
        "Anguilla", "Antarctica", "Antigua And Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria",
        "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
        "Bermuda", "Bhutan", "Bolivia, Plurinational State of", "Bonaire, Sint Eustatius and Saba", "Bosnia and Herzegovina",
        "Botswana", "Bouvet Island", "Brazil",
        "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia",
        "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China",
        "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo",
        "Congo, the Democratic Republic of the", "Cook Islands", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba",
        "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
        "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Falkland Islands (Malvinas)",
        "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia",
        "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece",
        "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea",
        "Guinea-Bissau", "Guyana", "Haiti", "Heard Island and McDonald Islands", "Holy See (Vatican City State)",
        "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran, Islamic Republic of", "Iraq",
        "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya",
        "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan",
        "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
        "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia, The Former Yugoslav Republic Of",
        "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique",
        "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of",
        "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
        "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger",
        "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau",
        "Palestinian Territory, Occupied", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines",
        "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation",
        "Rwanda", "Saint Barthelemy", "Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis", "Saint Lucia",
        "Saint Martin (French Part)", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
        "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
        "Sint Maarten (Dutch Part)", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
        "South Georgia and the South Sandwich Islands", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
        "Svalbard and Jan Mayen", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic",
        "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Timor-Leste",
        "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
        "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
        "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu",
        "Venezuela, Bolivarian Republic of", "Viet Nam", "Virgin Islands, British", "Virgin Islands, U.S.",
        "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"
    ]);
;
app.factory('geoHelperService', [ function () {
    /**
     * Calculates the ending location given a lat lon pair, bearing and distance.
     * @param latlon
     * @param bearing in degrees
     * @param distance in km
     * @returns {*[]}
     */
    function destination(latlon, bearing, distance) {
        var R = 6378.1, lat, lon, latDest, lonDest;

        if (typeof latlon !== 'array'){
            latlon = [latlon.lat, latlon.lng];
        }

        // check values
        if (distance <= 0.010 || bearing === -1) {
            return [latlon[0], latlon[1]];
        }

        // convert to radians
        lat = latlon[0] * (Math.PI / 180);
        lon = latlon[1] * (Math.PI / 180);
        bearing = bearing * (Math.PI / 180);

        latDest = Math.asin(Math.sin(lat) * Math.cos(distance / R) +
            Math.cos(lat) * Math.sin(distance / R) * Math.cos(bearing));

        lonDest = lon + Math.atan2(Math.sin(bearing) * Math.sin(distance / R) * Math.cos(lat),
                Math.cos(distance / R) - Math.sin(lat) * Math.sin(latDest));

        return [latDest * (180 / Math.PI), lonDest * (180 / Math.PI)];
    }

    return {
        destination: destination
    };
}]);
;
app.service('log', ['$log', '$timeout', function ($log, $timeout) {
    var _log = [];
    var _prefix = '[GFSAD] ';

    var save = function (message) {
        _log.push({date: Date.now(), message: message});
    };

    this.info = function (message, log) {
        $log.info(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.warn = function (message, log) {
        $log.warn(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.error = function (message, log) {
        $log.error(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.debug = function (message) {
        $log.debug(_prefix + message);
    };
    this.getLog = function () {
        return _log;
    };
}]);
;
app.factory('mapService', ['leafletLayers', function (leafletLayers) {
    leafletLayers.set('google', {
        createLayer: function (params) {
            var type;
            type = params.type || 'SATELLITE';

            return new L.Google(type, params.options);
        }
    });

    var map = {
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        layers: {
            baselayers: {
                googleHybrid: {
                    name: 'Satellite',
                    params: {
                        type: 'HYBRID'
                    },
                    type: 'google',
                    visible: true
                },
                googleTerrain: {
                    name: 'Terrain',
                    params: {
                        type: 'TERRAIN'
                    },
                    type: 'google',
                    visible: false
                },
                googleRoadmap: {
                    name: 'Streets',
                    params: {
                        type: 'ROADMAP'
                    },
                    type: 'google',
                    visible: false
                }
            },
            overlays: {
                Global_1000m_L3_v20150101: {
                    name: 'Global GCE 1km Multi-study Cropland Mask Product',
                    visible: false,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc'
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=Global_1000m_L3_v20150101&band={band}'
                    },
                    legend: [
                        {label: 'Croplands, Irrigation major', color: '#FF00FF'},
                        {label: 'Croplands, Irrigation minor', color: '#00FF00'},
                        {label: 'Croplands, Rainfed', color: '#FFFF00'},
                        {label: 'Croplands, Rainfed minor fragments', color: '#00FFFF'},
                        {label: 'Croplands, Rainfed very minor fragments', color: '#D2B58C'}
                    ],
                    attribution: '<a href="http://geography.wr.usgs.gov/science/app/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>',
                },
                Global_1000m_L4_v20120101: {
                    name: 'Global GCE 1km Cropland Dominance and Other Products',
                    visible: false,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc'
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=Global_1000m_L4_v20120101&band={band}'
                    },
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
                    ],
                    attribution: '<a href="https://powellcenter.usgs.gov/globalcroplandwater/sites/default/files/August%20HLA-final-1q-high-res.pdf">Thenkabail et al., 2012</a>',
                },
                SouthAsia_250m_L4_v20151201: {
                    name: 'South Asia 250m Croplands 2010-2011 from ACCA',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(37.0985, 60.895), L.latLng(6.006, 97.416))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=SouthAsia_250m_L4_v20151201&band={band}'
                    },
                    legend: [
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
                UnitedStates_250m_L5_v20160101: {
                    name: 'United States GCE 250m Croplands 2008 from ACCA',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(49.4043, -124.5835), L.latLng(24.5025008881642, -66.8524020590759))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=UnitedStates_250m_L5_v20160101&band={band}'
                    },
                    legend: [
                        {label: 'Corn-Soybean', color: '#FFFF00'},//1
                        {label: 'Wheat-Barley', color: '#FF0000'},//2
                        {label: 'Potato', color: '#663300'},//3
                        {label: 'Alfalfa', color: '#00FF00'},//4
                        {label: 'Cotton', color: '#00FFFF'},//5
                        {label: 'Rice', color: '#0000FF'},//6
                        {label: 'Other Crops', color: '#FF6600'}//7
                    ]
                },
                SouthAmerica_30m_L1_v20160101: {
                    name: 'South America 30m Cropland Extent Product 2014',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(12.835778465638036, -81.95811941094321), L.latLng(-56.073447989999984, -31.449983235209473))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=SouthAmerica_30m_L1_v20160101&band={band}'
                    },
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]
                },
                SouthEastAsia_30m_L1_v20160808: {
                    name: 'South East Asia 30m Cropland Extent Product 2014',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc',
//                            bounds: L.latLngBounds(L.latLng(12.835778465638036, -81.95811941094321), L.latLng(-56.073447989999984, -31.449983235209473))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=SouthEastAsia_30m_L1_v20160808&band={band}'
                    },
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]
                },
                Australia_30m_L1_v20160601: {
                    name: 'Australia 30m Cropland Extent Product 2014',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(-9.83464522447101, 110.000125), L.latLng(-45.00754522447101, 158.961625))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=Australia_30m_L1_v20160601&band={band}'
                    },
                    legend: [
                        {label: 'Croplands', color: '#FFFF00'},
                        {label: 'Pasture', color: '#66FFFF'}
                    ]
                },
                Australia_250m_L3_v20160701: {
                    name: 'Australia 250m Cropland Products 2000 to Present from ACCA',
                    visible: false,
                    type: 'xyz',
                    params: {
                        options: {
                            year: 2015,
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(-9.83464522447101, 110.000125), L.latLng(-45.00754522447101, 158.961625))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=Australia_250m_L3_v20160701&band={band}&year={year}'
                    },
                    legend: [
//                        {label: '0 Not Croplands', color: '#000000'},
                        {label: 'Croplands, rainfed, SC (Season 1 & 2), all crops', color: '#FFFF00'},
                        {label: 'Croplands, rainfed, SC, pastures', color: '#66FFFF'},
                        {label: 'Croplands, irrigated, SC, DC (Season 1 & 2), all crops', color: '#FF66FF'},
                        {label: 'Croplands, irrigated, SC, pastures', color: '#00B0F0'},
                        {label: 'Croplands, irrigated, continuous, orchards ', color: '#00B050'},
                        {label: 'Croplands,  fallow ', color: '#FBD4B4'}
                    ],
                    years: [2000,2001,2002,2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,2015]
                },
                Europe_30m_L1_v20160725: {
                    name: 'Europe 30m Cropland Extent Product 2014',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc'
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&id=Europe_30m_L1_v20160725&band={band}'
                    },
                    legend: [
                        {label: 'Cropland', color: '#00FF00'}
                    ]

                },
                Africa_30m_L1_v20160401: {
                    name: 'Africa 30m Cropland Extent Product 2014',
                    visible: true,
                    type: 'xyz',
                    params: {
                        options: {
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(37.3494, -25.3695), L.latLng(-34.83026000000001, 63.50536000000001))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&band={band}&id=Africa_30m_L1_v20160401'
                    },
                    legend: [
                        {label: 'Croplands', color: '#00FF00'}
                    ]
                },
                Africa_250m_L2_v20160601: {
                    name: 'Africa GCE 250m Cropland Products 2003 to 2014 from ACCA',
                    visible: false,
                    type: 'xyz',
                    params: {
                        options: {
                            year: 2014,
                            band: 'class',
                            subdomains: 'abc',
                            bounds: L.latLngBounds(L.latLng(37.3494, -25.3695), L.latLng(-34.83026000000001, 63.50536000000001))
                        },
                        url: '//{s}.tiles.croplands.org/{z}/{x}/{y}/tile.png?collection=users/JustinPoehnelt/products&band={band}&id=Africa_250m_L2_v20160601&year={year}'
                    },
                    years: [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
                    legend: [
                        {label: 'Irrigated, SC, season 2', color: '#e41a1c'},
                        {label: 'Irrigated, SC, season 1', color: '#8dd3c7'},
                        {label: 'Irrigated, DC', color: '#377eb8'},
                        {label: 'Irrigated, Continuous', color: '#4daf4a'},
                        {label: 'Rainfed, SC, season 2', color: '#984ea3'},
                        {label: 'Rainfed, SC, season 1', color: '#bebada'},
                        {label: 'Rainfed, DC', color: '#ff7f00'},
                        {label: 'Rainfed, Continuous', color: '#ffff33'},
                        {label: 'Fallow-lands', color: '#e2e2e2'},
                        {label: 'Not Cropland', color: '#000000'}
                    ]
                }
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
}])
;;
app.factory('mappings', [function () {
    var data = {
        land_use_type: {'label': 'Land Use Type',
            'style': 'primary',
            'choices': [
                {'id': 0, 'order': 8, 'label': 'Unknown', 'description': 'Not cropland is...'},
                {'id': 1, 'order': 1, 'label': 'Cropland', 'description': 'Cropland is...'},
                {'id': 2, 'order': 4, 'label': 'Forest', 'description': 'Forest is ...'},
                {'id': 3, 'order': 3, 'label': 'Grassland', 'description': 'Grassland is ...'},
                {'id': 4, 'order': 2, 'label': 'Barren', 'description': 'Barrenland is ...'},
                {'id': 5, 'order': 6, 'label': 'Builtup', 'description': 'Urban is ...'},
                {'id': 6, 'order': 5, 'label': 'Shrub', 'description': 'Shrub is ...'},
                {'id': 7, 'order': 7, 'label': 'Water', 'description': 'Water is ...'}
            ]},

        water: {'label': 'Water Source',
            'style': 'danger',
            'choices': [
                {'id': 0, 'label': 'Unknown', 'description': 'No irrigation specified...'},
                {'id': 1, 'label': 'Rainfed',
                    'description': 'Rainfed is ...'},
                {'id': 2, 'label': 'Irrigated',
                    'description': 'Irrigated is ...'}
            ]
        },
        intensity: {'label': 'Intensify of Cropping',
            'style': 'success',
            'choices': [
                {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
                {'id': 1, 'label': 'Single', 'description': 'Single is...'},
                {'id': 2, 'label': 'Double', 'description': 'Double is...'},
                {'id': 3, 'label': 'Triple', 'description': 'Triple is...'},
                {'id': 4, 'label': 'Continuous', 'description': 'Continuous is...'}
            ]
        },
        crop_primary: {'label': 'Crop Type',
            'choices': [
                {'id': 0, 'label': 'Unknown', 'description': 'No crop type specified.'},
                {'id': 1, 'label': 'Wheat', 'description': ''},
                {'id': 2, 'label': 'Maize (Corn)', 'description': ''},
                {'id': 3, 'label': 'Rice', 'description': ''},
                {'id': 4, 'label': 'Barley', 'description': ''},
                {'id': 5, 'label': 'Soybeans', 'description': ''},
                {'id': 6, 'label': 'Pulses', 'description': ''},
                {'id': 7, 'label': 'Cotton', 'description': ''},
                {'id': 8, 'label': 'Potatoes', 'description': ''},
                {'id': 9, 'label': 'Alfalfa', 'description': ''},
                {'id': 10, 'label': 'Sorghum', 'description': ''},
                {'id': 11, 'label': 'Millet', 'description': ''},
                {'id': 12, 'label': 'Sunflower', 'description': ''},
                {'id': 13, 'label': 'Rye', 'description': ''},
                {'id': 14, 'label': 'Rapeseed or Canola', 'description': ''},
                {'id': 15, 'label': 'Sugarcane', 'description': ''},
                {'id': 16, 'label': 'Groundnuts or Peanuts', 'description': ''},
                {'id': 17, 'label': 'Cassava', 'description': ''},
                {'id': 18, 'label': 'Sugarbeets', 'description': ''},
                {'id': 19, 'label': 'Palm', 'description': ''},
                {'id': 20, 'label': 'Others', 'description': ''},
                {'id': 21, 'label': 'Plantations', 'description': 'Plantations or other continuous crops'},
                {'id': 22, 'label': 'Fallow', 'description': ''},
                {'id': 23, 'label': 'Tef', 'description': ''},
                {'id': 24, 'label': 'Pasture', 'description': 'May be managed'},
                {'id': 25, 'label': 'Oats', 'description': ''}
            ]
        },
        lat: {
            'label': 'Latitude'
        },
        lon: {
            'label': 'Longitude'
        },
        source_type: {
            'label': 'Source of Data',
            choices: [
                {'id': 'ground', 'label': 'Ground'},
                {'id': 'unknown', 'label': 'Unknown'},
                {'id': 'derived', 'label': 'Derived'}
            ]
        },
        user_validation: {'label': 'Validation Only',
            'style': 'success',
            'choices': [
                {'id': 0, 'label': 'Training', 'description': 'Data is used for training.'},
                {'id': 1, 'label': 'Validation', 'description': 'Data is used for validation.'}
            ]
        },
        year: {
            label: "Year",
            choices: []
        }
    };

    // use same mapping for secondary and tertiary
    data.crop_secondary = angular.copy(data.crop_primary);
    data.crop_tertiary = angular.copy(data.crop_primary);


    var currentYear = new Date().getFullYear();
    for (var i = 2000; i < currentYear + 1; i++) {
        data.year.choices.push({label: i, id: i});
    }

    return data;
}]);;
app.filter('mappings', ['mappings', function (mappings) {
    return function (key, field) {
        key = key || 0;
        try {
            return mappings[field].choices[key].label;
        } catch(e) {
            return key;
        }
    };
}]);;
app.filter('monthName', [function () {
    return function (monthNumber) { //1 = January
        var monthNames = [ 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December' ];
        return monthNames[monthNumber - 1];
    };
}]);;
app.filter('prepend', [function () {
    return function (key, field) {
        return field + key;
    };
}]);;
app.filter('unsafe', ['$sce', function($sce) {
    return function(val) {
        return $sce.trustAsHtml(val);
    };
}]);;
app.controller("AccountFormController", ['$location', '$scope', 'log', '$window', function ($location, $scope, log, $window) {
    var path = $location.path().split('/');
    if (path[1] === 'account' && path[1]) {
        $scope.$emit('user.' + path[2], true);
    } else {
        $window.location.href = '/';
    }

}]);;
app.controller("ClassifyController", ['$scope', 'mapService', 'mappings', '$http', 'leafletData', '$document', 'log', '$timeout', 'server', 'User', function ($scope, mapService, mappings, $http, leafletData, $document, log, $timeout, server, User) {
    var page = 1, minimumMapCircle, minimumMapBox, currentImageOverlay, lastClassification = new Date();

    // Apply defaults
    angular.extend($scope, {
        counter: 0,
        center: {lat: 0, lng: 0, zoom: 2},
        images: [],
        opacity: 1,
        markers: {
            image: {
                layer: 'markers',
                lat: 0,
                lng: 0
            }
        },
        layers: {
            baselayers: {
                googleHybrid: angular.copy(mapService.layers.baselayers.googleHybrid)
            },
            overlays: {
                markers: {
                    type: 'group',
                    name: 'markers',
                    visible: true
                }
            }
        },
        paths: {},
        buttons: [
            {'id': 1, 'label': 'Pure Cropland', 'description': 'Cropland is...', buttonClass: 'pure-cropland'},
            {'id': 2, 'label': 'Mixed Cropland', 'description': 'Mixed is ...', buttonClass: 'mixed-cropland'},
            {'id': 0, 'label': 'Not Cropland', 'description': 'Not cropland is...', buttonClass: 'not-cropland'},
            {'id': 3, 'label': 'Maybe Cropland', 'description': 'Not cropland is...', buttonClass: 'Maybe Cropland'},
            {'id': -1, 'label': 'Reject', 'description': 'Reject is ...', buttonClass: 'btn-default'}
        ]
    });

//    leafletData.getMap('map').then(function (map) {
//        $scope.map = map;
//        L.circle([$scope.center.lng, $scope.center.lat], 10000).addTo(map);
//
//    });

    function setMinimumMapBounds(lon, lat) {
        var bounds = L.circle({lng: lon, lat: lat}, 45).getBounds();
        leafletData.getMap('map').then(function (map) {
            if (minimumMapBox) {
                map.removeLayer(minimumMapBox);
            }
            minimumMapBox = L.imageOverlay('/static/imgs/minimumMapUnit.png', bounds);
            minimumMapBox.addTo(map);
        });
    }

    function getMoreImages(page) {
        var filters = [
            {"name": "source", "op": "eq", "val": "VHRI"}
        ], order_by = [
            {"field": "classifications_count", "direction": "asc"},
            {"field": "date_uploaded", "direction": "desc"}
        ], params = {};


        params.q = JSON.stringify({"order_by": order_by, "filters": filters});
        params.page = 1;
        params.results_per_page = 100;
        params.random = Date.now().toString();
        console.log(params);


        $http.get(server.address + '/api/images', {params: params}).then(function (response) {
            $scope.images = $scope.images.concat(response.data.objects);
//            max_pages = response.data.total_pages;
        });
    }

    function drawImage() {
        var map = leafletData.getMap('map'),
            currentBounds;

        if (minimumMapBox) {
            map.removeLayer(minimumMapBox);
        }

        if (minimumMapCircle) {
            map.removeLayer(minimumMapCircle);
        }

        if (currentImageOverlay) {
            map.removeLayer(currentImageOverlay);
        }

        currentBounds = [
            [$scope.image.corner_ne_lat, $scope.image.corner_ne_lon],
            [$scope.image.corner_sw_lat, $scope.image.corner_sw_lon]
        ];

        currentImageOverlay = L.imageOverlay('https://images.croplands.org/' + $scope.image.url, currentBounds, {opacity: $scope.opacity});
        currentImageOverlay.addTo(map);

        // create 90m box
        minimumMapCircle = L.circle({lng: $scope.image.location.lon, lat: $scope.image.location.lat}, {
            color: '#ff0000',
            radius: 45,
            fillOpacity: 0
        }).addTo(map);
    }

    function getImage() {
        // Function gets the next image from the array and moves the center of the map
        if ($scope.images.length > 0) {

            // Get next image and remove from array
            $scope.image = $scope.images[0];
            $scope.images = _.slice($scope.images, 1);

            $scope.image.url = $scope.image.url.replace('images/', '');

            // Get coordinates of location and adjust maps
            $scope.center.lat = $scope.image.location.lat;
            $scope.center.lng = $scope.image.location.lon;
            $scope.center.zoom = 17;


            // preload
            if ($scope.counter) {
                if ($scope.images[15]) {
                    var img = new Image();
                    img.src = 'https://images.croplands.org/' + $scope.images[15].url.replace('images/', '');
                }
            } else {
                for (var i = 0; i < 15; i++) {
                    if ($scope.images[i]) {
                        var img = new Image();
                        img.src = 'https://images.croplands.org/' + $scope.images[i].url.replace('images/', '');
                    }
                }
            }

            $scope.opacity = 1;


            drawImage();
        }
    }

    // watch the number of images to classify and call function to get more as neccesary
    $scope.$watch(function () {
        return $scope.images.length;
    }, function (l, previous) {
        // first page
        if (previous === 0 && l > 0) {
            getImage();
        }
        // get next page
        if (l === 10) {
            getMoreImages();
        }
    });

    $scope.skip = function () {
        // User chooses not to classify image.
        getImage();
    };

    $scope.classify = function (classification_type) {
        var now = new Date();

        // slow em down
        if (lastClassification && (now - lastClassification) < 500) {
            return;
        } else {
            lastClassification = now;
        }

        // precondition that a classification type is defined
        if (classification_type !== undefined) {
            var data = {
                "classification": classification_type,
                "image": angular.copy($scope.image.id)
            };

            // post to api
            $http.post('https://api.croplands.org/api/image_classifications', data).then(function () {
                $scope.counter++;
            });
        }
        // go to the next image
        getImage();
    };

    $document.bind("keypress", function (event) {
        console.debug(event);
        switch (event.keyCode) {
            case 115:
                log.info("[ClassifyControler] Skip Image Shortcut");
                getImage();
                $scope.action = 's';
                break;
            case 99:
                log.info("[ClassifyControler] Pure Cropland Shortcut");
                $scope.classify(1);
                $scope.action = 1;
                break;
            case 101:
                log.info("[ClassifyControler] Mixed Cropland Shortcut");
                $scope.classify(2);
                $scope.action = 2;
                break;
            case 102:
                log.info("[ClassifyControler] Zoom Out Shortcut");
                $scope.center.zoom--;
                $scope.$apply();
                break;
            case 103:
                log.info("[ClassifyControler] Zoom Out Shortcut");
                $scope.center.zoom++;
                $scope.$apply();
                break;
            case 100:
                log.info("[ClassifyControler] Not Cropland Shortcut");
                $scope.classify(0);
                $scope.action = 0;
                break;
            case 114:
                log.info("[ClassifyControler] Reject Shortcut");
                $scope.classify(-1);
                $scope.action = -1;
                break;
            case 113:
                log.info("[ClassifyController] Maybe Cropland Shortcut");
                $scope.classify(3);
                $scope.action = 3;
                break;
            case 118:
                log.info("[ClassifyControler] Toggle Shortcut");
                if ($scope.opacity > 0) {
                    $scope.opacity = 0;
                } else {
                    $scope.opacity = 1;
                }
                drawImage();

                break;
        }

        $timeout(function () {
            delete $scope.action;
        }, 500);

    });


    $scope.$watch(User.getRole, function (role) {
        $scope.role = role;
    });

    $scope.showValidation = function () {
        return $scope.role === 'admin' || $scope.role === 'validation';
    };

    getMoreImages(1);

}]);;
app.controller("DataController", ['$scope', '$http', 'mapService', 'leafletData', function ($scope, $http, mapService, leafletData) {
    var leafletMap;

    angular.extend($scope, {
        sumCropType: 0,
        center: mapService.center,
        layers: mapService.layers,
        geojson: {},
        sort: {
            column: 'properties.crop_type',
            reverse: true
        },
        sortColumn: function (column) {
            console.log(column);

            if ($scope.sort.column === column) {
                $scope.sort.reverse = !$scope.sort.reverse;
            } else {
                $scope.sort.column = column;
                $scope.sort.reverse = false;
            }

            console.log($scope.sort);
        },
        moveToCountry: function (bounds) {
            leafletMap.fitBounds(bounds.pad(0.2));
        },
        goalFillAmount: function () {
            return 896 * (0.1 + $scope.sumCropType / 500000);
        }
    });

    _.each($scope.layers.overlays, function (layer) {
        layer.visible = false;
    });


    function getColor(properties) {

        if (properties.cultivated_area_hectares === 0) {
            return 'black';
        }

        if (properties.crop_type === 0) {
            return 'red';
        }


        var color, ratio, scale, red, green, blue;

        ratio = properties.ratio * 10;
        scale = Math.max(Math.min((ratio - 500) / 50000, 1), 0);

        red = Math.round(255 * scale);
        green = Math.round(255 * (1 - scale));

        blue = 0;

        color = '#'
            + ("00" + red.toString(16)).slice(-2)
            + ("00" + green.toString(16)).slice(-2)
            + ("00" + blue.toString(16)).slice(-2);
//        console.log('ratio', ratio, scale, color);
        return color;

    }

    $http.get('https://s3.amazonaws.com/gfsad30/public/json/reference_data_coverage.json').then(function (response) {
        _.each(response.data.features, function (feature) {
            $scope.sumCropType += feature.properties.crop_type;
            feature.properties.cultivated_area_km2 = parseInt(feature.properties.cultivated_area_hectares / 100, 10);
            feature.properties.ratio = feature.properties.cultivated_area_km2 / feature.properties.crop_type;
            feature.properties.visible = true;
        });

        $scope.countries = response.data.features;

        var map = leafletData.getMap();
        leafletMap = map;

        L.geoJson(response.data.features, {
            style: function (feature) {
                return {
                    weight: 2,
                    opacity: 0.8,
                    fillColor: getColor(feature.properties),
                    color: 'white',
                    dashArray: '3',
                    fillOpacity: 0.6
                };
            },
            onEachFeature: function (feature, layer) {
                feature.properties.bounds = layer.getBounds();
            }
        }).addTo(map);
    }, function (err) {
        console.log(err);
    });

    $scope.$watch('center', function () {
        if (leafletMap === undefined) {
            return;
        }

        var currentMapBounds = leafletMap.getBounds().pad(0.50);

        _.each($scope.countries, function (country) {
            country.properties.visible = currentMapBounds.contains(country.properties.bounds);
        });
    });


}]);;
app.controller("DataRecordController", ['$scope', 'mapService', 'leafletData', '$location', 'DataRecord', '$q', 'geoHelperService', function ($scope, mapService, leafletData, $location, DataRecord, $q, geoHelperService) {
    var gridImageURL = "/static/imgs/icons/grid.png",
        shapes = {};

    angular.extend($scope, {
        id: $location.search().id,
        paging: {
            hasNext: DataRecord.paging.hasNext,
            hasPrevious: DataRecord.paging.hasPrevious,
            next: DataRecord.paging.next,
            previous: DataRecord.paging.previous
        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        layers: angular.copy(mapService.layers),
        markers: {},
        events: {
            map: {
                enable: [],
                logic: 'emit'
            }
        }
    });

    _.each($scope.layers.overlays, function (layer) {
        layer.visible = false;
    });

    function buildShapes() {
        var bearingDistance = 0,
            bearingSpread = 7.5,
            record = $scope.record,
            latlng = {
                lat: record.location.lat,
                lng: record.location.lon
            },
            originalLatlng = {
                lat: record.location.original_lat,
                lng: record.location.original_lon
            };

        leafletData.getMap('recordMap').then(function (map) {
            _.forOwn(shapes, function (shape) {
                map.removeLayer(shape);
            });
            shapes = {};            var circle250 = L.circle(latlng, 125);
            shapes.locationAreaGrid = L.imageOverlay(gridImageURL, circle250.getBounds());

            shapes.locationMarker = L.marker(latlng, {
                zIndexOffset: 1000,
                draggable: false
            });

//            shapes.locationMarker.on('dragend', function (event) {
//                log.info('[Location] Dragged marker: ' + event.distance + ' meters');
//                scope.buildGrid(shapes.locationMarker.getLatLng());
//                latLng = shapes.locationMarker.getLatLng();
//                scope.location.lat = latLng.lat;
//                scope.location.lon = latLng.lng;
//            });

            if (record.location.distance !== undefined) {
                bearingDistance = record.location.distance / 1000;
            }

            if (record.location.bearing) {
                shapes.polygon = L.polygon([
                    originalLatlng,
                    geoHelperService.destination(originalLatlng, record.location.bearing - bearingSpread, bearingDistance),
                    geoHelperService.destination(originalLatlng, record.location.bearing + bearingSpread, bearingDistance)
                ], {
                    color: '#00FF00',
                    stroke: false
                });
            }
            _.forOwn(shapes, function (shape) {
                shape.addTo(map);
            });

        }, function (e) {
            console.log(e);
        });
    }

    $scope.imageURL = function (url) {
        return "https://images.croplands.org/" + url.replace("images/", "");
    };

    DataRecord.get($scope.id).then(function (record) {
        $scope.record = record;
//        $scope.history = _.map(record.history, function (state) {
//            state = angular.fromJson(state);
//            state.date_edited = new Date(state.date_edited);
//            state.data = angular.fromJson(state.data);
//            return state;
//        });
        $scope.center.lat = record.location.lat;
        $scope.center.lng = record.location.lon;
        $scope.center.zoom = 17;
        buildShapes();
    }, function (e) {
        console.log(e);
    });
}]);;
app.controller("DataSearchController", ['$scope', '$http', 'mapService', 'leafletData', '$location', 'DataService', 'DataRecord', 'leafletData', 'server', function ($scope, $http, mapService, leafletData, $location, DataService, DataRecord, leafletData, server) {

    angular.extend($scope, {
        tableColumns: [
            {
                id: 'id',
                label: 'ID',
                visible: false
            },
            {
                id: 'lon',
                label: 'Longitude',
                visible: false
            },
            {
                id: 'lat',
                label: 'Latitude',
                visible: false
            },
            {
                id: 'land_use_type',
                label: 'Land Use',
                visible: true
            },
            {
                id: 'crop_primary',
                label: 'Primary Crop',
                visible: true
            },
            {
                id: 'crop_secondary',
                label: 'Secondary Crop',
                visible: false
            },
            {
                id: 'crop_tertiary',
                label: 'Tertiary Crop',
                visible: false
            },
            {
                id: 'water',
                label: 'Irrigation',
                visible: true
            },
            {
                id: 'intensity',
                label: 'Intensity',
                visible: true
            },
            {
                id: 'year',
                label: 'Year',
                visible: true
            },
            {
                id: 'month',
                label: 'Month',
                visible: false
            },
            {
                id: 'country',
                label: 'Country',
                visible: true
            },
            {
                id: 'source_type',
                label: 'Source Type',
                visible: true
            },
            {
                id: 'source_class',
                label: 'Source Class',
                visible: false
            },
            {
                id: 'source_description',
                label: 'Source Description',
                visible: false
            },
            {
                id: 'use_validation',
                label: 'Validation',
                visible: false
            }
        ],
        ordering: DataService.ordering,
        busy: true,
        bounds: {
            southWest: {
                lat: -90,
                lng: -180
            },
            northEast: {
                lat: 90,
                lng: 180
            }

        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        searchInMap: false,
        layers: angular.copy(mapService.layers),
        markers: {},
        events: {
            map: {
                enable: [],
                logic: 'emit'
            }
        }
    });

    _.each($scope.layers.overlays, function (layer) {
        layer.visible = false;
    });


    ////////// Helpers //////////
    function init() {
        if (DataService.is_initialized) {
            $scope.records = DataService.records;
            $scope.markers = buildMarkers($scope.records);
            $scope.ndvi = getNDVI(DataService.getParams());
            $scope.busy = false;
            $scope.count = DataService.count;
            $scope.percentage = $scope.count.filtered / $scope.count.total * 100;
        } else {
            applyParams($location.search());
            DataService.load();
        }

//        if (DataService.bounds) {
//            $scope.bounds = DataService.bounds;
//            $timeout(function(){
//                var map = leafletData.getMap('searchMap');
//            map.fitBounds([
//                [$scope.bounds.southWest.lat, $scope.bounds.southWest.lng],
//                [$scope.bounds.northEast.lat, $scope.bounds.northEast.lng]
//            ]);
//            $scope.searchInMap = true;
//            },1000)
//
//        }
    }

    function getData() {
        $scope.busy = true;
        $scope.$evalAsync(DataService.load);
    }

    function applyBounds(bounds) {
        if (DataService.bounds !== bounds) {
            DataService.bounds = bounds;
            getData();
        }
    }

    function buildMarkers(rows) {
        var records = {};

        _.each(rows, function (row) {
            records["m_" + row.id.toString()] = {
                lat: parseFloat(row.lat),
                lng: parseFloat(row.lon),
            };
        });
        return records;
    }

    function getNDVI(params) {
        var url = server.address + '/data/image?';
        _.each(params, function (val, key) {
            if (key === 'southWestBounds' || key === 'northEastBounds' || key === 'ndvi_limit_upper' || key === 'ndvi_limit_lower') {
                return;
            }
            if (val.length) {
                _.each(val, function (v) {
                    url += key + "=" + v.toString() + "&";
                });
            }
        });

        if (params.southWestBounds && params.northEastBounds) {
            url += "southWestBounds=" + params.southWestBounds + "&";
            url += "northEastBounds=" + params.northEastBounds + "&";
        }
        if (params.ndvi_limit_upper && params.ndvi_limit_lower) {
            url += "ndvi_limit_upper=" + params.ndvi_limit_upper + "&";
            url += "ndvi_limit_lower=" + params.ndvi_limit_lower + "&";
        }
        return url;
    }

    function applyParams(params) {
        console.log(params);
        _.each(params, function (val, key) {
            if (DataService.columns[key] && key !== 'year' && key !== 'source_type') {
                if (Array.isArray(val)) {
                    _.each(val, function (idx) {
                        DataService.columns[key].choices[parseInt(idx, 10)].selected = true;
                    });
                } else {
                    DataService.columns[key].choices[parseInt(val, 10)].selected = true;
                }
            } else if (key === 'source_type') {
                var mappings = {};

                _.each(DataService.columns.source_type.choices, function (v, i) {
                    mappings[v.id] = i;
                });

                if (Array.isArray(val)) {
                    _.each(val, function (type) {
                        DataService.columns.source_type.choices[mappings[type]].selected = true;
                    });
                } else {
                    DataService.columns.source_type.choices[mappings[val]].selected = true;
                }
            }
            else if (key === 'year') {
                if (Array.isArray(val)) {
                    _.each(val, function (year) {
                        DataService.columns.year.choices[parseInt(year, 10) - 2000].selected = true;
                    });
                } else {
                    DataService.columns.year.choices[parseInt(val, 10) - 2000].selected = true;
                }
            } else if (key === 'southWestBounds') {
                var boundsSouthWest = val.split(',');
                DataService.bounds = {
                    southWest: {},
                    northEast: {}
                };
                DataService.bounds.southWest.lat = boundsSouthWest[0];
                DataService.bounds.southWest.lng = boundsSouthWest[1];
            } else if (key === 'northEastBounds') {
                var boundsNorthEast = val.split(',');
                DataService.bounds.northEast.lat = boundsNorthEast[0];
                DataService.bounds.northEast.lng = boundsNorthEast[1];
            } else if (key === 'page') {
                DataService.paging.page = parseInt(val, 10);
            } else if (key === 'page_size') {
                DataService.paging.page_size = parseInt(val, 10);
            }
            else if (key === 'ndvi_limit_upper') {
                if (!DataService.ndviLimits) {
                    DataService.ndviLimits = {};
                }
                DataService.ndviLimits.upper = val.split(',');
            }
            else if (key === 'ndvi_limit_lower') {
                if (!DataService.ndviLimits) {
                    DataService.ndviLimits = {};
                }
                DataService.ndviLimits.lower = val.split(',');
            }
        });

        console.log(DataService.ndviLimits);
    }

    ////////// End Helpers //////////


    ////////// Methods //////////
    $scope.sortColumn = function (column) {
        if (column === DataService.ordering.order_by) {
            if (DataService.ordering.order_by_direction === 'asc') {
                DataService.ordering.order_by_direction = 'desc';
            } else {
                DataService.ordering.order_by_direction = 'asc';
            }
        } else {
            DataService.ordering.order_by_direction = 'asc';
            DataService.ordering.order_by = column;
        }

        getData();
    };

    $scope.selectColumns = function () {
        console.log('select columns');
    }

    $scope.download = DataService.download;
    $scope.goToRecord = DataRecord.goTo;

    $scope.reset = function () {
        DataService.reset();
        getData();
    };

    $scope.apply = getData;

    $scope.zoomExtent = function () {
        $scope.center.lat = 0;
        $scope.center.lng = 0;
        $scope.center.zoom = 2;
    };

//    $scope.enableTemporalBounds = function () {
//        var svg = angular.element('#temporalProfile').find('svg');
//        console.log(svg);
//
//    };
    ////////// End Methods //////////


    ////////// Events //////////
    $scope.$on("DataService.load", function () {
        $scope.records = DataService.records;
        console.log(DataService.getParams());
        $location.search(DataService.getParams());
        $scope.markers = buildMarkers($scope.records);
        $scope.$evalAsync(function () {
            $scope.busy = false;
        });

        $scope.ndvi = getNDVI(DataService.getParams());
        $scope.count = DataService.count;
        $scope.percentage = $scope.count.filtered / $scope.count.total * 100;
    });

    $scope.$watch('bounds', _.debounce(function () {
        if ($scope.searchInMap) {
            applyBounds($scope.bounds);
        }
    }, 800));

    $scope.$watch('searchInMap', function (val, prev) {
        if (val === prev) {
            return;
        }

        if (val) {
            applyBounds($scope.bounds);
        } else {
            applyBounds(false);
        }
    });

    ////////// End Events //////////

    ////////// Init //////////
    init();
    ////////// Init //////////

}]);;
app.controller("MapController", ['$scope', 'mapService', 'DataService', 'leafletData', '$timeout', '$window', '$location', 'mappings', 'log', function ($scope, mapService, DataService, leafletData, $timeout, $window, $location, mappings, log) {

    ///////////
    // Utils //
    ///////////

    function stopPropagation(e) {
        L.DomEvent.stopPropagation(e);
    }

    $location.moveCenter = function (lat, lng, zoom) {
        this.search(_.merge(this.search(), {lat: Math.round(lat * Math.pow(10, 5)) / Math.pow(10, 5), lng: lng, zoom: zoom}));
    };

    $location.setId = function (id) {
        this.search(_.merge(this.search(), {id: id}));
    };

    $location.removeId = function () {
        this.search(_.omit(this.search(), 'id'));
    };

    $location.getId = function () {
        return parseInt(_.pluck(this.search(), 'id'), 10);
    };

    $location.getCenter = function () {
        var parameters = this.search();
        if (parameters.lat && parameters.lng && parameters.zoom) {
            return {lat: parseFloat(parameters.lat),
                lng: parseFloat(parameters.lng),
                zoom: parseInt(parameters.zoom, 10)
            };
        }
    };

///////////////////////
// Listen for Events //
///////////////////////

    $scope.$watch(function () {
        return mapService.center;
    }, function (center) {
        $scope.center = center;
    }, true);

//    $scope.$watch('center', function (center) {
//        $location.moveCenter(center.lat, center.lng, center.zoom);
//    });

    $scope.$watch('busy', function () {
        if ($scope.busy) {
            $scope.busyDialogVisible = true;
        }
    });


///////////////////////
// Button Actions    //
///////////////////////


    $scope.toggleLayerInfo = function (layer, e) {
        e.preventDefault();
        stopPropagation(e);
        layer.infoVisible = !layer.infoVisible;
    };

    $scope.zoomExtent = function () {
        mapService.center.lat = 0;
        mapService.center.lng = 0;
        mapService.center.zoom = 2;
    };


    $scope.print = function () {
        window.print();
    };


//////////
// Init //
//////////

    function init() {
//        requestFullscreen($("#map-app"));
        var defaults = {
            tableOfContentsVisible: true,
            showHelp: false,
            showDownloadModal: false,
            busy: false,
            busyDialogVisible: false,
            table: {
                visible: false
            },
            center: mapService.center,
            layers: mapService.layers

        };

        // Load Url Parameters if Found
        var center = $location.getCenter();
        if (center && center.lat) {
            mapService.center.lat = center.lat;
        }
        if (center && center.lng) {
            mapService.center.lng = center.lng;
        }
        if (center && center.zoom) {
            mapService.center.zoom = center.zoom;
    }


        // Apply defaults
        angular.extend($scope, defaults);
        console.log($scope);
    }

    init();

}])
;;
app.controller("NavbarController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    $scope.goToLogin = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/login').search({n: n});
    };

    $scope.isLoggedIn = function () {
        return User.isLoggedIn();
    };

    $scope.goToLogout = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    };
}]);;
app.controller("StreetController", ['$scope', 'mapService', 'mappings', '$http', 'leafletData', '$document', 'log', 'geoHelperService', 'server', '$timeout', function ($scope, mapService, mappings, $http, leafletData, $document, log, geoHelperService, server, $timeout) {
    var sv = new google.maps.StreetViewService(),
        panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
            addressControl: false,
            linksControl: false,
            panControl: false,
            enableCloseButton: false,
            fullscreenControl: false
        }),
        map, polygon, circle;

    angular.extend($scope, {
        defaults: {
            zoomControlPosition: 'bottomright'
        },
        center: {lat: 0, lng: 0, zoom: 2},
        layers: {
            baselayers: {
                googleHybrid: angular.copy(mapService.layers.baselayers.googleHybrid)
            },
            overlays: {
                coverage: {
                    type: 'xyz',
                    name: 'Coverage',
                    visible: true,
                    params: {
                        url: '//mts1.googleapis.com/vt?hl=en-US&lyrs=svv|cb_client:apiv3&style=40,18&x={x}&y={y}&z={z}'
                    }
                }
            }
        },
        location: {
            pov: {
                pitch: 0,
                heading: 180
            }
        },
        events: {
            'click': function (e) {
                sv.getPanoramaByLocation(e.latlng, 100, processSVData);
            }
        },
        choices: {
            water: angular.copy(mappings.water.choices),
            crop_primary: angular.copy(mappings.crop_primary.choices),
            land_use_type: angular.copy(mappings.land_use_type.choices)
        },
        record: {
            water: 0,
            crop_primary: 0,
            land_use_type: 0
        }
    });

    $scope.$watch('record.land_use_type', function (type) {
        if (type !== 1) {
            $scope.record.crop_primary = 0;
            $scope.record.water = 0;
        }
    });

    $scope.submit = function () {
        var record = angular.copy($scope.record),
            location = {
                lat: $scope.location.lat,
                lon: $scope.location.lng,
                bearing: $scope.location.pov.heading,
                distance: 75 + ($scope.location.pov.pitch / 700 * 1000),
                records: [],
                images: []
            };

        _.each([90], function (fov) {
            location.images.push({
                "bearing": $scope.location.pov.heading,
                "copyright": "Google",
                "date_acquired": $scope.location.date.toISOString(),
                "date_acquired_earliest": $scope.location.date.toISOString(),
                "date_acquired_latest": $scope.location.date.toISOString(),
                "image_type": "ground",
                "lat": $scope.location.lat,
                "lon": $scope.location.lng,
                "source": "streetview",
                "source_description": "fov: " + fov,
                "url": $scope.staticImg(fov)
            });
        });

        record.year = $scope.location.date.getFullYear();
        record.month = $scope.location.date.getMonth();
        record.source_type = 'streetview';
        location.records.push(record);

        $scope.submitMessage = "Saving data.";
        $http({
            method: 'POST',
            url: server.address + '/api/locations',
            data: location
        }).then(function (response) {
            console.log(response);
            $scope.submitMessage = "Success!";
            $timeout(function () {
                delete $scope.submitMessage;
                $scope.showCaptureForm = false;
            }, 1000);
        }, function (e) {
            $scope.submitMessage = "Something went wrong!";
            $timeout(function () {
                delete $scope.submitMessage;
                $scope.showCaptureForm = false;
            }, 1000);
        });

    };

    $scope.staticImg = function (fov) {
        return "https://maps.googleapis.com/maps/api/streetview?size=600x600&location=" + $scope.location.lat + "," + $scope.location.lng + "&heading=" + $scope.location.pov.heading + "&pitch=" + $scope.location.pov.pitch + "&fov=" + fov;
    };

    function initMap() {

        // Set the initial Street View camera to the center of the map
        sv.getPanoramaByLocation({lat: 37.068888,
            lng: -120.335047}, 50, processSVData);

        panorama.addListener('position_changed', function () {
            var position = panorama.getPosition();
            $scope.location.lat = position.lat();
            $scope.location.lng = position.lng();
            $scope.center.lat = position.lat();
            $scope.center.lng = position.lng();
            $scope.center.zoom = Math.max($scope.center.zoom, 17);
            panorama.setPov($scope.location.pov);
            showDirection();
            $scope.$apply();


            console.log($scope.center);
        });

        panorama.addListener('pov_changed', function () {
            $scope.location.pov = panorama.getPov();
            showDirection();
            $scope.$apply();
        });
    }

    function showDirection() {
        var location = angular.copy($scope.location),
            original = [location.lat, location.lng],
            left, right;

        if (!angular.isDefined(map)) {
            map = leafletData.getMap('map');
        }

        left = geoHelperService.destination(location, (location.pov.heading - 15) % 360, 0.075 + location.pov.pitch / 700);
        right = geoHelperService.destination(location, (location.pov.heading + 15) % 360, 0.075 + location.pov.pitch / 700);

        if (polygon) {
            map.removeLayer(polygon);
        }
        if (circle) {
            map.removeLayer(circle);
        }
        circle = L.circle(original, {fillColor: 'red', color: 'red', fillOpacity: 1, radius: 3}).addTo(map);
        polygon = L.polygon([original, left, right, original], {color: 'red', fillOpacity: 0, dashArray: '1,10'}).addTo(map);

    }

    function processSVData(data, status) {
        if (status === 'OK') {
//            console.log(data);

            $scope.location.date = new Date(data.imageDate);

            panorama.setPano(data.location.pano);
            panorama.setVisible(true);

        } else {
            console.error('Street View data not found for this location.');
        }
    }

    initMap();

}]);;
app.controller("ConfirmController", ['$scope', 'log', function ($scope, log) {
}]);;
app.controller("ForgotController", ['$scope', 'User', function ($scope, User) {
    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.forgot = function () {
        $scope.busy = true;
        User.forgot($scope.email).then(function (response) {
            setMessage(response.description, true);
            $scope.busy = false;
            $scope.email = '';
        }, function (response) {
            if (response.description) {
                setMessage(response.description, false);
            }
            else {
                setMessage('Something went wrong', false);
            }
            $scope.busy = false;
        });
    };
}]);;
app.controller("LoginController", ['$scope', 'log', 'User', '$timeout', '$location', function ($scope, log, User, $timeout, $location) {

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.login = function (valid) {
        $scope.message = null;

        $scope.busy = true;
        if (!valid) {
            setMessage('Invalid Data', false);
            return;
        }
        User.login($scope.email, $scope.password).then(function () {
            setMessage('You have successfully logged in.', true);
            $scope.busy = false;
            $scope.email = '';
            $scope.password = '';
            User.goNext();

        }, function (response) {
            if (response.description) {
                setMessage(response.description, false);
            }
            else {
                setMessage('Something went wrong', false);
            }
            $scope.busy = false;
        });
    };

}]);;
app.controller("LogoutController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    User.logout();
    User.goNext();
}]);;
app.controller("MessagesController", ['$scope', '$window', 'User', function ($scope, $window, User) {
    $scope.active = 0;
    $scope.$watch(function () {
        return User.getMessages();
    }, function (messages) {
        $scope.messages = messages;
    }, true);

    $scope.view = function (m) {
        m.closed = !m.closed;
        m.unread = false;
    };
}]);;
app.controller("RegisterController", ['User', 'countries', '$scope', '$location', 'log', function (User, countries, $scope, $location, log) {

    if (User.isLoggedIn()) {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    }

    angular.extend($scope, {
        countries: countries,
        success: null,
        message: null
    });

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    // Get List of Countries
    $scope.countries = countries;

    $scope.register = function () {
        $scope.busy = true;
        User.register($scope.registration)
            .then(function (response) {
                $scope.busy = false;
                setMessage(response.description, true);
                User.goNext();

            }, function (response) {
                if (response) {
                    setMessage(response.description, false);
                }
                else {
                    setMessage('Something went wrong', false);
                }
                $scope.busy = false;
            });
    };

}]);;
app.controller("ResetController", ['$location', '$scope', '$window', 'User', function ($location, $scope, $window, User) {
    $scope.token = $location.search().token;

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.reset = function () {
        $scope.busy = true;
        User.reset($scope.password, $scope.token).then(function (response) {
            setMessage(response.description, true);
            $scope.busy = false;
            $scope.close();
        }, function (response) {
            if (response.description) {
                setMessage(response.description, false);
            }
            else {
                setMessage('Something went wrong', false);
            }
            $scope.busy = false;
        });
    };

    $scope.close = function () {
        $window.location.href = '/';
    };
}]);;
app.directive('filter', ['log', '$q', '$timeout', 'mappings', 'DataService', function (log, $q, $timeout, mappings, DataService) {
    return {
        restrict: 'EA',
        scope: {
        },
        link: function (scope) {
            angular.extend(scope, {
                    land_use_type: DataService.columns.land_use_type.choices,
                    crop_primary: DataService.columns.crop_primary.choices,
                    water: DataService.columns.water.choices,
                    intensity: DataService.columns.intensity.choices,
                    year: DataService.columns.year.choices,
                    source_type: DataService.columns.source_type.choices,
                    count: DataService.count
                }
            );

            // Scope Methods
            scope.reset = DataService.reset;

            scope.apply = function () {
                scope.$parent.busy = true;
                scope.$evalAsync(DataService.load);
            };

            scope.allOptionsAreSelected = function (field) {
                if (field === undefined) {
                    return false;
                }

                for (var i = 0; i < scope[field].length; i++) {
                    if (!scope[field][i].selected) {
                        return false;
                    }
                }
                return true;
            };

            scope.toggleAllOptions = function (field) {
                var selected = true;
                if (scope.allOptionsAreSelected(field)) {
                    selected = false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    scope[field][i].selected = selected;
                }
            };

            scope.$on("DataService.load", function (e) {
                scope.count = DataService.count;
            });

        },
        templateUrl: '/static/directives/filter.html'
    };
}]);;
app.directive('blur', [function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            element.on('click', function () {
                element.blur();
            });
        }
    };
}]);;
app.directive('legend', [function () {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        templateUrl: '/static/directives/legend.html'
    };
}]);;
app.directive('log', ['log', function (log) {
    return {
        link: function (scope) {
            scope.list = log.getLog();
            scope.$watch(function () {
                return log.getLog();
            }, function (val) {
                scope.list = val;
            }, true);
        },
        templateUrl: '/static/directives/log.html'
    };
}]);
;
app.directive('ndvi', ['$http', '$log', '$q',
    function () {
        return {
            restrict: 'E',
            scope: {
                pts: '=pts'
            },
            link: function (scope) {
                scope.$watch('pts', function () {
                    scope.points = _.map(scope.pts, function (v, i) {
                        var x = i * 52.17, y = 1000 - Math.max(3, Math.min(v, 1000));
                        return x.toString() + ',' + y.toString();
                    }).join(" ");
                });
            },
            templateUrl: '/static/directives/ndvi.html'
        };

    }
]);;
app.directive('passwordConfirm', ['$window', function ($window) {
    var obvious = [];

    return {
        scope: {
            valid: '=valid',
            minEntropy: '=minEntropy',
            password: '=password'
        },
        link: function (scope) {
            if (scope.minEntropy === undefined) {
                scope.minEntropy = 15;
            }

            // init values
            scope.entropy = 0;

            scope.passwordsMatch = function () {
                return scope.password === scope.confirm;
            };

            scope.passwordIsStrong = function () {
                return scope.entropy > scope.minEntropy;
            };

            scope.$watch('password', function (pass) {
                if ($window.zxcvbn === undefined) {
                    scope.entropy = 0;
                    return;
                }

                if (pass && pass.length >= 8) {
                    scope.entropy = zxcvbn(pass, obvious).entropy;
                }
                else {
                    scope.entropy = 0;
                }
            });

            scope.$watch(function () {
                return scope.passwordIsStrong() && scope.passwordsMatch();
            }, function (val) {
                scope.valid = val;
            });
        },
        templateUrl: '/static/directives/password-confirm.html'
    };

}]);
/**
 * Created by justin on 4/13/16.
 */
;
app.directive('pieChart', ['$http', '$log', '$q',
    function () {
        return {
            restrict: 'E',
            scope: {
                value: '=value'
            },
            link: function (scope) {
                var size = 100;
                scope.radius = size / 2;
                scope.background = '#cccccc';

                scope.$watch('value', function (value) {
                    value = parseFloat(value);
                    scope.invalid = isNaN(value);

                    if (scope.invalid) {
                        scope.d = '';
                        return;
                    }

                    value = Math.min(Math.max(value, 0), 100);

                    if (value === 100) {
                        scope.background = '#237c28';
                        scope.d = '';
                        return;
                    }

                    var x = Math.cos((2 * Math.PI) / (100 / value));
                    var y = Math.sin((2 * Math.PI) / (100 / value));

                    //should the arc go the long way round?
                    var longArc = (value <= 50) ? 0 : 1;

                    scope.d = "M" + scope.radius + "," + scope.radius + " L" + scope.radius + ", 0, A" + scope.radius + "," + scope.radius + " 0 " + longArc + ",1 " + (scope.radius + y * scope.radius) + "," + (scope.radius - x * scope.radius) + " z";
                });


            },
            templateUrl: '/static/directives/pieChart.html'
        };

    }
]);
;
app.directive('tableOfContents', ['mapService', 'leafletData', function (mapService, leafletData) {
    return {
        templateUrl: '/static/directives/table-of-contents.html',
        scope: {
            expandBackgroundLayers: '@',
            expandProductLayers: '@',
            expandOtherLayers: '@'
        }, link: function (scope) {
            scope.layers = scope.layers === undefined ? mapService.layers : scope.layers;

            scope.changeBaseLayer = function (id) {
                _.each(scope.layers.baselayers, function (layer, key) {
                    layer.visible = id === key;
                });
            };
        }
    };
}
]);

;
app.directive('tableOfContentsLayer', [function () {
    return {
        templateUrl: '/static/directives/table-of-contents-layer.html',
        scope: {
            layer: '=',
            showMore: '@'
        }, link: function (scope) {
            var layer = scope.layer,
                params = scope.layer.params;

            scope.isMultiYear = scope.layer.years && scope.layer.years.length;

            scope.toggleShowMore = function () {
                if (scope.canShowMore()) {
                    scope.showMore = !scope.showMore;
                }
            };
            scope.canShowMore = function () {
                return true; //scope.layer.legend;
            };

            function init() {
                if (!scope.isMultiYear) {
                    return;
                }
                params.options.year = layer.years[layer.years.length - 1];
            }

            init();

        }
    };
}
]);

;
app.directive('temporalBounds', ['DataService', function (DataService) {
    var bounds = {
        upper: [],
        lower: [],
        max: 0,
        min: 1000,
        init: false
    }, radius = 12;

    return {
        scope: {
        },
        link: function (scope, element, attributes) {
            var svg, activeBoundsInterval, activeBoundsSide, x, y, scale;


            var numIntervals = parseInt(attributes.intervals, 10);
            var intervalWidth = parseFloat(attributes.intervalWidth);
            scope.padding = 20;
            svg = element[0].viewportElement;
            scale = svg.clientWidth / svg.viewBox.baseVal.width;

            function initBounds() {
                if (!bounds.init) {

                    if (DataService.ndviLimits) {
                        for (var i = 0; i < numIntervals; i++) {
                            bounds.upper.push({x: i * intervalWidth + scope.padding, y: 1000 - DataService.ndviLimits.upper[i] + scope.padding, r: radius});
                            bounds.lower.push({x: i * intervalWidth + scope.padding, y: 1000 - DataService.ndviLimits.lower[i] + scope.padding, r: radius});
                        }
                    } else {
                        for (var i = 0; i < numIntervals; i++) {
                            bounds.upper.push({x: i * intervalWidth + scope.padding, y: bounds.max + scope.padding, r: radius});
                            bounds.lower.push({x: i * intervalWidth + scope.padding, y: bounds.min + scope.padding, r: radius});
                        }
                    }

                    bounds.init = true;
                }

                scope.bounds = bounds;
            }

            function limitBounds() {
                _.each(scope.bounds.upper, function (pt) {

                    if (!pt.adjusted || pt.y < bounds.max + scope.padding) {
                        pt.y = bounds.max + scope.padding;
                        pt.adjusted = false;
                    }

                });

                _.each(scope.bounds.lower, function (pt) {
                    if (!pt.adjusted || pt.y > bounds.min + scope.padding) {
                        pt.y = bounds.min + scope.padding;
                        pt.adjusted = false;
                    }
                });
            }

            function mouseMove(e) {
                if (e.stopPropagation) e.stopPropagation();
                if (e.preventDefault) e.preventDefault();

                if (activeBoundsInterval !== null) {
                    scope.bounds[activeBoundsSide][activeBoundsInterval].y = Math.min(Math.max((e.clientY - y) / scale, bounds.max + scope.padding), bounds.min + scope.padding);
                    scope.bounds[activeBoundsSide][activeBoundsInterval].adjusted = true;
                    scope.$apply();
                } else {
                    if (activeBoundsSide === 'max') {
                        scope.bounds.max = Math.min(Math.max((e.clientY - y) / scale, 0), 1000);
                    }
                    if (activeBoundsSide === 'min') {
                        scope.bounds.min = Math.max(Math.min((e.clientY - y) / scale, 1000), 0);
                    }
                    limitBounds();
                    scope.$apply();
                }
            }

            function mouseUp(e) {
                if (activeBoundsSide === 'max' || activeBoundsSide === 'min') {
                    limitBounds();
                }

                DataService.ndviLimits = {
                    upper: _.map(scope.bounds.upper, function (pt) {
                        return Math.round(1000 - pt.y) + scope.padding;
                    }),
                    lower: _.map(scope.bounds.lower, function (pt) {
                        return Math.round(1000 - pt.y) + scope.padding;
                    })
                };

                scope.$apply();

                activeBoundsInterval = null;
                activeBoundsSide = null;
                disableEvents();
            }


            function enableEvents() {
                angular.element(svg).on('mousemove', mouseMove);
                angular.element(svg).on('mouseup', mouseUp);
//                angular.element(svg).on('mouseout', disableEvents);
            }

            function disableEvents() {
                angular.element(svg).off('mousemove', mouseMove);
                angular.element(svg).off('mouseup', mouseUp);
//                angular.element(svg).off('mouseout', disableEvents);
            }

            scope.mouseDown = function (e, index, side) {
                if (e.stopPropagation) e.stopPropagation();
                activeBoundsInterval = index;
                activeBoundsSide = side;

                y = svg.getBoundingClientRect().top;

                enableEvents();
            };

            scope.mouseOver = function (e, index, side) {
                scope.bounds[side][index].r = radius * 2;
            };

            scope.mouseOut = function (e, index, side) {
                scope.bounds[side][index].r = radius;
            };


            scope.selectionPoints = function () {
                var upper = _.map(scope.bounds.upper, function (v) {
                    return v.x.toString() + ',' + v.y.toString();
                });
                var lower = _.map(scope.bounds.lower, function (v) {
                    return v.x.toString() + ',' + v.y.toString();
                });

                return _.concat(upper, lower.reverse()).join(" ");
            };


            initBounds();

        },
        templateUrl: '/static/directives/temporal-bounds.html'
    };
}]);;
app.directive('draggableBounds', ['$document', function ($document) {
    return {
        restrict: 'EA',
        scope: {
            x: '=x',
            y: '=y'
        },
        link: function (scope, element, attributes) {


            angular.extend(scope, {
                radius: 20
            });

            var circle = element[0].children[0];
            circle.attr('cx', scope.x);
            circle.attr('cy', scope.y);

            circle.removeAttr('ng-attr-cx');
            circle.removeAttr('ng-attr-cy');

            var startY, y = angular.copy(scope.y);

            function mouseMove(e){
                y +=  (e.pageY - startY)/4;
                circle.attr('cy', y);
                console.log(element);
            }

            function mouseUp(){
                $document.off('mousemove', mouseMove);
                $document.off('mouseup', mouseUp);
//                scope.y = y;
            }

//            scope.mouseDown = function (e) {
//                e.stopPropagation();
//                $document.on('mousemove', mouseMove);
//                $document.on('mouseup', mouseUp);
//                startY = e.pageY;
//            };

        },
        template: '<circle ng-mousedown="mouseDown($event)" ng-attr-cx="{{ x }}" ng-attr-cy="{{ y }}" ng-attr-r="{{ radius }}" fill="red" />'
    };
}]);