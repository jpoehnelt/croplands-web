app.controller("DataSearchController", ['$scope', '$http', 'mapService', 'leafletData', '$window', 'locationFactory', function ($scope, $http, mapService, leafletData, $window, locationFactory) {

    angular.extend($scope, {
        tableColumns: [
            {
                id: 'record_id',
                label: 'ID'
            },
            {
                id: 'crop_primary',
                label: 'Primary Crop'
            },
            {
                id: 'year',
                label: 'Year'
            },
            {
                id: 'country',
                label: 'Country'
            }
        ],
        sort: {
            reverse: false
        }
    });

    $scope.sortColumn = function (column) {
        console.log(column);
        if (column === $scope.sort.column) {
            $scope.sort.reverse = !$scope.sort.reverse;
        } else {
            $scope.sort = {
                column: column,
                reverse: false
            };
        }
    };

    $scope.goToRecord = function (id) {
        $window.location.href = '/app/data/record?id=' + id;
    };

    $scope.fakeData = [
        {
            record_id: 1,
            country: 'Mali',
            crop_primary: 'Wheat',
            year: 2013
        },
        {
            record_id: 2,
            country: 'United States',
            crop_primary: 'Barley',
            year: 2012
        },
        {
            record_id: 3,
            country: 'Canada',
            crop_primary: 'Wheat',
            year: 2012
        },
        {
            record_id: 4,
            country: 'Indonesia',
            crop_primary: 'Sugarcane',
            year: 2010
        }
    ];
}]);