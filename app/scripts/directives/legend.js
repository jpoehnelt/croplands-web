app.directive('legend', ['version', function (version) {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        templateUrl: '/templates/directives/legend.html'
    };
}]);