'use strict';

module.exports = function(grunt) {
    // Load in all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                ignores: ['node_modules/**/*.js', 'build/**/*']
            },
            all: {
                files: {
                    src: ['Gruntfile.js', 'src/**/*.js']
                }
            }
        },

        watch: {
            all: {
                files: ['Gruntfile.js', 'src/**/*.js', 'examples/**/*.js'],
                tasks: ['jshint:all']
            },
            debug: {
                files: ['Gruntfile.js', 'src/**/*.js'],
                tasks: ['jshint:all', 'browserify:debug']
            },
            release: {
                files: ['Gruntfile.js', 'src/**/*.js'],
                tasks: ['jshint:all', 'browserify:release']
            }
        },

        browserify: {
            debug: {
                files: {
                    'build/psykick2d-debug.js': ['src/browser.js']
                },
                options: {
                    debug: true,
                    alias: [
                        'pixi.js/bin/pixi.dev.js:pixi.js'
                    ]
                }
            },
            release: {
                files: {
                    'build/psykick2d.js': ['src/browser.js']
                },
                options: {
                    debug: false
                }
            }
        }
    });

    grunt.registerTask('default', 'jshint:all');

    String.prototype.replaceAt = function(index, character) {
        return this.substr(0, index) + character + this.substr(index + character.length);
    };

    function formatName(name) {
        // Special case for the GFX namespace
        if (name === 'gfx') {
            return 'GFX';
        }

        name = name.replace('.js', '');
        name = name.replaceAt(0, name[0].toUpperCase());
        name = name.replace(/-[a-z]/ig, function(match) {
            return match[1].toUpperCase();
        });
        return name;
    }

    grunt.registerTask('build', 'Builds Psykick2D for the browser', function(type) {
        grunt.task.run('jshint:all');

        // Create the index.js based on the source
        var buildOptions = require('./config.json').build,
            psykick = {},
            indexContents = '';

        grunt.file.expand({ cwd: './src' }, ['**/**']).forEach(function(filepath) {
            if (['', 'index.js', 'browser.js'].indexOf(filepath) !== -1) {
                return;
            }

            var pathParts = filepath.split('/');
            // Skip the folders
            if (pathParts[pathParts.length - 1].indexOf('.js') === -1 || filepath === 'index.js') {
                return;
            }

            var moduleName = formatName(pathParts[pathParts.length - 1]),
                activeNamespace = psykick;
            for (var i = 0, len = pathParts.length; i < len - 1; i++) {
                var namespace = formatName(pathParts[i]);
                if (!activeNamespace[namespace]) {
                    activeNamespace[namespace] = {};
                }
                activeNamespace = activeNamespace[namespace];
            }

            activeNamespace[moduleName] = 'require(\'./' + filepath + '\')';
        });

        // Store the actual, final index contents
        indexContents = JSON.stringify(psykick, null, 4).replace(/"/g, '');

        for (var i = 0, len = buildOptions.exclude.length; i < len; i++) {
            var namespaces = buildOptions.exclude[i].split('.'),
                activeNamespace = psykick,
                key;
            while(namespaces.length > 0) {
                key = namespaces.shift();
                if (!activeNamespace[key]) {
                    // Break out of the loop for a bad reference
                    console.log('Bad reference: "' + key + '"');
                    namespaces = [];
                    continue;
                } else if (namespaces.length === 0) {
                    delete activeNamespace[key];
                    continue;
                }

                activeNamespace = activeNamespace[key];
            }
        }

        // Save the custom build
        var customBuild = JSON.stringify(psykick, null, 4).replace(/"/g, '');
        grunt.file.write('./src/index.js', 'module.exports = ' + customBuild + ';');

        // Stuff it all in to one file
        if (type === undefined) {
            grunt.task.run('browserify:debug', 'browserify:release');
        } else {
            grunt.task.run('browserify:' + type);
        }

        // Save the Psykick2D index
        grunt.file.write('./src/index.js', 'module.exports = ' + indexContents + ';');
    });
};