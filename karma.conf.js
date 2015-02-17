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
            'app/scripts/lib/local/jquery.js',
            'app/scripts/lib/local/angular.js',
            'app/scripts/lib/local/angular-route.js',
            'app/scripts/lib/local/angular-strap.js',
            'app/scripts/lib/local/angular-strap-tpl.js',
            'app/scripts/lib/local/angular-animate.js',
            'app/scripts/lib/local/bootstrap.js',
            'app/scripts/lib/local/crossfilter.js',
            'app/scripts/lib/local/lodash.js',
            'app/scripts/lib/local/zxcvbn.js',
            'app/scripts/lib/local/leaflet.js',
            'app/scripts/lib/local/google-maps.js',
            'app/scripts/app.0.2.1.js',
            'tests/*.js'
        ],

        // list of files to exclude
        exclude: [
        ],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'app/scripts/app.0.2.1.js': ['coverage']
        },


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
//        plugins: [
//            'karma-coverage'
//        ],
        reporters: ['coverage'],

        coverageReporter: {
            dir: "coverage/",
            reporters: [
                { type: 'lcovonly', subdir: '.', file: 'lcovonly.info' }
            ]
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
