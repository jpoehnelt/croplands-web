app.factory('RatingService', ['$http', '$rootScope', 'log', 'User', '$q','locationFactory','server', function ($http, $rootScope, log, User, $q, locationFactory, server) {
    var ratingLookup = {},
//        _baseUrl = 'http://127.0.0.1:8000';
        _baseUrl = server.address;

    /**
     * Applies a rating to a record.
     * @param record
     * @param rating
     * @returns {*}
     */
    function rateRecord(record, rating) {
        var deferred = $q.defer();
        $http({
            method: 'POST',
            url: _baseUrl + '/api/ratings',
            data: {
                record_id: record.id,
                rating: rating
            }
        }).then(function (response) {
            record.user_rating = response.data;
            record.visited = true;
            locationFactory.setIcon(record);
            log.debug('[RatingService] Set the rating to: '+ String(rating));
            deferred.resolve(record);
        }, function (err) {
            log.error('[RatingService] Could not set rating.');
            deferred.reject(err);
        });

        return deferred.promise;
    }

    function getRecordRatings() {
        log.info('[RatingService] Getting Ratings for Records');
        var deferred = $q.defer(), id;
        if (User.isLoggedIn() && User.get().id) {

            id = User.get().id;

            $http({
                method: 'GET',
                url: _baseUrl + '/api/ratings?q={"filters":[{"name":"user_id","op":"eq","val":' + id + '}]}'
            }).then(function (response) {
                log.info(response);
                _.each(response.data.objects, function (r) {
                    ratingLookup[r.record_id] = r;
                });

                _.each(locationFactory.getRecords(), function (l){
                    if (ratingLookup[l.id]) {
                        l.user_rating = ratingLookup[l.id];
                        locationFactory.setIcon(l);
                    }
                });

                deferred.resolve();
            }, function (err) {
                log.error(err);
                deferred.reject(err);
            });

        } else {
            deferred.reject();
        }


        return deferred.promise;
    }

    $rootScope.$on('locationFactory.markers.downloaded', function (){
        getRecordRatings();
    });

    return {
        rateRecord: rateRecord,
        getRecordRatings: getRecordRatings
    };
}]);