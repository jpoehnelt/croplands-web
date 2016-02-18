app.directive('filter', ['log', '$q', '$timeout', 'mappings', 'DataService', function (log, $q, $timeout, mappings, DataService) {
    function select(choices, value) {
        _.each(choices, function (option) {
            option.selected = value;
        });
    }

    return {
        restrict: 'EA',
        scope: {
        },
        link: function (scope) {
            scope.init = function (reset) {
                scope.land_use_type = DataService.columns.land_use_type.choices;
                scope.crop_primary = DataService.columns.crop_primary.choices;
                scope.water = DataService.columns.water.choices;
                scope.intensity = DataService.columns.intensity.choices;
                scope.year = DataService.columns.year.choices;
                scope.source_type = DataService.columns.source_type.choices;

                if (reset) {
                    scope.defaultSelection();
                }
            };

            scope.defaultSelection = function () {
                select(scope.land_use_type, true);
                select(scope.crop_primary, true);
                select(scope.water, true);
                select(scope.intensity, true);
                select(scope.year, true);
                select(scope.source_type, true);
            };

            // Scope Methods
            scope.reset = function () {
                DataService.reset();
                scope.init(true);
            };

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

            scope.init(true);

            scope.$on("DataService.load", function () {
                scope.count = {
                    total: DataService.count.total,
                    filtered: DataService.count.filtered
                };
            });
        },
        templateUrl: '/static/directives/filter.html'
    };
}]);