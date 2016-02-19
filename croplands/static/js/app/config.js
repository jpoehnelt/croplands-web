var app = angular.module("app", ["leaflet-directive", "ngRoute", 'mgcrea.ngStrap', 'server']);
app.config(['$tooltipProvider', '$routeProvider', '$sceDelegateProvider', '$locationProvider', 'server.config', function ($tooltipProvider, $routeProvider, $sceDelegateProvider, $locationProvider, serverConfig) {
    var cdn = serverConfig.cdn;

    $routeProvider
        .when('/app/map', {
            templateUrl: '/static/templates/map.html',
            controller: 'MapController',
            reloadOnSearch: false
        }).when('/app/data', {
            templateUrl: '/static/templates/data.html',
            controller: 'DataController'
        }).when('/app/data/search', {
            templateUrl: '/static/templates/data/search.html',
            controller: 'DataSearchController'
        }).when('/app/data/record', {
            templateUrl: '/static/templates/data/record.html',
            controller: 'DataRecordController'
        }).when('/app/a/login', {
            templateUrl: '/static/templates/account/login.html',
            controller: 'LoginController'
        }).when('/app/a/register', {
            templateUrl: '/static/templates/account/register.html',
            controller: 'RegisterController'
        }).when('/app/a/forgot', {
            templateUrl: '/static/templates/account/forgot.html',
            controller: 'ForgotController'
        }).when('/app/a/reset', {
            templateUrl: '/static/templates/account/reset.html',
            controller: 'ResetController'
        }).when('/app/a/logout', {
            templateUrl: '/static/templates/account/logout.html',
            controller: 'LogoutController'
        }).otherwise({
            templateUrl: '/static/templates/404.html'
        });
    $locationProvider.html5Mode(true);
//    $locationProvider.hashPrefix('!/');

    angular.extend($tooltipProvider.defaults, {
        animation: 'am-fade-and-scale',
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });
//    $sceDelegateProvider.resourceUrlWhitelist([
//        // Allow same origin resource loads.ot
//        'self',
//        // Allow loading from our assets domain.  Notice the difference between * and **.
//        'http://cache.croplands.org/static/**',
//        'https://hwstatic.croplands.org/**']);
}]);
