
var fs = require ('fs');
var FileCache = require ('./FileCache');
/**
Retrieves masspec data files by unique id.
@name endpoint_stat
@module
*/
/**
@name configuration
@memberOf endpoint_stat
@class
*/
var config = {
};

/**
Set configuration options.
@param {endpoint_data.configuration} newConf
*/
var configure = function (newConf) {
    config.merge (newConf);
};

var start = function (startCall) {
    process.nextTick (startCall);
};


var skiplen = "/stat/".length;
/**
React to a request, reply and close response.
@param request
@param response
*/
var react = function (request, response) {
    if (request.method.toLowerCase() != "get") {
        var result = '"data invalid verb"';
        response.writeHead (404, {
            "Content-Type":             "application/json",
            "Content-Length":           result.length
        });
        response.end (result);
        return;
    }
    
    var id = request.url.slice (skiplen);
    FileCache.getPath (id, function (path, ext, size) {
        if (!path) {
            var result = '"data not found"';
            response.writeHead (404, {
                "Content-Type":             "application/json",
                "Content-Length":           result.length
            });
            response.end (result);
            return;
        }
        
        
        fs.stat (path, function (err, stats) {
            if (err || !stats) {
                var result = '"data not found"';
                response.writeHead (404, {
                    "Content-Type":             "application/json",
                    "Content-Length":           result.length
                });
                response.end (result);
                return;
            }
            
            var output = JSON.stringify ({
                size:           stats.size,
                created:        stats.ctime.getTime(),
                modified:       stats.mtime.getTime()
            });
            response.writeHead (200, {
                "Content-Type":             "application/json",
                "Content-Length":           output.length
            });
            response.end (output);
            return;
        });
    });
};


module.exports = {
    configure:          configure,
    start:              start,
    react:              react
};





