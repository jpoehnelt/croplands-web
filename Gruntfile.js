module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
            // Metadata.
            pkg: grunt.file.readJSON('package.json'),
            banner: '/*! <%= pkg.title || pkg.name %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
                '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
                '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
                '*/\n',
            // Task configuration.
            concat: {
                options: {
                    separator: ';\n'
                },
                dist: {
                    src: ['app/scripts/lib/*.js', 'app/scripts/utilities/*.js', 'app/scripts/app/config.js', 'app/scripts/services/*.js', 'app/scripts/filters/*.js', 'app/scripts/controllers/*.js', 'app/scripts/directives/*.js'],
                    dest: 'app/scripts/app.<%= pkg.version %>.js'
                }
            },
            uglify: {
                options: {
                    mangle: true,
                    banner: '<%= banner %>'
                },
                dist: {
                    src: '<%= concat.dist.dest %>',
                    dest: 'app/scripts/app.<%= pkg.version %>.min.js'
                }
            },
            less: {
                development: {
                    options: {
                    },
                    files: {
                        // target.css file: source.less file
                        "app/styles/main.<%= pkg.version %>.css": "app/styles/less/bootstrap.less"
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
                        "app/styles/main.<%= pkg.version %>.min.css": "app/styles/less/bootstrap.less"
                    }
                }
            },

            watch: {
                js: {
                    files: ['app/scripts/lib/*.js', 'app/scripts/utilities/*.js', 'app/scripts/app/config.js', 'app/scripts/services/*.js', 'app/scripts/filters/*.js', 'app/scripts/controllers/*.js', 'app/scripts/directives/*.js'],
                    tasks: ['concat', 'uglify', 'copy']
                },
                less: {
                    files: ['app/styles/less/*', 'app/styles/less/mixins/*'],
                    tasks: ['less', 'copy']
                },
                all: {
                    files: ['Gruntfile.js', 'package.json'],
                    tasks: ['replace', 'concat', 'uglify', 'less', 'copy']
                },
                index: {
                    files: ['app/index.html'],
                    tasks: ['replace']
                },
                karma: {
                    files: ['app/scripts/*', 'tests/*.js'],
                    tasks: ['karma:unit:continuous']
                },
                upload: {
                    files: ['dist/**'],
                    tasks: ['s3:dev']
                }
            },
            karma: {
                continuous: {
                    options: {
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
                            'app/scripts/lib/*.js',
                            'app/scripts/utilities/*.js',
                            'app/scripts/app/config.js',
                            'app/scripts/services/*.js',
                            'app/scripts/filters/*.js',
                            'app/scripts/controllers/*.js',
                            'app/scripts/directives/*.js',
                            'tests/*.js'
                        ],
                        preprocessors: {
                            'app/scripts/!(*lib)/*.js': ['coverage']
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
            replace: {
                index: {
                    options: {
                        patterns: [
                            {
                                match: 'version',
                                replacement: '<%= pkg.version %>'
                            }
                        ]
                    },
                    files: [
                        {expand: true, cwd: 'app/', src: ['index.html'], dest: 'dist/'}
                    ]
                }
            },
            copy: {
                main: {
                    files: [
                        // includes files within path
                        {expand: true, cwd: 'app/styles/', src: ['*.css'], dest: 'dist/css/'},
                        {expand: true, cwd: 'app/scripts/', src: ['*.js'], dest: 'dist/js/'},
                        {expand: true, cwd: 'app/assets/', src: ['*'], dest: 'dist/images/', filter: 'isFile'},
                        {expand: true, cwd: 'app/views/', src: ['**'], dest: 'dist/templates/'}
                    ]
                }
            },
            s3: {
                options: {
                    bucket: "croplands"
                },
                release: {
                    expand: true,
                    cwd: "dist/",
                    src: "**"
                },
                dev: {
                    options: {
                        bucket: "croplands-dev"
                    },
                    expand: true,
                    cwd: "dist/",
                    src: "index.html"
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
            }
        }
    )
    ;
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-sloc');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks("grunt-coveralls");
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-aws');

// Default task.
    grunt.registerTask('default', ['concat', 'uglify', 'less', 'sloc', 'copy', 'replace']);

}
;