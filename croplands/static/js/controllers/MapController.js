app.controller("MapController", ['$scope', 'mapService', 'DataService', 'leafletData', '$timeout', '$window', '$location', 'mappings', 'log', function ($scope, mapService, DataService, leafletData, $timeout, $window, $location, mappings, log) {

    ///////////
    // Utils //
    ///////////

    function stopPropagation(e) {
        L.DomEvent.stopPropagation(e);
    }

    $location.moveCenter = function (lat, lng, zoom) {
        this.search(_.merge(this.search(), {lat: Math.round(lat * Math.pow(10, 5)) / Math.pow(10, 5), lng: lng, zoom: zoom}));
    };

    $location.setId = function (id) {
        this.search(_.merge(this.search(), {id: id}));
    };

    $location.removeId = function () {
        this.search(_.omit(this.search(), 'id'));
    };

    $location.getId = function () {
        return parseInt(_.pluck(this.search(), 'id'), 10);
    };

    $location.getCenter = function () {
        var parameters = this.search();
        if (parameters.lat && parameters.lng && parameters.zoom) {
            return {lat: parseFloat(parameters.lat),
                lng: parseFloat(parameters.lng),
                zoom: parseInt(parameters.zoom, 10)
            };
        }
    };

///////////////////////
// Listen for Events //
///////////////////////

    $scope.$watch(function () {
        return mapService.center;
    }, function (center) {
        $scope.center = center;
    }, true);

    $scope.$watch('center', function (center) {
        $location.moveCenter(center.lat, center.lng, center.zoom);
    });

    $scope.$watch('busy', function () {
        if ($scope.busy) {
            $scope.busyDialogVisible = true;
        }
    });


///////////////////////
// Button Actions    //
///////////////////////


    $scope.toggleLayerInfo = function (layer, e) {
        e.preventDefault();
        stopPropagation(e);
        layer.infoVisible = !layer.infoVisible;
    };

    $scope.zoomExtent = function () {
        mapService.center.lat = 0;
        mapService.center.lng = 0;
        mapService.center.zoom = 2;
    };


    $scope.print = function () {
        window.print();
    };


//////////
// Init //
//////////

    function init() {
//        requestFullscreen($("#map-app"));
        var defaults = {
            tableOfContentsVisible: true,
            showHelp: false,
            showDownloadModal: false,
            busy: false,
            busyDialogVisible: false,
            table: {
                visible: false
            },
            events: {
                map: {
                    enable: ['mousedown', 'mousemove', 'click'],
                    logic: 'emit'
                }
            },
            center: mapService.center,
            layers: mapService.layers
        };


        // Load Url Parameters if Found
        var center = $location.getCenter();
        if (center && center.lat) {
            mapService.center.lat = center.lat;
        }
        if (center && center.lng) {
            mapService.center.lng = center.lng;
        }
        if (center && center.zoom) {
            mapService.center.zoom = center.zoom;
        }


        // Apply defaults
        angular.extend($scope, defaults);
    }

    init();

}]);