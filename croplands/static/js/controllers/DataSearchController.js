app.controller("DataSearchController", ['$scope', '$http', 'mapService', 'leafletData', '$location', 'DataService', 'DataRecord', 'leafletData', function ($scope, $http, mapService, leafletData, $location, DataService, DataRecord, leafletData) {

    angular.extend($scope, {
        tableColumns: [
            {
                id: 'id',
                label: 'ID',
                visible: true
            },
            {
                id: 'land_use_type',
                label: 'Land Use Type',
                visible: true

            },
            {
                id: 'crop_primary',
                label: 'Primary Crop',
                visible: true
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
                id: 'country',
                label: 'Country',
                visible: true
            },
            {
                id: 'source_type',
                label: 'Source',
                visible: true
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

    $scope.layers.overlays.markers = {
        name: 'markers',
        visible: true,
        type: 'group'
    };

    ////////// Helpers //////////
    function init() {
        if (DataService.is_initialized) {
            console.log('dataservice already initialized');
            $scope.records = DataService.records;
            $scope.ndvi = getNDVI(DataService.getParams());
            $scope.busy = false;
        } else {
            console.log('dataservice not initialized');
            applyParams($location.search());
            DataService.load();
        }
    }

    function getData() {
        $scope.busy = true;
        $scope.$evalAsync(DataService.load);
    }

    function applyBounds(bounds) {
        console.log(bounds, DataService.bounds);
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
                layer: 'markers',
//                properties: row

            };
        });
        return records;
    }

    function getNDVI(params) {
        var url = 'https://api.croplands.org/data/image?';
        _.each(params, function (val, key) {
            if (key === 'southWestBounds' || key === 'northEastBounds') {
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

        return url;
    }

    function applyParams(params) {
        _.each(params, function (val, key) {
            console.log(key, val);
            if (DataService.columns[key] && key !== 'year') {
                if (Array.isArray(val)) {
                    _.each(val, function (idx) {
                        DataService.columns[key].choices[parseInt(idx, 10)].selected = true;
                    });
                } else {
                    DataService.columns[key].choices[parseInt(val, 10)].selected = true;
                }
            } else if (key === 'year') {
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

            if (DataService.bounds) {
                $scope.bounds = DataService.bounds;
                leafletData.getMap('map').then(function (map) {
                    map.fitBounds([
                        [$scope.bounds.southWest.lat, $scope.bounds.southWest.lng],
                        [$scope.bounds.northEast.lat, $scope.bounds.northEast.lng]
                    ]);
                    $scope.searchInMap = true;
                });
            }
        });
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

    $scope.goToRecord = function (index) {
        DataRecord.goTo(index);
    };

    $scope.zoomExtent = function () {
        $scope.center.lat = 0;
        $scope.center.lng = 0;
        $scope.center.zoom = 2;
    };
    ////////// End Methods //////////


    ////////// Events //////////
    $scope.$on("DataService.load", function (e) {
        $scope.records = DataService.records;
        $location.search(DataService.getParams());
        $scope.markers = buildMarkers($scope.records);
        $scope.$evalAsync(function () {
            $scope.busy = false;
        });

        $scope.ndvi = getNDVI(DataService.getParams());
        $scope.count = DataService.count;
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

}]);