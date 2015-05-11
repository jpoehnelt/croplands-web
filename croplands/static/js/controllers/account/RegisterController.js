app.controller("RegisterController", ['user', 'countries', '$scope','$location', function (user, countries, $scope, $location) {

    if (user.isLoggedIn()) {
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
        user.register($scope.registration)
            .then(function (response) {
                $scope.busy = false;
                setMessage(response.description, true);

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