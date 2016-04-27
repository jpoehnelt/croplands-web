app.factory('DataService', ['mappings', '$http', '$rootScope', '$q', '$timeout', 'log', 'User', '$window', '$httpParamSerializer','server', function (mappings, $http, $rootScope, $q, $timeout, log, User, $window, $httpParamSerializer, server) {
    var _baseUrl = server.address,
        data = {
            records: [],
            count: {},
            columns: angular.copy(mappings),
            ordering: {},
            paging: {
                page: 1,
                page_size: 200
            },
            busy: false,
            bounds: false,
            ndviLimits: false,
            is_initialized: false
        }, canceler = $q.defer();


    function select(choices, value) {
        _.each(choices, function (option) {
            option.selected = value;
        });
    }

    function csvToJSON(csv, types) {
        var lines = csv.split("\n"),
            headers = lines[0].split(','),
            results;

        results = _.map(lines.slice(1, lines.length - 1), function (l) {
            var row = {};
            _.each(l.split(','), function (col, i) {
                var value = col;
                if (types && types[headers[i]]) {
                    value = types[headers[i]](col);
                }

                row[headers[i]] = value;
            });
            return row;
        });
        return results;
    }

    data.getParams = function () {
        var filters = {};
        _.each(data.columns, function (column, key) {
            var values = [];
            _.each(column.choices, function (option) {
                if (option.selected) {
                    values.push(option.id);
                }
            });
            filters[key] = values;
        });

        if (data.bounds) {
            filters.southWestBounds = data.bounds.southWest.lat + ',' + data.bounds.southWest.lng;
            filters.northEastBounds = data.bounds.northEast.lat + ',' + data.bounds.northEast.lng;
        }

        if (data.ndviLimits) {
            filters.ndvi_limit_upper = data.ndviLimits.upper.join(",");
            filters.ndvi_limit_lower = data.ndviLimits.lower.join(",");
        }

        return _.assign(filters, data.ordering, data.paging);
    };

    data.setDefault = function () {
        select(data.columns.land_use_type.choices, false);
        select(data.columns.crop_primary.choices, false);
        select(data.columns.water.choices, false);
        select(data.columns.intensity.choices, false);
        select(data.columns.year.choices, false);
        select(data.columns.source_type.choices, false);
    };

    data.reset = function () {
        log.info("[DataService] Reset");
        data.setDefault();
    };

    // load data from server
    data.load = function () {
        log.info("[DataService] Load");
        var deferred = $q.defer();
        data.busy = true;
        data.is_initialized = true;

        canceler.resolve();
        canceler = $q.defer();

        $http({
            url: _baseUrl + '/data/search',
            method: "GET",
            params: data.getParams(),
            timeout: canceler.promise
        }).then(function (response) {
            data.records = csvToJSON(response.data, {
                id: parseInt,
                month: parseInt,
                year: parseInt,
                lat: parseFloat,
                lon: parseFloat,
                crop_primary: parseInt,
                crop_secondary: parseInt,
                crop_tertiary: parseInt,
                water: parseInt,
                intensity: parseInt,
                land_use_type: parseInt
            });

            var headers = response.headers();
            data.count.total = headers['query-count-total'];
            data.count.filtered = headers['query-count-filtered'];
            deferred.resolve(response);
            $rootScope.$broadcast("DataService.load", data.records);
            data.busy = false;
        }, function (e) {
            deferred.reject(e);
        });

        return deferred.promise;
    };

    data.download = function () {
        var params = data.getParams(), query, url;
        params.page_size = 100000;
        query = $httpParamSerializer(params);

        url = _baseUrl + '/data/download' + '?' + query;
        $window.open(url);
    };

    data.init = function () {
        log.info("[DataService] Init");
        if (!data.is_initialized) {
            data.setDefault();
            data.load();
            data.is_initialized = true;
        }
    };

    return data;
}]);
