

var async = require ('async');
var http = require ('http');
var fs = require ('fs');
var localdir = require('path').dirname (module.filename).slice (0,-6);
    // last six characters should be /tests
var mg = require ('../main');

var tryServer = function (method, path, callback) {
    var options = {
        host:           "127.0.0.1",
        port:           9001,
        path:           path,
        method:         method
    };
    var request = http.request (options, function (res) {
        var reply = "";
        res.on ('data', function (chunk) {
            reply += chunk;
        });
        res.on ('error', function (e) {
            console.log ('ERROR - server failed mid-reply'.red);
            process.exit ();
        });
        res.on ('end', function () {
            callback (reply);
        });
    });
    request.on ('error', function (err) {
        console.log ('ERROR - cannot query server'.red);
        console.log (err.toString().red);
        console.log (err.stack.red);
        process.exit();
    });
    request.end ();
};

console.log (
    '========================== '.green +
    'Testing Masspec Glue Server '.white +
    '==========================\n'.green
);
fs.readFile (localdir + '/tests/testconf.json', function (err, configFileStr) {
    if (err || !configFileStr) {
        console.log ("Configuration not found.\n".red + (localdir + '/testconf.json').blue);
        process.exit();
    }
    
    mg.configure (JSON.parse (configFileStr, function (key, val) {
        if (!(val instanceof Array)) return val;
        var match;
        for (var i=0,j=val.length; i<j; i++)
            if (match = val[i].match (/(^|[^\\])\$LIBDIR/)) {
                var cut = Math.max (0,match.index-1);
                var cut = match.index ? match.index + 1 : 0;
                val[i] = 
                    val[i].slice (0,cut) + 
                    localdir +
                    val[i].slice (cut+(cut ? 7 : match[0].length));
            }
        return val;
    }));
    
    mg.start (function () {
        async.series ([
            function (callback) {
                tryServer ("get", "/data/bogus", function (data) {
                    if (data !== '"data not found"') {
                        console.log ('ERROR - server claims to have non-existent data file.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("post", "/index/able", function (data) {
                    if (data !== '"index ok"') {
                        console.log ('ERROR - server fails to index existing directory.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("post", "/index/able", function (data) {
                    if (data !== '"index ok"') {
                        console.log ('ERROR - server fails to index directory already indexed.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("post", "/index/chezwiz", function (data) {
                    if (data !== '"index not found"') {
                        console.log ('ERROR - server does not fail when indexing non-existent directory.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/twertwergbhndgf", function (data) {
                    if (data !== '<thing>twertwergbhndgf</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount0/able/twertwergbhndgf).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/drfdfgdfgdbnnbn", function (data) {
                    if (data !== '<thing>drfdfgdfgdbnnbn</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount3/able/zebra/drfdfgdfgdbnnbn).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/udgfhjdfgdr6yudrtf", function (data) {
                    if (data !== '<thing>udgfhjdfgdr6yudrtf</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount2/able/yoke/udgfhjdfgdr6yudrtf).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/uer6tyudgfhfg", function (data) {
                    if (data !== '<thing>uer6tyudgfhfg</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount0/able/yoke/uer6tyudgfhfg).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                console.log ('    testing the refresh job. Please wait for a few seconds.'.white);
                tryServer ("post", "/index/baker", function (data) {
                    if (data !== '"index ok"') {
                        console.log ('ERROR - failed to index additional directories.'.red);
                        process.exit ();
                    }
                    tryServer ("post", "/index/baker", function (data) {
                        if (data !== '"index ok"') {
                            console.log ('ERROR - failed to index additional directories.'.red);
                            process.exit ();
                        }
                        tryServer ("post", "/index/charlie", function (data) {
                            if (data !== '"index ok"') {
                                console.log ('ERROR - failed to index additional directories.'.red);
                                process.exit ();
                            }
                            tryServer ("post", "/index/delta", function (data) {
                                if (data !== '"index ok"') {
                                    console.log ('ERROR - failed to index additional directories.'.red);
                                    process.exit ();
                                }
                                callback ();
                            });
                        });
                    });
                });
            },
            function (callback) {
                var now = (new Date()).getTime().toString();
                var ids = [];
                for (var i=0; i<8; i++) {
                    var id = now + (0xffff * Math.random()).toString();
                    ids.push(id);
                    fs.writeFileSync (
                        localdir + "/tests/playground/mount0/able/xray/" + id + ".xml",
                        "<thing>"+id+"</thing>"
                    );
                }
                setTimeout (function () {
                    async.each (ids, function (id, callback) {
                        tryServer ("get", "/data/"+id, function (data) {
                            if (data !== '<thing>'+id+'</thing>') {
                                console.log ('ERROR - failed to load new files.'.red);
                                process.exit ();
                            }
                            fs.unlinkSync (localdir + "/tests/playground/mount0/able/xray/" + id + ".xml");
                            tryServer ("get", "/data/"+id, function (data) {
                                if (data !== '"data not found"') {
                                    console.log ('ERROR - server returned indexed-but-deleted file.'.red);
                                    process.exit ();
                                }
                                callback ();
                            });
                        });
                    }, callback ());
                }, 5000); // 10s
            },
            function (callback) {
                console.log ('refresh job works perfectly. Now removing some indexes.'.white);
                tryServer ("delete", "/index/able/zebra", function (data) {
                    if (data !== '"index deleted"') {
                        console.log ('ERROR - failed to delete an index.'.red);
                        process.exit ();
                    }
                    tryServer ("delete", "/index/charlie", function (data) {
                        if (data !== '"index deleted"') {
                            console.log ('ERROR - failed to delete an index.'.red);
                            process.exit ();
                        }
                        callback ();
                    });
                });
            },
            function (callback) {
                tryServer ("get", "/data/drfdfgdfgdbnnbn", function (data) {
                    if (data !== '"data not found"') {
                        console.log ('ERROR - returned a de-indexed file.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/yudrtfyhudfgch", function (data) {
                    if (data !== '"data not found"') {
                        console.log ('ERROR - returned a de-indexed file.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/ftyu7d67udrftgthe5r", function (data) {
                    if (data !== '"data not found"') {
                        console.log ('ERROR - returned a de-indexed file.'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                console.log ('index deletion works fine. Now add a directory with previously deleted children.'.white);
                tryServer ("post", "/index/able", function (data) {
                    if (data !== '"index ok"') {
                        console.log ('ERROR - failed to re-index a directory'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/drfdfgdfgdbnnbn", function (data) {
                    if (data !== '<thing>drfdfgdfgdbnnbn</thing>\n') {
                        console.log ('ERROR - failed to re-index a file'.red);
                        process.exit ();
                    }
                    callback ();
                });
            }
        ], function () {
            console.log (
              '\n======================= '.green +
                'All Tests Completed Successfully '.white +
                '========================\n'.green
            );
            
            setTimeout (function(){
                process.exit();
            }, 500);
        });
    });
});
