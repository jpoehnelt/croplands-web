var app = angular.module("app", ["leaflet-directive", "ngRoute", 'mgcrea.ngStrap', 'server']);
app.config(['$tooltipProvider', '$routeProvider', '$sceDelegateProvider', '$locationProvider', 'server.config', function ($tooltipProvider, $routeProvider, $sceDelegateProvider, $locationProvider, serverConfig) {
    var cdn = serverConfig.cdn;

    $routeProvider
        .when('/app/map', {
            templateUrl: cdn + '/templates/map.html',
            controller: 'MapController',
            reloadOnSearch: false
        }).when('/app/a/login', {
            templateUrl: cdn + '/templates/account/login.html',
            controller: 'LoginController'
        }).when('/app/a/register', {
            templateUrl: cdn + '/templates/account/register.html',
            controller: 'RegisterController'
        }).when('/app/a/forgot', {
            templateUrl: cdn + '/templates/account/forgot.html',
            controller: 'ForgotController'
        }).when('/app/a/reset', {
            templateUrl: cdn + '/templates/account/reset.html',
            controller: 'ResetController'
        }).when('/app/a/logout', {
            templateUrl: cdn + '/templates/account/logout.html',
            controller: 'LogoutController'
        }).when('/app/classify', {
            templateUrl: cdn + '/templates/classify.html',
            controller: 'ClassifyController'
        }).otherwise({
            templateUrl: cdn + '/templates/404.html'
        });
    $locationProvider.html5Mode(true);
//    $locationProvider.hashPrefix('!/');

    angular.extend($tooltipProvider.defaults, {
        animation: 'am-fade-and-scale',
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });
    $sceDelegateProvider.resourceUrlWhitelist([
        // Allow same origin resource loads.ot
        'self',
        // Allow loading from our assets domain.  Notice the difference between * and **.
        'http://cache.croplands.org/static/**',
        'https://hwstatic.croplands.org/static/**']);
}]);
