app.controller("RegisterController", ['User', 'countries', '$scope', '$location', 'log', function (User, countries, $scope, $location, log) {

    if (User.isLoggedIn()) {
        var n = encodeURIComponent(window.btoa(JSON.stringify({
            path: $location.path(),
            params: $location.search()
        })));
        $location.path('/app/a/logout').search({n: n});
    }

    angular.extend($scope, {
        countries: countries,
        success: null,
        message: null
    });

    function setMessage(message, success) {
        $scope.success = success;
        $scope.message = message;
    }

    // Get List of Countries
    $scope.countries = countries;

    $scope.register = function () {
        $scope.busy = true;
        User.register($scope.registration)
            .then(function (response) {
                $scope.busy = false;
                setMessage(response.description, true);
                User.goNext();

            }, function (response) {
                if (response) {
                    setMessage(response.description, false);
                }
                else {
                    setMessage('Something went wrong', false);
                }
                $scope.busy = false;
            });
    };

}]);