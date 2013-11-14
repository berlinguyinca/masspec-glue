
var fs = require ('fs');
var async = require ('async');
var Mongo = require ('mongodb');

/**
Associates unique filenames with file paths on the system. Performs 
    directory scans and polls. Persists path associations and modification 
    timestamps of intermediate directories to prevent unnecessary rescans.
@name FileCache
@module
*/
/**
@class configuration
@memberOf FileCache
@property {string} dbPath Local or absolute filepath at which the path 
    cache database is stored. If multiple application servers are used, they 
    should share as few databases as possible - WARNING: sqlite3 and NFS 
    don't get along. Multiple application servers can feel free to build 
    their own copies of the cache.
@property {Array.<string>} mountPoints Local or absolute filepath(s) within 
    which directories and files are to be indexed. The indexed filesystem 
    is a union of these directories.
@property {Array.<string>} fileExtensions File extensions to cache, without 
    leading dot. Default: ["cdf","txt","mzXml"]
@property {Array.<string>} trailingExtensions Trailing file extensions to 
    ignore when evaluating file extensions. 
    Default: ["gz","tar","tar.gz","zip"]
@property {number} refresh Number of milliseconds to wait before stat-ing 
    an indexed directory again. Default: three minutes.
@property {number} refreshFuzz Maximum number of milliseconds to be 
    randomly added to the poll time. Helps prevent big clusters of stat
    jobs. Default: three minutes.
@property {number} heartRate Minimum number of milliseconds to wait before 
    repolling the database for directories in need of a rescan. Default:
    1000ms.
@property {number} heartRateFuzz Maximum number of milliseconds to be 
    randomly added to the heartRate each cycle. Helps multiple processes 
    avoid bothering the database at the same time. Default: 1000ms.
*/
config = {
    databaseIP:         "127.0.0.1",
    databasePort:       27017,
    databaseName:       "masspec-glue",
    mountPoints:        [],
    fileExtensions:     [
        "cdf",
        "txt",
        "mzXml"
    ],
    trailingExtensions: [
        "gz",
        "tar",
        "tar.gz",
        "zip"
    ],
    refresh:            1000 * 60 * 3, // three minutes
    refreshFuzz:        1000 * 60 * 3,  // three minutes
    heartRate:          1000,
    heartRateFuzz:      1000
};

/**
Set configuration options.
@param {FileCache.configuration} newConf
*/
var configure = function (newConf) {
    config.merge (newConf);
};

var filesCollection;
var directoriesCollection;
/**
Access the database file. Begin any necessary scan operations.
@param {function} callback No arguments.
*/
var start = function (callback) {
    async.parallel ([
        // ensure trailing slashes on mountpoints
        // do all the mountpoints exist?
        function (callback) {
            var cleanup = [];
            async.each (config.mountPoints, function (point, callback) {
                fs.stat (point, function (err, stats) {
                    if (err || !stats) {
                        console.log (
                            'failed to find mountpoint at '.yellow +
                            point.blue
                        );
                    } else {
                        console.log (
                            'found mountpoint at '.green +
                            point.blue
                        );
                    }
                    if (point[point.length-1] != '/')
                        cleanup.push (point);
                    callback ();
                });
            }, function () {
                // fix mount points without trailing slash
                for (var i=0,j=cleanup.length; i<j; i++)
                    config.mountPoints.splice (
                        config.mountPoints.indexOf (cleanup[i]),
                        1
                    );
                for (var i=0,j=cleanup.length; i<j; i++)
                    config.mountPoints.push (cleanup[i] + '/');
                
                callback ();
            });
        },
        // setup the database
        function (callback) {
            var dbsrv = new Mongo.Server (config.databaseIP, config.databasePort, {});
            var db = new Mongo.Db (config.databaseName, dbsrv, {journal:false});
            db.open (function () {
                async.parallel ([
                    function (callback) {
                        db.collection ("files", function (err, col) {
                            if (err) {
                                console.log ("Database connection error.".red);
                                process.exit();
                            }
                            filesCollection = col;
                            callback();
                        });
                    },
                    function (callback) {
                        db.collection ("directories", function (err, col) {
                            if (err) {
                                console.log ("Database connection error.".red);
                                process.exit();
                            }
                            directoriesCollection = col;
                            directoriesCollection.ensureIndex ({next:1}, function (err) {
                                if (err) {
                                    console.log ('ERROR - could not ensure database index'.red);
                                    process.exit();
                                }
                                callback ();
                            });
                        });
                    }
                ], callback);
            });
        }
    ], function () {
        console.log ('starting index refresh process'.green);
        heartbeat ();
        callback ();
    });
};

/**
Add a directory expected to be found in one of the 
    {@link FileCache_configuration#mountpoints|configured mountpoints} as 
    an indexed directory. Recursively scan for valid files. Cache file
    path associations and directory modification timestamps. Hit the 
    callback when existence of the target directory is confirmed (or not).
@param {string} dir
@param {function} callback Boolean argument indicates whether directory 
    exists.
*/
var indexDirectory = function (dir, callback) {
    async.each (config.mountPoints, function (point, callback) {
        scan (point + dir, callback, undefined, undefined, true);
    }, callback);
};

/**
Get the full system path of a file by unique filename.
@param {string} id
@param {function} callback
*/
var getPath = function (id, callback) {
    filesCollection.findOne ({_id:id},function (err, rec) {
        // verify that the file is still there
        if (err || !rec)
            return callback();
        fs.stat (rec.path, function (err, stats) {
            if (err || !stats)
                return callback();
            callback (rec.path, rec.size);
        });
    });
};


// recursive
var scan = function (dir, callback, stats, rec, force) {
    if (dir[dir.length-1] != '/')
        dir += '/';
    var rec;
    // stat the local dir if not provided, compare to db record for dir
    var ops = [];
    if (!stats) ops.push (function (callback) {
        fs.stat (dir, function (err, s) { if (!err) stats = s; callback(); });
    });
    if (!rec) ops.push (function (callback) {
        directoriesCollection.findOne ({_id:dir}, function (err, doc) {
            if (err) console.log ("db access problem".red);
            rec = doc;
            callback();
        });
    });
    
    async.parallel (ops, function () {
        if (!stats)
            return callback (false);
        
        if (!force && rec && rec.m == stats.mtime.getTime())
            // directory is unmodified
            return callback (true);
        
        // directory needs a fresh scan
        directoriesCollection.update (
            {_id:dir},
            {$set:{
                m:          stats.mtime.getTime(),
                next:       (new Date()).getTime() + 
                            config.refresh + 
                            Math.floor (
                                config.refreshFuzz * Math.random()
                            )
            }},
            {safe:true, upsert:true},
            function (err) {
                if (err) {
                    console.log ('db returned error while writing to "directories"');
                    console.log (err);
                }
                fs.readdir (dir, function (err, files) {
                    if (err) {
                        console.log ('sudden fs read error - is '+dir+' a directory?');
                        return callback (false);
                    }
                    
                    if (!files || !files.length)
                        return callback (true);
                    
                    // search for data files and directories
                    async.each (files, function (fname, callback) {
                        fs.stat (dir + fname, function (err, stats) {
                            if (!stats) {
                                console.log ('no stats for ' + dir + fname);
                                return callback();
                            }
                            if (stats.isDirectory())
                                // recurse into directory
                                return scan (dir + fname + '/', callback, stats, undefined, force);
                            
                            // evaluate the file extension
                            // trailing extensions first
                            var workingName = fname;
                            for (var i=0,j=config.trailingExtensions.length; i<j; i++) {
                                var extension = config.trailingExtensions[i];
                                if (workingName.slice (-1 * extension.length) == extension) {
                                    // trailing extension matched
                                    workingName = workingName.slice (0, -1 * (extension.length+1));
                                    break;
                                }
                            }
                            // primary extensions second
                            for (var i=0,j=config.fileExtensions.length; i<j; i++) {
                                var extension = config.fileExtensions[i];
                                if (workingName.slice (-1 * extension.length) == extension) {
                                    // primary extension matched - we have a valid file!
                                    workingName = workingName.slice (0, -1 * (extension.length+1));
                                    filesCollection.update (
                                        {_id:workingName},
                                        {$set:{path:dir+fname, size:stats.size}},
                                        {upsert:true, safe:true},
                                        function (err) {
                                            if (err) {
                                                console.log ('db had an error while writing to "files"');
                                                console.log (err);
                                            }
                                            callback ();
                                        }
                                    );
                                    return;
                                }
                            }
                        });
                    }, function () {
                        // this is the final end of a successful scan
                        callback (true);
                    });
                });
            }
        );
    });
};

/**
Drop a directory from the index. Cancel all scheduled polls and rescans.
    Eliminate records from the database file.
@param {string} dir
*/
var dropDirectory = function (dir, callback) {
    async.each (config.mountPoints, function (point, callback) {
        destroy (point + dir, callback);
    }, callback);
};

var destroy = function (dir, callback) {
    if (dir[dir.length-1] != '/')
        dir += '/';
    fs.readdir (dir, function (err, files) {
        if (err)
            return callback ();
        
        directoriesCollection.remove ({_id:dir});
        
        async.each (files, function (file, callback) {
            fs.stat (dir + file, function (err, stats) {
                if (err || !stats)
                    return callback ();
                if (stats.isDirectory())
                    return destroy (dir+file+'/', callback);
                
                // evaluate the file extension
                // trailing extensions first
                var workingName = file;
                for (var i=0,j=config.trailingExtensions.length; i<j; i++) {
                    var extension = config.trailingExtensions[i];
                    if (workingName.slice (-1 * extension.length) == extension) {
                        // trailing extension matched
                        workingName = workingName.slice (0, -1 * (extension.length+1));
                        break;
                    }
                }
                // primary extensions second
                for (var i=0,j=config.fileExtensions.length; i<j; i++) {
                    var extension = config.fileExtensions[i];
                    if (workingName.slice (-1 * extension.length) == extension) {
                        // primary extension matched - we have a valid file!
                        workingName = workingName.slice (0, -1 * (extension.length+1));
                        filesCollection.remove ({_id:workingName});
                        return callback ();
                    }
                }
                callback ();
            });
        }, callback);
    });
};

// schedules rescans of directories
var heartbeat = function () {
    var now = (new Date()).getTime();
    var next = now + config.refresh + Math.floor(config.refreshFuzz * Math.random());
    // initially grab the job by 
    directoriesCollection.findAndModify (
        {next:{$lt:now}},
        {},
        {$set:{
            next:   next
        }},
        function (err, rec) {
            if (err) console.log ("db access problem".red, err);
            if (!rec) {
                // either the database is empty or everything is already 
                // scheduled for a rescan. Wait 1~2 seconds and check again.
                setTimeout (
                    heartbeat, 
                    config.heartRate +  Math.floor(config.heartRateFuzz * Math.random())
                );
                return;
            }
            // start the rescan
            scan (rec._id, heartbeat, undefined, rec);
        }
    );
};



module.exports = {
    configure:          configure,
    start:              start,
    indexDirectory:     indexDirectory,
    dropDirectory:      dropDirectory,
    getPath:            getPath
};