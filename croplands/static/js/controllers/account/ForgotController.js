app.controller("ForgotController", ['$scope', 'user', function ($scope, user) {
    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.forgot = function () {
        $scope.busy = true;
        user.forgot($scope.email).then(function (response) {
            setMessage(response.description, true);
            $scope.busy = false;
            $scope.email = '';
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
}]);