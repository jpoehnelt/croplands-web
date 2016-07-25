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

}]);