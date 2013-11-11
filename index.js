
var FileCache = require ('./FileCache');

/**
Adds or removes directories from the file index.
@name endpoint_index
@module
*/
/**
@name configuration
@memberOf endpoint_index
@class
*/
var config = {
};

/**
Set configuration options.
@param {endpoint_index.configuration} newConf
*/
var configure = function (newConf) {
    config.merge (newConf);
};

/**
Finalize config and prepare to react to requests.
@param {function} callback
*/
var start = function (callback) {
    process.nextTick (callback);
};

var skiplen = "/index/".length;

/**
React to a request, reply and close response.
@param request
@param response
*/
var react = function (request, response) {
    var dir = request.url.slice (skiplen);
    if (
        dir[0] == '.' ||
        dir.indexOf ('./') >= 0 || 
        dir.match (/[^\\]\/\./)
    ) {
        // index contains local path, ../ or accesses a hidden dir
        var result = '"index malformed"';
        response.writeHead (400, {
            "Content-Type":         "application/json",
            "Content-Length":       result.length
        });
        response.end (result);
    }
    
    if (request.method.toLowerCase() == "post") {
        FileCache.indexDirectory (dir, function (found) {
            if (found) {
                var result = '"index ok"';
                response.writeHead (200, {
                    "Content-Type":         "application/json",
                    "Content-Length":       result.length
                });
                response.end (result);
                return;
            }
            
            var result = '"index not found"';
            response.writeHead (404, {
                "Content-Type":             "application/json",
                "Content-Length":           result.length
            });
            response.end (result);
        });
    } else if (request.method.toLowerCase() == "delete")
        FileCache.dropDirectory (dir, function () {
            var result = '"index deleted"';
            response.writeHead (200, {
                "Content-Type":         "application/json",
                "Content-Length":       result.length
            });
            response.end (result);
        });
    else {
        var result = '"index invalid verb"';
        response.writeHead (404, {
            "Content-Type":             "application/json",
            "Content-Length":           result.length
        });
        response.end (result);
    }
};


module.exports = {
    configure:          configure,
    start:              start,
    react:              react
};
