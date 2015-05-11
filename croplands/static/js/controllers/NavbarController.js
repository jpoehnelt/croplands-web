app.controller("NavbarController", ['$scope', 'user', '$location', function ($scope, user, $location) {
    $scope.goToLogin = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/login').search({n: n});
    };

    $scope.isLoggedIn = function () {
        return user.isLoggedIn();
    };

    $scope.goToLogout = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    };
}]);