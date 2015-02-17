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
                src: ['app/scripts/lib/*.js', 'app/scripts/utilities/*.js', 'app/scripts/app/config.js', 'app/scripts/services/*.js', 'app/scripts/filters/*.js', 'app/scripts/controllers/*.js', 'app/scripts/directives/*.js', 'app/scripts/templates/*.js'  ],
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
        sloc: {
            'source': {
                files: {
                    './': ['app/scripts/app/*.js',
                        'app/scripts/controllers/*.js',
                        'app/scripts/directives/*.js',
                        'app/scripts/filters/*.js',
                        'app/scripts/services/*.js',
                        'app/partials/*.html',
                        'gfsad/views/*.html',
                        'app/styles/app_v2.css']
                }
            }
        },
        karma: {
            unit: {
                configFile: 'karma.conf.js',
                background: true,
                singleRun: true
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
        aws: grunt.file.readJSON("secrets.json"),
        s3: {
            options: {
                accessKeyId: "<%= aws.key %>",
                secretAccessKey: "<%= aws.secret %>",
                bucket: "<%= aws.bucket %>"
            },
            release: {
                expand: true,
                cwd: "dist/",
                src: "**"
            },
            dev: {
                options: {
                    bucket: "<%= aws.bucketdev %>"
                },
                expand: true,
                cwd: "dist/",
                src: "index.html"
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
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-aws');

    // Default task.
    grunt.registerTask('default', ['concat', 'uglify', 'less', 'sloc', 'copy', 'html2js', 'replace']);

};