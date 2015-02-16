// Karma configuration
// Generated on Sun Feb 15 2015 21:34:54 GMT-0700 (MST)

module.exports = function (config) {
    config.set({

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['jasmine'],


        // list of files / patterns to load in the browser
        files: [
            'app/js/lib/local/jquery.js',
            'app/js/lib/local/angular.js',
            'app/js/lib/local/angular-route.js',
            'app/js/lib/local/angular-strap.js',
            'app/js/lib/local/angular-strap-tpl.js',
            'app/js/lib/local/angular-animate.js',
            'app/js/lib/local/bootstrap.js',
            'app/js/lib/local/crossfilter.js',
            'app/js/lib/local/lodash.js',
            'app/js/lib/local/zxcvbn.js',
            'app/js/lib/local/leaflet.js',
            'app/js/lib/local/google-maps.js',
            'app/js/app.js',
            'tests/*.js'
        ],

        // list of files to exclude
        exclude: [
        ],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'app/js/app.js': ['coverage']
        },


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
//        plugins: [
//            'karma-coverage'
//        ],
        reporters: ['coverage'],

        coverageReporter: {
            type: "lcov",
            dir: "coverage/"
        },

        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_DEBUG,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['PhantomJS'],


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: false
    });
};
