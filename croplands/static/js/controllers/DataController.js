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


}]);