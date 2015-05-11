app.controller("LogoutController", ['$scope', 'user', '$location', function ($scope, user, $location) {
    user.logout();

    var next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
    if (next) {
        $location.path(next.path).search(next.params);
    }
}]);