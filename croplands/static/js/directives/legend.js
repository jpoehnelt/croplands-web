app.directive('legend', [function () {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        templateUrl: '/static/directives/legend.html'
    };
}]);