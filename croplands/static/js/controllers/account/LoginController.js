app.controller("LoginController", ['$scope', 'log', 'User', '$timeout', '$location', function ($scope, log, User, $timeout, $location) {

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    $scope.login = function (valid) {
        $scope.message = null;

        $scope.busy = true;
        if (!valid) {
            setMessage('Invalid Data', false);
            return;
        }
        User.login($scope.email, $scope.password).then(function () {
            setMessage('You have successfully logged in.', true);
            $scope.busy = false;
            $scope.email = '';
            $scope.password = '';

            var next = JSON.parse(window.atob(decodeURIComponent($location.search().n)));
            if (next) {
                $location.path(next.path).search(next.params);
            } else {
                $location.path('/app').search();
            }

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