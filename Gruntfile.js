module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
            // Metadata.
            pkg: grunt.file.readJSON('package.json'),
            banner: '/* <%= pkg.title || pkg.name %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
                '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
                '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;\n' +
                '* Last Modified: <%= grunt.template.today() %>\n' +
                '*/\n',
            // Task configuration.
            concat: {
                options: {
                    separator: ';\n'
                },
                dist: {
                    src: [
                        'croplands/static/js/lib/*.js',
                        'croplands/static/js/utilities/*.js',
                        'croplands/static/js/app/config.js',
                        'croplands/static/js/services/*.js',
                        'croplands/static/js/filters/*.js',
                        'croplands/static/js/controllers/*.js',
                        'croplands/static/js/controllers/account/*.js',
                        'croplands/static/js/directives/*.js'
                    ],
                    dest: 'croplands/static/js/app.js'
                }
            },
            uglify: {
                options: {
                    mangle: true,
                    banner: '<%= banner %>'
                },
                dist: {
                    src: '<%= concat.dist.dest %>',
                    dest: 'croplands/static/js/app.min.js'
                }
            },
            less: {
                development: {
                    options: {
                    },
                    files: {
                        // target.css file: source.less file
                        "croplands/static/css/main.css": "croplands/static/css/less/bootstrap.less"
                    }
                },
                production: {
                    options: {
                        cleancss: true,
                        compress: true,
                        yuicompress: true,
                        optimization: 2
                    },
                    files: {
                        // target.css file: source.less file
                        "croplands/static/css/main.min.css": "croplands/static/css/less/bootstrap.less"
                    }
                }
            },

            watch: {
                js: {
                    files: [
                        'croplands/static/js/lib/*.js',
                        'croplands/static/js/utilities/*.js',
                        'croplands/static/js/app/config.js',
                        'croplands/static/js/services/*.js',
                        'croplands/static/js/filters/*.js',
                        'croplands/static/js/controllers/*.js',
                        'croplands/static/js/controllers/account/*.js',
                        'croplands/static/js/directives/*.js'
                    ],
                    tasks: ['concat', 'uglify']
                },
                less: {
                    files: ['croplands/static/css/less/*', 'croplands/static/css/less/mixins/*'],
                    tasks: ['less']
                },
                all: {
                    files: ['Gruntfile.js', 'package.json'],
                    tasks: ['concat', 'uglify', 'less']
                }
            },
            karma: {
                continuous: {
                    options: {
                        frameworks: ['jasmine'],
                        // list of files / patterns to load in the browser
                        files: [
                            'croplands/scripts/lib/local/jquery.js',
                            'croplands/scripts/lib/local/angular.js',
                            'croplands/scripts/lib/local/angular-route.js',
                            'croplands/scripts/lib/local/angular-strap.js',
                            'croplands/scripts/lib/local/angular-strap-tpl.js',
                            'croplands/scripts/lib/local/angular-animate.js',
                            'croplands/scripts/lib/local/bootstrap.js',
                            'croplands/scripts/lib/local/crossfilter.js',
                            'croplands/scripts/lib/local/lodash.js',
                            'croplands/scripts/lib/local/zxcvbn.js',
                            'croplands/scripts/lib/local/leaflet.js',
                            'croplands/scripts/lib/local/google-maps.js',
                            'croplands/scripts/lib/*.js',
                            'croplands/scripts/utilities/*.js',
                            'croplands/scripts/croplands/config.js',
                            'croplands/scripts/services/*.js',
                            'croplands/scripts/filters/*.js',
                            'croplands/scripts/controllers/*.js',
                            'croplands/scripts/directives/*.js',
                            'tests/*.js'
                        ],
                        preprocessors: {
                            'croplands/scripts/!(*lib)/*.js': ['coverage']
                        },
                        reporters: ['progress', 'coverage'],
                        coverageReporter: {
                            dir: "coverage/",
                            reporters: [
                                { type: 'lcovonly', subdir: '.', file: 'lcovonly.info' },
                                { type: 'html', subdir: 'html' },
                                { type: 'text-summary'}
                            ]
                        },

                        // web server port
                        port: 9876,
                        // enable / disable colors in the output (reporters and logs)
                        colors: true,
                        browsers: ['PhantomJS'],
                        singleRun: true
                    }
                }
            },
            coveralls: {
                options: {
                    // dont fail if coveralls fails
                    force: true
                },
                main_target: {
                    src: "coverage/lcovonly.info"
                }
            },
            s3: {
                options: {
                    bucket: "croplands-static"
                },
                release: {
                    expand: true,
                    cwd: "croplands/static/",
                    src: "**",
                    dest: "static/"
                },
                dev: {
                    expand: true,
                    cwd: "croplands/static/",
                    src: "**",
                    dest: "dev/static/"
                }
            }
    });

    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-sloc');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks("grunt-coveralls");
//    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-aws');
//    grunt.loadNpmTasks('grunt-invalidate-cloudfront');

// Default task.
    grunt.registerTask('default', ['concat', 'uglify', 'less', 'sloc', 'copy', 'replace', 'invalidate_cloudfront']);

}
;