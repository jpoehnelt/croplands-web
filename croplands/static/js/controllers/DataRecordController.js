app.controller("DataRecordController", ['$scope', '$http', 'mapService', 'leafletData', '$location', 'DataRecord', function ($scope, $http, mapService, leafletData, $location, DataRecord) {

    angular.extend($scope, {
        id: $location.search().id,
        paging: {
            hasNext: DataRecord.paging.hasNext,
            hasPrevious: DataRecord.paging.hasPrevious,
            next: DataRecord.paging.next,
            previous: DataRecord.paging.previous
        }
    });

    DataRecord.get($scope.id).then(function (record) {
        $scope.record = record;
        console.l
    }, function (e) {
        console.log(e);
    });

}]);