app.directive('filter', ['log', '$q', '$timeout', 'mappings', 'DataService', function (log, $q, $timeout, mappings, DataService) {
    return {
        restrict: 'EA',
        scope: {
        },
        link: function (scope) {
            angular.extend(scope, {
                    land_use_type: DataService.columns.land_use_type.choices,
                    crop_primary: DataService.columns.crop_primary.choices,
                    water: DataService.columns.water.choices,
                    intensity: DataService.columns.intensity.choices,
                    year: DataService.columns.year.choices,
                    source_type: DataService.columns.source_type.choices,
                    count: DataService.count
                }
            );

            // Scope Methods
            scope.reset = DataService.reset;

            scope.apply = function () {
                scope.$parent.busy = true;
                scope.$evalAsync(DataService.load);
            };

            scope.allOptionsAreSelected = function (field) {
                if (field === undefined) {
                    return false;
                }

                for (var i = 0; i < scope[field].length; i++) {
                    if (!scope[field][i].selected) {
                        return false;
                    }
                }
                return true;
            };

            scope.toggleAllOptions = function (field) {
                var selected = true;
                if (scope.allOptionsAreSelected(field)) {
                    selected = false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    scope[field][i].selected = selected;
                }
            };

            scope.$on("DataService.load", function (e) {
                scope.count = DataService.count;
            });

        },
        templateUrl: '/static/directives/filter.html'
    };
}]);