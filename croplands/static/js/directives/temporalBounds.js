app.directive('temporalBounds', ['DataService', function (DataService) {
    var bounds = {
        upper: [],
        lower: [],
        max: 0,
        min: 1000,
        init: false
    }, radius = 12;

    return {
        scope: {
        },
        link: function (scope, element, attributes) {
            var svg, activeBoundsInterval, activeBoundsSide, x, y, scale;


            var numIntervals = parseInt(attributes.intervals, 10);
            var intervalWidth = parseFloat(attributes.intervalWidth);
            scope.padding = 20;
            svg = element[0].viewportElement;
            scale = svg.clientWidth / svg.viewBox.baseVal.width;

            function initBounds() {
                if (!bounds.init) {

                    if (DataService.ndviLimits) {
                        for (var i = 0; i < numIntervals; i++) {
                            bounds.upper.push({x: i * intervalWidth + scope.padding, y: 1000 - DataService.ndviLimits.upper[i] + scope.padding, r: radius});
                            bounds.lower.push({x: i * intervalWidth + scope.padding, y: 1000 - DataService.ndviLimits.lower[i] + scope.padding, r: radius});
                        }
                    } else {
                        for (var i = 0; i < numIntervals; i++) {
                            bounds.upper.push({x: i * intervalWidth + scope.padding, y: bounds.max + scope.padding, r: radius});
                            bounds.lower.push({x: i * intervalWidth + scope.padding, y: bounds.min + scope.padding, r: radius});
                        }
                    }

                    bounds.init = true;
                }

                scope.bounds = bounds;
            }

            function limitBounds() {
                _.each(scope.bounds.upper, function (pt) {

                    if (!pt.adjusted || pt.y < bounds.max + scope.padding) {
                        pt.y = bounds.max + scope.padding;
                        pt.adjusted = false;
                    }

                });

                _.each(scope.bounds.lower, function (pt) {
                    if (!pt.adjusted || pt.y > bounds.min + scope.padding) {
                        pt.y = bounds.min + scope.padding;
                        pt.adjusted = false;
                    }
                });
            }

            function mouseMove(e) {
                if (e.stopPropagation) e.stopPropagation();
                if (e.preventDefault) e.preventDefault();

                if (activeBoundsInterval !== null) {
                    scope.bounds[activeBoundsSide][activeBoundsInterval].y = Math.min(Math.max((e.clientY - y) / scale, bounds.max + scope.padding), bounds.min + scope.padding);
                    scope.bounds[activeBoundsSide][activeBoundsInterval].adjusted = true;
                    scope.$apply();
                } else {
                    if (activeBoundsSide === 'max') {
                        scope.bounds.max = Math.min(Math.max((e.clientY - y) / scale, 0), 1000);
                    }
                    if (activeBoundsSide === 'min') {
                        scope.bounds.min = Math.max(Math.min((e.clientY - y) / scale, 1000), 0);
                    }
                    limitBounds();
                    scope.$apply();
                }
            }

            function mouseUp(e) {
                if (activeBoundsSide === 'max' || activeBoundsSide === 'min') {
                    limitBounds();
                }

                DataService.ndviLimits = {
                    upper: _.map(scope.bounds.upper, function (pt) {
                        return Math.round(1000 - pt.y) + scope.padding;
                    }),
                    lower: _.map(scope.bounds.lower, function (pt) {
                        return Math.round(1000 - pt.y) + scope.padding;
                    })
                };

                scope.$apply();

                activeBoundsInterval = null;
                activeBoundsSide = null;
                disableEvents();
            }


            function enableEvents() {
                angular.element(svg).on('mousemove', mouseMove);
                angular.element(svg).on('mouseup', mouseUp);
//                angular.element(svg).on('mouseout', disableEvents);
            }

            function disableEvents() {
                angular.element(svg).off('mousemove', mouseMove);
                angular.element(svg).off('mouseup', mouseUp);
//                angular.element(svg).off('mouseout', disableEvents);
            }

            scope.mouseDown = function (e, index, side) {
                if (e.stopPropagation) e.stopPropagation();
                activeBoundsInterval = index;
                activeBoundsSide = side;

                y = svg.getBoundingClientRect().top;

                enableEvents();
            };

            scope.mouseOver = function (e, index, side) {
                scope.bounds[side][index].r = radius * 2;
            };

            scope.mouseOut = function (e, index, side) {
                scope.bounds[side][index].r = radius;
            };


            scope.selectionPoints = function () {
                var upper = _.map(scope.bounds.upper, function (v) {
                    return v.x.toString() + ',' + v.y.toString();
                });
                var lower = _.map(scope.bounds.lower, function (v) {
                    return v.x.toString() + ',' + v.y.toString();
                });

                return _.concat(upper, lower.reverse()).join(" ");
            };


            initBounds();

        },
        templateUrl: '/static/directives/temporal-bounds.html'
    };
}]);