
var fs = require ('fs');
var async = require ('async');
var Database = require ('./Database');
var MCUID = require ('./MCUID');

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
@property {number} statsInFlight Number of simultaneous file index
    operations to attempt. A low number here prevents hammering the db or 
    starving the event loop, but overly low numbers may reduce parallelism 
    and therefor performance. Default: 50.
*/
var config = { 
    mountPoints:        [],
    fileExtensions:     [],
    trailingExtensions: [
        "gz",
        "tar",
        "tar.gz",
        "zip"
    ],
    refresh:            1000 * 60 * 3, // three minutes
    refreshFuzz:        1000 * 60 * 3,  // three minutes
    heartRate:          1000,
    heartRateFuzz:      1000,
    statsInFlight:      50
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
            async.parallel ([
                function (callback) {
                    Database.getCollection ("files", function (col) {
                        filesCollection = col;
                        callback();
                    });
                },
                function (callback) {
                    Database.getCollection ("directories", function (col) {
                        directoriesCollection = col;
                        callback ();
                    });
                }
            ], callback);
        }
    ], function () {
        console.log ('starting index refresh process'.green);
        heartbeat ();
        console.log ('actively scanning all mountpoints'.green);
        async.each (config.mountPoints, function (point, callback) {
            scan (point, callback, undefined, undefined, true);
        });
        callback ();
    });
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
        fs.stat (rec.p+rec._id, function (err, stats) {
            if (err || !stats)
                return callback();
            callback (rec.p+rec._id, rec.x, rec.s);
        });
    });
};


// recursive
var scan = function (dir, callback, stats, rec) {
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
        
        if (rec && rec.m == stats.mtime.getTime())
            // directory is unmodified
            return callback (true);
        
        // directory needs a fresh scan
        var novelDir;
        if (!rec) {
            console.log ("Indexed new directory ".white+dir.blue);
            novelDir = true;
        }
        fs.readdir (dir, function (err, files) {
            if (err) {
                console.log ('ERROR: sudden fs read error. Expected directory at '+dir);
                return callback (false);
            }

            directoriesCollection.update (
                {_id:dir},
                {$set:{
                    m:          stats.mtime.getTime(),
                    n:          (new Date()).getTime() + 
                                config.refresh + 
                                Math.floor (
                                    config.refreshFuzz * Math.random()
                                ),
                    l:          files
                }},
                {safe:true, upsert:true},
                function (err, confirm) {
                    if (err) {
                        console.log ('ERROR: db failure while writing to "directories"');
                        console.log (err);
                        console.log (err.stack);
                    }
                    if (!confirm) // somebody preempted this update, just forget about it
                        return;
                    if (!files || !files.length)
                        return callback (true);
                    
                    // use the old and new file lists to target only new or removed files
                    var old = rec ? rec.l || [] : [];
                    var reg = {};
                    var add = [];
                    for (var i=0,j=old.length; i<j; i++) 
                        reg[old[i]] = true;
                    for (var i=0,j=files.length; i<j; i++) {
                        var name = files[i];
                        if (!reg[name]) {
                            add.push (name);
                            delete reg[name];
                        }
                    }
                    var drop = Object.keys(reg);

                    async.eachLimit (add, config.statsInFlight, function (fname, callback) {
                        fs.stat (dir + fname, function (err, stats) {
                            if (err || !stats) {
                                console.log ('ERROR: stat failed for '.red + (dir+fname).blue);
                                return callback();
                            }
                            if (stats.isDirectory())
                                // recurse into directory
                                return scan (dir + fname + '/', callback, stats, undefined);
                            
                            // evaluate the file extension
                            // trailing extensions first
                            var fileExtension = "";
                            var workingName = fname.toLowerCase();
                            for (var i=0,j=config.trailingExtensions.length; i<j; i++) {
                                var extension = config.trailingExtensions[i];
                                if (workingName.slice (-1 * extension.length) == extension) {
                                    // trailing extension matched
                                    fileExtension += '.'+extension;
                                    workingName = workingName.slice (0, -1 * (extension.length+1));
                                    break;
                                }
                            }
                            // primary extensions second
                            for (var i=0,j=config.fileExtensions.length; i<j; i++) {
                                var extension = config.fileExtensions[i];
                                if (workingName.slice (-1 * extension.length) == extension) {
                                    // primary extension matched - we have a valid file!
                                    var fileData = {p:dir, x:extension, s:stats.size};
                                    MCUID (function (id) {
                                        if (!id) {
                                            console.log (("Could not create a new MCUID for "+dir+fname).red);
                                        } else
                                            fileData.id = id;
                                        console.log ('  Indexed new file '.white+(dir+fname).blue);
                                        filesCollection.update (
                                            {_id:workingName},
                                            {$set:fileData},
                                            {upsert:true, safe:true},
                                            function (err) {
                                                if (err) {
                                                    console.log ('ERROR: db failure while writing to "files"'.red);
                                                    console.log (err);
                                                    console.log (err.stack);
                                                }
                                                callback ();
                                            }
                                        );
                                    });
                                    return; // IMPORTANT
                                }
                            }
                        });
                    }, function () {
                        // this is the final end of a successful scan
                        callback (true);
                    });
                    
                    async.eachLimit (drop, config.statsInFlight, function (fname, callback) {
                        fs.stat (dir + fname, function (err, stats) {
                            if (!err && stats && stats.isDirectory()) {
                                dropDir (dir+fname+'/');
                                return callback();
                            }
                            filesCollection.remove ({_id:fname});
                            callback();
                        });
                    });
                });
            }
        );
    });
};



var dropDir = function (dir) {
    fs.readdir (dir, function (err, files) {
        if (err) {
            console.log ('cannot read mount point'.red);
            return;
        }
        async.eachLimit (files, config.statsInFlight, function (fname) {
            fs.stat (dir+fname, function (err, stats) {
                if (err || !stats) {
                    console.log ('cannot stat file '.red + (dir+fname).yellow)
                }
                if (stats.isDirectory()) {
                    directoriesCollection.remove ({_id:fname});
                    dropDir (dir + fname + '/');
                    return;
                }
                filesCollection.remove ({_id:fname});
            });
        });
    })
};


// schedules rescans of directories
var heartbeat = function () {
    var now = (new Date()).getTime();
    var next = now + config.refresh + Math.floor(config.refreshFuzz * Math.random());
    // initially grab the job by 
    directoriesCollection.findAndModify (
        {n:{$lt:now}},
        {},
        {$set:{
            n:      next
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
    getPath:            getPath
};
