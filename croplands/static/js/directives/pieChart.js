app.directive('pieChart', ['$http', '$log', '$q',
    function () {
        return {
            restrict: 'E',
            scope: {
                value: '=value'
            },
            link: function (scope, element, attributes) {
                var size = 100;
                scope.radius = size / 2;
                scope.background = '#cccccc';

                scope.$watch('value', function (value) {
                    value = parseFloat(value);
                    scope.invalid = isNaN(value);

                    if (scope.invalid) {
                        scope.d = '';
                        return;
                    }

                    value = Math.min(Math.max(value, 0), 100);

                    console.log('pie value', value);
                    if (value === 100) {
                        console.log('short circuit pie');
                        scope.background = '#237c28';
                        scope.d = '';
                        return;
                    }



                    //calculate x,y coordinates of the point on the circle to draw the arc to.
                    var x = Math.cos((2 * Math.PI) / (100 / value));
                    var y = Math.sin((2 * Math.PI) / (100 / value));

                    //should the arc go the long way round?
                    var longArc = (value <= 50) ? 0 : 1;

                    //d is a string that describes the path of the slice.
                    scope.d = "M" + scope.radius + "," + scope.radius + " L" + scope.radius + ", 0, A" + scope.radius + "," + scope.radius + " 0 " + longArc + ",1 " + (scope.radius + y * scope.radius) + "," + (scope.radius - x * scope.radius) + " z";

                });


            },
            templateUrl: '/static/directives/pieChart.html'
        };

    }
]);
