app.directive('tableOfContentsLayer', [function () {
    return {
        templateUrl: '/static/directives/table-of-contents-layer.html',
        scope: {
            layer: '=',
            showMore: '@'
        }, link: function (scope) {
            scope.showMore = scope.showMore === undefined ? false : scope.showMore;

            scope.isPlaying = function () {
                return scope.layer.loop !== undefined;
            };

            scope.toggleShowMore = function () {
                if (scope.canShowMore()) {
                    scope.showMore = !scope.showMore;
                }
            };
            scope.canShowMore = function () {
                return scope.layer.years || scope.layer.legend;
            };
        }
    };
}
]);

