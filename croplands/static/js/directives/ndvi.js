app.directive('ndvi', ['$http', '$log', '$q',
    function () {
        return {
            restrict: 'E',
            scope: {
                pts: '=pts'
            },
            link: function (scope) {
                scope.$watch('pts', function () {
                    scope.points = _.map(scope.pts, function (v, i) {
                        var x = i * 52.17, y = 1000 - Math.max(3, Math.min(v, 1000));
                        return x.toString() + ',' + y.toString();
                    }).join(" ");
                });
            },
            templateUrl: '/static/directives/ndvi.html'
        };

    }
]);