

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

console.log ('\n\n\
    Testing Masspec Glue Server\n\
......................................................................................'.blue
);
fs.readFile (localdir + '/tests/testconf.json', {encoding:"UTF8"}, function (err, configFileStr) {
    if (err || !configFileStr) {
        console.log ("Configuration not found.\n".red + (localdir + '/testconf.json').blue);
        process.exit();
    }
    configFileStr = configFileStr.replace (/\/\/.*/g, '');
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
                tryServer ("get", "/data/twertwergbhndgf.mzxml", function (data) {
                    if (data !== '<thing>twertwergbhndgf</thing>\n') {
                        console.log (data);
                        console.log ('ERROR - failed to return correct data file (mount0/able/twertwergbhndgf.mzxml).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/drfdfgdfgdbnnbn.xml", function (data) {
                    if (data !== '<thing>drfdfgdfgdbnnbn</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount3/able/zebra/drfdfgdfgdbnnbn.xml).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/udgfhjdfgdr6yudrtf.xml", function (data) {
                    if (data !== '<thing>udgfhjdfgdr6yudrtf</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount2/able/yoke/udgfhjdfgdr6yudrtf.xml).'.red);
                        process.exit ();
                    }
                    callback ();
                });
            },
            function (callback) {
                tryServer ("get", "/data/uer6tyudgfhfg.xml", function (data) {
                    if (data !== '<thing>uer6tyudgfhfg</thing>\n') {
                        console.log ('ERROR - failed to return correct data file (mount0/able/yoke/uer6tyudgfhfg.xml).'.red);
                        process.exit ();
                    }
                    callback ();
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
                console.log ('   ...waiting for refresh job test...'.white)
                setTimeout (function () {
                    async.each (ids, function (id, callback) {
                        tryServer ("get", "/data/"+id+".xml", function (data) {
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
            }
        ], function () {
            console.log ('\n\n\
......................................................................................\n\
    All Tests Completed Successfully\n'.blue
            );
            
            setTimeout (function(){
                process.exit();
            }, 500);
        });
    });
});
