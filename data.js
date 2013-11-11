
var fs = require ('fs');
var FileCache = require ('./FileCache');
/**
Retrieves masspec data files by unique id.
@name endpoint_data
@module
*/
/**
@name configuration
@memberOf endpoint_getFile
@class
*/
var config = {
};

/**
Set configuration options.
@param {endpoint_getFile.configuration} newConf
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


var skiplen = "/data/".length;
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
    FileCache.getPath (request.url.slice (skiplen), function (path, size) {
        if (!path) {
            var result = '"data not found"';
            response.writeHead (404, {
                "Content-Type":             "application/json",
                "Content-Length":           result.length
            });
            response.end (result);
            return;
        }
        
        response.writeHead (200, {
            "Content-Type":             "application/xml",
            "Content-Length":           size
        });
        var fileStream = fs.createReadStream (path);
        fileStream.pipe (response);
    });
};


module.exports = {
    configure:          configure,
    start:              start,
    react:              react
};
