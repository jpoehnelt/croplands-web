app.directive('tableOfContents', ['mapService', 'leafletData', function (mapService, leafletData) {
    return {
        templateUrl: '/static/directives/table-of-contents.html',
        scope: {
            expandBackgroundLayers: '@',
            expandProductLayers: '@',
            expandOtherLayers: '@'
        }, link: function (scope) {
            scope.layers = scope.layers === undefined ? mapService.layers : scope.layers;

            scope.changeBaseLayer = function (key) {
                leafletData.getMap().then(function (map) {
                    leafletData.getLayers().then(function (layers) {
                        _.each(layers.baselayers, function (layer) {
                            map.removeLayer(layer);
                        });
                        map.addLayer(layers.baselayers[key]);
                    });
                });
            };
        }
    };
}
]);

