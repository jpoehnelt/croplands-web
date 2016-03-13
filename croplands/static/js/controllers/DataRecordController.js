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
}]);