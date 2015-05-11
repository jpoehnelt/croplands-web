app.directive('legend', ['version', function (version) {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        templateUrl: '/static/directives/legend.html'
    };
}]);