app.controller("NavbarController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    $scope.goToLogin = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/login').search({n: n});
    };

    $scope.isLoggedIn = function () {
        return User.isLoggedIn();
    };

    $scope.goToLogout = function () {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    };
}]);