
var http = require ('http');
require ('./DataUtils'); // patches merging etc. onto Object
var cluster = require ('cluster');
require ('colors');

var FileCache = require ('./FileCache');
var endpoints = {
    index:                  require ('./index'),
    data:                   require ('./data')
};

/**
Index and host LCMS output files.
@name masspec-glue
@module
*/
/**
@name configuration
@memberOf masspec-glue
@class
@property {number} port Listen on all incoming ports with the chosen port 
    number.
@property endpoints {Object.<string,string>} Override the URLs used by service 
    endpoints, by mapping the override name to the default name. Note 
    that it is invalid to use any default endpoint as an override.
@property {Number} processes Override the number of times to prefork the server.
    The default is one child fork for each available CPU core.
@property {FileCache.configuration} FileCache Configuration options for the 
    retrieval and caching of files.
@property {Object} interface Configuration documents for the service endpoints, 
    mapped by either the default or overridden endpoint name.
*/
var config = {
    port:           9001,
    endpoints:      {},
    processes:      require('os').cpus().length,
    FileCache:     {},
    interface:      {}
};

// for normalizing interface configs to one, reliable endpoint name
var interfaceConfigs = {
    index:              {},
    getFilePaths:       {}
};

/**
Set configuration options for the masspec-glue server.
@param {masspec-glue.configuration} newConf
*/
var configure = function (newConf) {
    config.merge (newConf);
    if (newConf.interface) // update the canonical interface config docs 
        for (var interfaceName in newConf.interface)
            if (interfaceConfigs[interfaceName])
                interfaceConfigs[interfaceName].merge (
                    newConf.interface[interfaceName]
                );
            else if (
                config.endpoints[interfaceName] && 
                interfaceConfigs[config.endpoints[interfaceName]]
            )
                interfaceConfigs[conf.endpoints[interfaceName]].merge (
                    newConf.interface[interfaceName]
                );
            else
                console.log ((
                    'cannot configure unknown endpoint "' +
                    interfaceName + 
                    '"'
                ).red);
    
    if (cluster.isMaster)
        return; // just store the config for now
    
    // child clusters should propogate config updates
    if (newConf.filesystem)
        FileCache.configure (newConf.filesystem);
    if (newConf.interface) // update the canonical interface config docs 
        for (var interfaceName in newConf.interface)
            if (endpoints[interfaceName])
                endpoints[interfaceName].configure (newConf[interfaceName]);
            else if (
                config.endpoints[interfaceName] && 
                endpoints[config.endpoints[interfaceName]]
            )
                endpoints[config.endpoints[interfaceName]].configure (
                    newConf[interfaceName]
                );
            else
                console.log ((
                    'cannot configure unknown endpoint "' +
                    interfaceName + 
                    '"'
                ).red);
};

/**
Finalize the configuration, do all necessary initial setup, prefork, and 
    listen on the configured socket.
@param {function} callback
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
        
        var waiting = config.processes;
        for (var i=0; i<config.processes; i++) {
            var worker = cluster.fork();
            worker.on ('message', function (msg) {
                if (msg == "online") {
                    if (--waiting) return;
                    console.log (
                      '\n=========================== '.green +
                        'Masspec Glue Server Online'.white + 
                        '===========================\n'.green
                    );
                    if (callback)
                        callback ();
                }
            });
            worker.send (config);
        }
        return;
    }
    
    // child forks need to propogate the start signal
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
