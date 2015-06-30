app.directive('images', [function () {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        link: function (scope) {
            scope.$watch('items', function (val) {
                if (val && val.length > 0) {
                    scope.active = scope.items[0];
                }
                else {
                    scope.active = null;
                }
            });
            scope.src = function (url) {
                if(url) {
                    // use first directory to make subdomain
                    return "http://images.croplands.org" + url.replace('images/','/');
                }
            };

            scope.changeLeadPhoto = function (index) {
                scope.modal = true;
                scope.active = scope.items[index];
            };

            scope.closeModal = function () {
                scope.modal = false;
            };
        },
        templateUrl: '/static/directives/images.html'
    };

}]);