app.controller("MessagesController", ['$scope', '$window', 'User', function ($scope, $window, User) {
    $scope.active = 0;
    $scope.$watch(function () {
        return User.getMessages();
    }, function (messages) {
        $scope.messages = messages;
    }, true);

    $scope.view = function (m) {
        m.closed = !m.closed;
        m.unread = false;
    };
}]);