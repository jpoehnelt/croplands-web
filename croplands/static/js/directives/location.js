app.directive('location', ['locationFactory', 'mappings', 'leafletData', 'icons', 'mapService', 'log', '$q', 'geoHelperService', 'User', function (locationFactory, mappings, leafletData, icons, mapService, log, $q, geoHelperService, User) {
    var activeTab = 'help',
        gridImageURL = "/static/imgs/icons/grid.png", shapes = {};


    return {
        restrict: 'E',
        scope: {
            lat: '=lat',
            lon: '=lon',
            id: '=locationId',
            visible: '=visible'
        },
        link: function (scope) {

            scope.init = function() {
                // reset location data
                scope.location = {};

                // use same tab as before
                scope.activeTab = activeTab;

                // get children elements if id is present and make copy
                if (scope.id && scope.id !== 0) {

                    // Mark panel as busy
                    scope.busy = true;

                    // Get detailed data
                    locationFactory.getLocation(scope.id, function (data) {
                        // Save data plus original to detect changes
                        scope.location = data;
                        scope.copy = angular.copy(scope.location);

                        // Location panel is no longer busy
                        scope.busy = false;

                        // Copy lat lon back for parent etc...
                        scope.lat = data.lat;
                        scope.lon = data.lon;

                        scope.buildShapes([scope.lat, scope.lon], scope.location.points, scope.location.bearing, [scope.location.original_lat, scope.location.original_lon]);
                    });
                } else {
                    // if no id, just save location
                    scope.location.lat = scope.lat;
                    scope.location.lon = scope.lon;
                }

                if (scope.lat && scope.lon) {
                    scope.buildShapes([scope.lat, scope.lon]);
                }
                else {
                    scope.clearShapes();
                }


            };

            scope.clearShapes = function() {
                var deferred = $q.defer();
                // remove various layers from map and delete reference
                leafletData.getMap().then(function (map) {
                    _.forOwn(shapes, function (shape, key) {
                        log.info('[Location] Removing ' + key + ' from map.');
                        map.removeLayer(shape);
                    });
                    shapes = {};
                    deferred.resolve();
                });

                return deferred.promise;
            };

            scope.buildGrid = function(latLng) {
                leafletData.getMap().then(function (map) {
                    try {
                        map.removeLayer(shapes.locationAreaGrid);
                    } catch (e) {
                        log.debug('[Location] Area Grid Does Not Exist');
                    }
                    var circle250 = L.circle(latLng, 125, {fill: false, dashArray: [3, 6], color: '#00FF00'});//
                    shapes.locationAreaGrid = L.imageOverlay(gridImageURL, circle250.getBounds());
                    map.addLayer(shapes.locationAreaGrid);
                });
            };

            scope.buildShapes = function (latLng, points, bearing, originalLatLng) {
                scope.clearShapes().then(function () {

                    scope.buildGrid(latLng);

                    shapes.locationMarker = L.marker(latLng, {icon: new L.icon(icons.iconRedSelected), zIndexOffset: 1000, draggable: true});

                    shapes.locationMarker.on('dragend', function (event) {
                        log.info('[Location] Dragged marker: ' + event.distance + ' meters');
                        scope.buildGrid(shapes.locationMarker.getLatLng());
                        latLng = shapes.locationMarker.getLatLng();
                        scope.location.lat = latLng.lat;
                        scope.location.lon = latLng.lng;
                    });

                    if (bearing && bearing >= 0) {
                        shapes.polygon = L.polygon([originalLatLng, geoHelperService.destination(originalLatLng, bearing - 20, 0.2), geoHelperService.destination(originalLatLng, bearing + 20, 0.2)], {color: '#00FF00', stroke: false, opacity: 0.4});
                    }

                    if (points) {
                        _.each(points, function (pt, i) {
                            var opacity = 0.5 / points.length;
                            opacity = Math.min(opacity * 20 / pt.accuracy, 0.5);
                            shapes["gpsPoint_#" + i] = L.circle([pt.lat, pt.lon], pt.accuracy, {stroke: false, opacity: opacity, fillOpacity: opacity, fill: true, color: '#00FF00'});
                        });

                    }

                    leafletData.getMap().then(function (map) {
                        _.forOwn(shapes, function (shape) {
                            shape.addTo(map);
                        });

                    });
                });
            };

            // add some other values to scope
            angular.extend(scope, {
                mappings: mappings,
                allowedYears: _.range(2000, new Date().getFullYear() + 1),
                allowedMonths: _.range(1, 13),
                busy: false,
                location: {
                    records: []
                }
            });

            // Some methods
            scope.close = function () {
                scope.visible = false;
            };

            scope.changeActiveTab = function (tab) {
                activeTab = tab;
                scope.activeTab = tab;
            };

            scope.addRecordRow = function (e) {
                log.info('Creating new record.', true);
                var d = new Date(),
                    record = {
                        year: d.getFullYear(),
                        month: d.getMonth(),
                        lat: scope.location.lat,
                        lon: scope.location.lon,
                        location_id: scope.location.id,
                        land_use_type: 0,
                        water: 0,
                        intensity: 0,
                        crop_primary: 0,
                        crop_secondary: 0
                    };

                if (scope.id === undefined) {
                    locationFactory.postLocation({lat: scope.lat, lon: scope.lon})
                        .success(function (data) {
                            scope.location = data;
                            scope.id = data.id;
                            record.location_id = data.id;

                            scope.location.records.push(record);
                            scope.$emit('location.record.edit.open', record);

                        }).error(function () {
                            log.info("Something went wrong creating the location.");
                        });
                } else {
                    // append record and open edit
                    scope.location.records.push(record);
                    scope.$emit('location.record.edit.open', record);
                }
            };

            scope.isLoggedIn = function () {
                return User.isLoggedIn;
            };

            scope.canDelete = function () {
                var role = User.getRole(),
                    allowedRole = role === 'mapping' || role === 'validation' || role === 'admin' || role === 'partner';

                return scope.isLoggedIn && allowedRole;
            };

            scope.delete = function () {
                locationFactory.deleteLocation(scope.location);
            };

            scope.save = function () {
                locationFactory.saveLocation(scope.location);
            };

            scope.zoom = function () {
                mapService.zoom(scope.lat, scope.lon, 16);
            };

            // Watch for new location
            scope.$watch(function () {
                    return [scope.lat, scope.lon];
                }, function (position) {
                    console.log(position);
                    scope.init();
                }, true
            );
            scope.$watch('visible', function (visible) {
                if (!visible) {
                    scope.clearShapes();
                }
            });
        },
        templateUrl: '/static/directives/location.html'
    };


}]);
