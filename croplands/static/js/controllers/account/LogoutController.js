app.controller("LogoutController", ['$scope', 'User', '$location', function ($scope, User, $location) {
    User.logout();
    User.goNext();
}]);