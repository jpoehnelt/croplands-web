app.controller("ResetController", ['$location', '$scope', 'log', '$window', function ($location, $scope, log, $window) {
    $scope.token = $location.search().token;
    var path = $location.path().split('/');

    if (path[1] === 'account') {
        $scope.$emit('user.' + path[2], true);
    } else {
        log.info('not account/reset');
//        $window.location.href = '/';
    }
    if ($scope.token === undefined) {
        log.warn('Token not found');
//        $window.location.href = '/';
    }
}]);