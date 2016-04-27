app.factory('DataRecord', ['mappings', '$http', '$rootScope', '$q', 'DataService', 'log', 'User', '$location','server', function (mappings, $http, $rootScope, $q, DataService, log, User, $location, server) {
    var _baseUrl = server.address,
        record = {
            paging: {},
            current: {}
        };

    record.paging.hasNext = function () {
        return DataService.records.length > record.index + 1;
    };

    record.paging.hasPrevious = function () {
        return record.index > 0;
    };

    record.paging.next = function () {
        if (record.paging.hasNext()) {
            record.goTo(++record.index);
        }
        return record.index;
    };

    record.paging.previous = function () {
        if (record.paging.hasPrevious()) {
            record.goTo(--record.index);
        }
    };

    record.get = function (id) {
        var deferred = $q.defer();
        $http({
            method: 'GET',
            url: _baseUrl + '/api/records/' + String(id)
        }).then(function (response) {
            deferred.resolve(response.data);
        }, function (error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };

    record.goTo = function (index) {
        if (index !== undefined) {
            record.index = index;
        }

        record.current = DataService.records[index];

        $location.path('/app/data/record').search({'id': record.current.id});
    };

    return record;
}]);
