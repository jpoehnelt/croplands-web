app.controller("ResetController", ['$location', '$scope', '$window', 'User', function ($location, $scope, $window, User) {
    $scope.token = $location.search().token;

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.reset = function () {
        $scope.busy = true;
        User.reset($scope.password, $scope.token).then(function (response) {
            setMessage(response.description, true);
            $scope.busy = false;
            $scope.close();
        }, function (response) {
            if (response.description) {
                setMessage(response.description, false);
            }
            else {
                setMessage('Something went wrong', false);
            }
            $scope.busy = false;
        });
    };

    $scope.close = function () {
        $window.location.href = '/';
    };
}]);