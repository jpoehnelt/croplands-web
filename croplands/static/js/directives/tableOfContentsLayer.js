app.directive('tableOfContentsLayer', [function () {
    return {
        templateUrl: '/static/directives/table-of-contents-layer.html',
        scope: {
            layer: '=',
            showMore: '@'
        }, link: function (scope) {
            var layer = scope.layer,
                params = scope.layer.params;

            scope.isMultiYear = scope.layer.years && scope.layer.years.length;

            scope.toggleShowMore = function () {
                if (scope.canShowMore()) {
                    scope.showMore = !scope.showMore;
                }
            };
            scope.canShowMore = function () {
                return true; //scope.layer.legend;
            };

            function init() {
                if (!scope.isMultiYear) {
                    return;
                }
                params.options.year = layer.years[layer.years.length - 1];
            }

            init();

        }
    };
}
]);

