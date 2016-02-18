app.controller("DataSearchController", ['$scope', '$http', 'mapService', 'leafletData', '$window', 'DataService', '$timeout', function ($scope, $http, mapService, leafletData, $window, DataService, $timeout) {

    angular.extend($scope, {
        tableColumns: [
            {
                id: 'id',
                label: 'ID',
                visible: false
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
                visible: false
            },
            {
                id: 'source_type',
                label: 'Source',
                visible: true
            }
        ],
        ordering: DataService.ordering,
        busy: false
    });


    function getData() {
        $scope.busy = true;
        $scope.$evalAsync(DataService.load);
    }

    $scope.$on("DataService.load", function (e, records) {
        $scope.records = records;
        $scope.$evalAsync(function () {
            $scope.busy = false;
        });
    });

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

    $scope.goToRecord = function (id) {
        $window.location.href = '/app/data/record?id=' + id;
    };

    getData();
}]);