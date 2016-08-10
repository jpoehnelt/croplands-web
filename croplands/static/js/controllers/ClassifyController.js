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

}]);