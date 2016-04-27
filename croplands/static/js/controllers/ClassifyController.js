app.controller("ClassifyController", ['$scope', 'mapService', 'mappings', '$http', 'leafletData', '$document', 'log', '$timeout', 'server', function ($scope, mapService, mappings, $http, leafletData, $document, log, $timeout, server) {
    var page = 1, minimumMapBox, currentImageOverlay;

    // Apply defaults
    angular.extend($scope, {
        counter: 0,
        center: {lat: 0, lng: 0, zoom: 2},
        images: [],
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
            {'id': -1, 'label': 'Reject', 'description': 'Reject is ...', buttonClass: 'btn-default'}
        ]
    });

    leafletData.getMap('map').then(function (map) {
        $scope.map = map;
        L.circle([$scope.center.lng, $scope.center.lat], 10000).addTo(map);

    });

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
        $http.get(server.address + '/api/images?'
            + 'q={"order_by":['
            + '{"field":"classifications_count","direction":"asc"},'
            + '{"field":"date_uploaded","direction":"desc"}'
            + '],"filters":['
//            + '{"name":"classifications_majority_agreement","op":"lt","val":75},'
            + '{"name":"source","op":"eq","val":"VHRI"},'
            + '{"name":"classifications_count","op":"lt","val":5}'
            + ']}'
            + '&page=1'// + String(page)
            + '&results_per_page=100'
            + '&random' + Date.now().toString()).then(function (response) {
            $scope.images = $scope.images.concat(response.data.objects);
//            max_pages = response.data.total_pages;
        });
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
            $scope.center.zoom = 19;

            var currentBounds = [
                [$scope.image.corner_ne_lat, $scope.image.corner_ne_lon],
                [$scope.image.corner_sw_lat, $scope.image.corner_sw_lon]
            ];

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


            leafletData.getMap('map').then(function (map) {
                if (minimumMapBox) {
                    map.removeLayer(minimumMapBox);
                }

                if (currentImageOverlay) {
                    map.removeLayer(currentImageOverlay);
                }

                currentImageOverlay = L.imageOverlay('https://images.croplands.org/' + $scope.image.url, currentBounds);
                currentImageOverlay.addTo(map);

                // create 90m box
                minimumMapBox = L.imageOverlay('/static/imgs/minimumMapUnit.png', L.circle({lng: $scope.image.location.lon, lat: $scope.image.location.lat}, 45).getBounds());
                minimumMapBox.addTo(map);
            });
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
        }

        $timeout(function () {
            delete $scope.action;
        }, 500);

    });


    getMoreImages(1);

}]);