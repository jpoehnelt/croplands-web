app.controller("LogoutController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    User.logout();

    var next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
    if (next) {
        $location.path(next.path).search(next.params);
    }
}]);