app.directive('log', ['log', function (log) {
    return {
        link: function (scope) {
            scope.list = log.getLog();
            scope.$watch(function () {
                return log.getLog();
            }, function (val) {
                scope.list = val;
            }, true);
        },
        templateUrl: '/static/directives/log.html'
    };
}]);
