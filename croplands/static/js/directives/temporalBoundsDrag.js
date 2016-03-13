app.directive('draggableBounds', ['$document', function ($document) {
    return {
        restrict: 'EA',
        scope: {
            x: '=x',
            y: '=y'
        },
        link: function (scope, element, attributes) {


            angular.extend(scope, {
                radius: 20
            });

            var circle = element[0].children[0];
            circle.attr('cx', scope.x);
            circle.attr('cy', scope.y);

            circle.removeAttr('ng-attr-cx');
            circle.removeAttr('ng-attr-cy');

            var startY, y = angular.copy(scope.y);

            function mouseMove(e){
                y +=  (e.pageY - startY)/4;
                circle.attr('cy', y);
                console.log(element);
            }

            function mouseUp(){
                $document.off('mousemove', mouseMove);
                $document.off('mouseup', mouseUp);
//                scope.y = y;
            }

//            scope.mouseDown = function (e) {
//                e.stopPropagation();
//                $document.on('mousemove', mouseMove);
//                $document.on('mouseup', mouseUp);
//                startY = e.pageY;
//            };

        },
        template: '<circle ng-mousedown="mouseDown($event)" ng-attr-cx="{{ x }}" ng-attr-cy="{{ y }}" ng-attr-r="{{ radius }}" fill="red" />'
    };
}]);