app.controller("ClassifyController", ['$scope', 'mapService', 'mappings', '$http', function ($scope, mapService, mappings, $http) {
    var page = 1, max_pages = 1;

    // Apply defaults
    angular.extend($scope, {
        counter: 0,
        center: {lat: 0, lng: 0, zoom: 15},
        centerWide: {lat: 0, lng: 0, zoom: 3},
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
        buttons: _.sortBy(angular.copy(mappings.landUseType.choices), function (obj) {
            return obj.order; // custom defined orderring per Pardha
        })
    });

    function getMoreImages(page) {
        // Function gets images form the api with specific set of constraints to limit.
        // Gets a page of images
//        $http.get('https://api.croplands.org/api/images?'
//            + 'q={"order_by":[{"field":"date_acquired","direction":"desc"}'
//            + ',{"field":"classifications_count","direction":"asc"}],"filters":['
////            + '{"name":"classifications_majority_agreement","op":"lt","val":75},'
//            + '{"name":"classifications_count","op":"lt","val":30}'
//            + ']}'
//            + '&page=' + String(page)).then(function (response) {
//                $scope.images = $scope.images.concat(response.data.objects);
//                max_pages = response.data.total_pages;
//        });
        $http.get('https://api.croplands.org/api/images?'
            + 'q={"order_by":[{"field":"date_acquired","direction":"desc"}'
            + '],"filters":['
//            + '{"name":"classifications_majority_agreement","op":"lt","val":75},'
            + '{"name":"classifications_count","op":"lt","val":30}'
            + ']}'
            + '&page=' + String(page)).then(function (response) {
                $scope.images = $scope.images.concat(response.data.objects);
                max_pages = response.data.total_pages;
        });
    }

    function getImage() {
        // Function gets the next image from the array and moves the center of the map
        if ($scope.images.length > 0) {

            // Get next image and remove from array
            $scope.image = $scope.images[0];
            $scope.images = _.slice($scope.images, 1);
            console.log($scope.image.url);

            $scope.image.url = $scope.image.url.replace('images/', '');
            // Get coordinates of location and adjust maps
            $scope.center.lat = $scope.image.location.lat;
            $scope.center.lng = $scope.image.location.lon;
            $scope.center.zoom = 15;

            $scope.centerWide.lat = $scope.image.location.lat;
            $scope.centerWide.lng = $scope.image.location.lon;
            $scope.centerWide.zoom = 3;


            // Set marker
            $scope.markers.image.lat = $scope.image.location.lat;
            $scope.markers.image.lng = $scope.image.location.lon;
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
        if (l < 300 && max_pages >= page) {
            getMoreImages(page++);
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

}]);