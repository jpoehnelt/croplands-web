app.directive('locationRecordEditForm', ['locationFactory', 'mappings', 'User', function (locationFactory, mappings, User) {
    return {
        restrict: 'EA',
        scope: {
            record: '=record'
        },
        link: function (scope) {
            scope.original = angular.copy(scope.record);
            // Build the options
            scope.landUseTypes = mappings.landUseType.choices;
            scope.crops = mappings.crop.choices;
            scope.intensity = mappings.intensity.choices;
            scope.water = mappings.water.choices;
            scope.sources = mappings.source.choices;
            scope.confidence = mappings.confidence.choices;
            scope.years = [];

            var currentYear = new Date().getFullYear();
            for (var i = 2000; i < currentYear + 1; i++) {
                scope.years.push({label: i, id: i});
            }


            scope.save = function (){
                console.log(scope.record);

                locationFactory.saveRecord(scope.record).then(function (data) {
                    scope.$emit('location.record.edit.close');
                    _.merge(scope.record, data);
                });

            };

            scope.cancel = function () {
                scope.$emit('location.record.edit.close');
            };

        },
        templateUrl: '/static/directives/location-record-edit-form.html'
    };
}]);