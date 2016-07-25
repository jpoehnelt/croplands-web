app.directive('tableOfContents', ['mapService', 'leafletData', function (mapService, leafletData) {
    return {
        templateUrl: '/static/directives/table-of-contents.html',
        scope: {
            expandBackgroundLayers: '@',
            expandProductLayers: '@',
            expandOtherLayers: '@'
        }, link: function (scope) {
            scope.layers = scope.layers === undefined ? mapService.layers : scope.layers;

            scope.changeBaseLayer = function (id) {
                _.each(scope.layers.baselayers, function (layer, key) {
                    layer.visible = id === key;
                });
            };
        }
    };
}
]);

