/*global module:false*/
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
                src: ['app/js/lib/*.js', 'app/js/utilities/*.js', 'app/js/app/config.js', 'app/js/services/*.js', 'app/js/filters/*.js', 'app/js/controllers/*.js', 'app/js/directives/*.js'  ],
                dest: 'app/js/app.js'
            }
        },
        uglify: {
            options: {
                mangle: true,
                banner: '<%= banner %>'
            },
            dist: {
                src: '<%= concat.dist.dest %>',
                dest: 'app/js/app.min.js'
            }
        },
        less: {
            development: {
                options: {
                },
                files: {
                    // target.css file: source.less file
                    "app/css/main.<%= pkg.version %>.css": "app/css/less/bootstrap.less"
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
                    "app/css/main.<%= pkg.version %>.min.css": "app/css/less/bootstrap.less"
                }
            }
        },

        watch: {
            js: {
                files: ['<%= concat.dist.src %>', 'Gruntfile.js', 'package.json'],
                tasks: ['concat', 'uglify']
            },
            less: {
                files: ['app/css/less/*', 'app/css/less/mixins/*', 'Gruntfile.js', 'package.json'],
                tasks: ['less']
            },
            //run unit tests with karma (server needs to be already running)
            karma: {
                files: ['app/js/*', 'tests/*.js'],
                tasks: ['karma:unit:run'] //NOTE the :run flag
            }
        },
        sloc: {
            'source': {
                files: {
                    './': ['app/js/app/*.js',
                        'app/js/controllers/*.js',
                        'app/js/directives/*.js',
                        'app/js/filters/*.js',
                        'app/js/services/*.js',
                        'app/partials/*.html',
                        'gfsad/templates/*.html',
                        'app/css/app_v2.css']
                }
            }
        },
        karma: {
            unit: {
                configFile: 'karma.conf.js',
                background: true,
                singleRun: false
            },
            continuous: {
                configFile: 'karma.conf.js',
                singleRun: true
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
    });
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-sloc');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks("grunt-coveralls");

    // Default task.
    grunt.registerTask('default', ['concat', 'uglify', 'less', 'sloc']);

};