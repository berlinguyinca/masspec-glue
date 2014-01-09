
var http = require ('http');
var async = require ('async');
var cluster = require ('cluster');
require ('./DataUtils'); // patches merging etc. onto Object
require ('colors');

var FileCache = require ('./FileCache');
var Database = require ('./Database');
var endpoints = {
    data:                   require ('./data'),
    stat:                   require ('./stat')
};

/*      @module masspec_glue
    Index and serve Metbolomics Core raw data files.
*/
/*      @class Configuration
@Number port Listen on all incoming ports with the chosen port 
    number.
@Object endpoints 
    Override the URLs used by service endpoints, by mapping the 
    override name to the default name. Note that it is invalid 
    to use any default endpoint as an override.
@Number processes 
    Override the number of times to prefork the server. The 
    default is one child fork for each available CPU core.
@masspec_glue.FileCache.Configuration FileCache 
    Configuration options for the retrieval and caching of 
    files.
@masspec_glue.Database.Configuration Database 
    Configuration options for the mongodb persistence layer.
*/
var config = {
    port:           9001,
    endpoints:      {},
    processes:      require('os').cpus().length,
    FileCache:      {},
    Database:       {}
};

// for normalizing interface configs to one, reliable endpoint name
var interfaceConfigs = {
    getFilePaths:       {}
};

/*      @Function configure
    Set configuration options for the masspec-glue server.
@argument/masspec-glue.Configuration newConf
*/
var configure = function (newConf) {
    config.merge (newConf);
    
    if (cluster.isMaster)
        return; // just store the config for now
    
    // child clusters should propogate config updates
    if (newConf.FileCache)
        FileCache.configure (newConf.FileCache);
    if (newConf.Database)
        Database.configure (newConf.Database)
};

/*      @Function start
    Finalize the configuration, do all necessary initial setup, 
    prefork, and listen on the configured socket.
@argument/Function callback
*/
var start = function (callback) {
    if (cluster.isMaster) {
        cluster.setupMaster ({
            exec:       module.filename
        });
        console.log (
            'Starting masspec-glue server at port '.white +
            config.port.toString().blue +
            '\nPreforking to '.white +
            config.processes.toString().blue +
            ' processes.'.white
        );

        async.timesSeries (config.processes, function (n, callback) {
            console.log (
                '\n\n____WORKER_'.blue + 
                n.toString().blue +
                '__________________________________________________________________________'.blue
            );
            var tl = console.log;
            console.log = function () {
                var t = ["    "];
                t.push.apply (t, arguments);
                return tl.apply (console, t);
            };
            var worker = cluster.fork();
            worker.on ('message', function () {
                console.log = tl;
                console.log ('______________________________________________________________________________________'.blue);
                callback ();
            });
            worker.send (config);
        }, function () {
            console.log ("\
===================================================================\n\
                   masspec_glue server running\n\
===================================================================\n\
".green
            );
            callback ();
        });
        return;
    }
    
    // child forks need to propogate the start signal
    Database.start (function () {
        FileCache.start (function(){
            var waiting = 0;
            for (var interfaceName in endpoints) {
                waiting++;
                endpoints[interfaceName].start (function(){
                    if (--waiting)
                        return; // more endpoints working
                    if (callback) callback();
                });
            }
            
            // finalize endpoint overrides
            for (var override in config.endpoints) {
                var old = config.endpoints[override];
                if (endpoints[old]) {
                    console.log (
                        'overriding endpoint "'.white +
                        old.blue + 
                        '" with new endpoints "'.white +
                        override.blue
                    );
                    endpoints[override] = endpoints[old];
                    delete endpoints[old];
                }
            }
        });
    });
};


// finally - listen for configurations to be sent from a master process
process.on ('message', function (newConf) {
    configure (newConf);
    start (function(){
        var httpserver = http.createServer (function (request, response) {
            for (var point in endpoints)
                if (request.url.slice (1, point.length+1) == point) {
                    endpoints[point].react (request, response);
                    return;
                }
            response.writeHead (404, {
                "content-type":     "text/plain"
            });
            response.write ("404 Not Found");
            response.end ();
        });
        httpserver.listen (config.port);
        console.log (
            'forked server listening on port '.green + 
            config.port.toString().blue
        );
        process.send ("online");
    });
});

module.exports = {
    configure:      configure,
    start:          start
};
