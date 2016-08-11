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

}]);