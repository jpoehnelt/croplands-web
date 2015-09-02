app.directive('locationRecord', ['mapService', 'RatingService','User', function (mapService, RatingService, User) {
    return {
        restrict: 'EA',
        scope: {
            record: '=record',
            showZoom: '=showZoom'
        },
        link: function (scope) {
            console.log(scope.record);
            // do nothing
            scope.edit = function () {
                scope.$emit('location.record.edit.open', scope.record);
                scope.showEditForm = true;
            };
            scope.$on('location.record.edit.inactive', function () {
                    scope.showEditForm = false;
            });
            scope.zoom = function () {
                if (scope.record.lat && scope.record.lon) {
                    mapService.zoom(scope.record.lat, scope.record.lon, 16);
                }
            };

            scope.thumbsUp = function () {
                RatingService.rateRecord(scope.record, 1);
            };
            scope.thumbsDown = function () {
                RatingService.rateRecord(scope.record, -1);
            };

            scope.getUserRating = function () {
                if (scope.record.user_rating === undefined) {
                    return 0;
                }
                return scope.record.user_rating.rating;
            };

            scope.User = User;

        },
        templateUrl: '/static/directives/location-record.html'
    };
}]);