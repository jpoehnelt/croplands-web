app.controller("ClassifyController", ['$scope', 'mapService', 'locationFactory', 'leafletData', 'mappings', '$q', '$http', '$timeout', function ($scope, mapService, locationFactory, leafletData, mappings, $q, $http, $timeout) {
    var page = 1, max_pages = 1;

    console.log(mappings.landUseType.choices);

    // Apply defaults
    angular.extend($scope, {
        center: {lat: 0, lng: 0, zoom: 15},
        center_wide: {lat: 0, lng: 0, zoom: 2},
        images: [],
        markers: {},
        markers_wide: {},
        layers: mapService.layers,
        buttons: _.sortBy(angular.copy(mappings.landUseType.choices), function (obj) {
            return obj.order;
        })
    });

    console.log($scope.buttons);

    $scope.$watch(function () {
        return $scope.images.length;
    }, function (l, previous) {
        if (previous === 0 && l > 0) {
            getImage();
        }
        if (l < 300 && max_pages >= page) {
            console.log($scope.images.length);
            getMoreImages(page++);
        }
    });

    function getMoreImages(page) {
        // Gets a page of images and shuffles the images all of the images
        $http.get('https://api.croplands.org/api/images?'
            + 'q={"order_by":[{"field":"classifications_count","direction":"asc"}],"filters":['
            + '{"name":"image_type","op":"like","val":"%Color%"},'
            + '{"name":"classifications_majority_agreement","op":"lt","val":75},'
            + '{"name":"classifications_count","op":"lt","val":30}]}&page=' + String(page)).then(function (response) {
            $scope.images = $scope.images.concat(response.data.objects);
            max_pages = response.data.total_pages;
        });
    }

    function getImage() {
        if ($scope.images.length > 0) {

            // Get next image and remove from array
            $scope.image = $scope.images.pop();
            $scope.image.url = _.trimLeft($scope.image.url, 'images/');

            // Get coordinates of location
            $scope.center.lat = $scope.image.location.lat;
            $scope.center.lng = $scope.image.location.lon;
            $scope.center.zoom = 15;

            $scope.center_wide.lat = $scope.image.location.lat;
            $scope.center_wide.lng = $scope.image.location.lon;

            // Set marker
            $scope.markers.image = {
                lat: $scope.image.location.lat,
                lng: $scope.image.location.lon
            };
            $scope.markers_wide.image = {
                lat: $scope.image.location.lat,
                lng: $scope.image.location.lon
            };
        }
    }

    $scope.skip = function () {
        getImage();
    };

    $scope.classify = function (i) {
        if (i) {
            var data = {
                "classification": i,
                "image": angular.copy($scope.image.id)
            };
            $http.post('https://api.croplands.org/api/image_classifications', data).then(function (response) {
            });
        }
        getImage();
    }

}]);