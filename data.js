
var fs = require ('fs');
var FileCache = require ('./FileCache');
/**
Retrieves masspec data files by unique id.
@name endpoint_data
@module
*/
/**
@name configuration
@memberOf endpoint_data
@class
@property {Object.<string,string>} MIMETypes Maps file extensions to MIME 
    type strings. Trailing extensions such as .gz will be configured 
    automatically during the {@link endpoint_data.start|start phase}.
*/
var config = {
    MIMETypes:          {
        ".xml":             "MZMine",
        ".mzdata":          "MZmine.data",
        ".mzxml":           "MZmine.xml",
        ".mzml":            "MZmine.mzml",
        ".cdf":             "Unidata.NetCDF",
        ".raw":             "Xcalibur.raw",
        ".csv":             "Agilent.csv"
    }
};

/**
Set configuration options.
@param {endpoint_data.configuration} newConf
*/
var configure = function (newConf) {
    config.merge (newConf);
};

/**
Finalize config and prepare to react to requests.
@param {function} callback
*/
var start = function (callback) {
    var add = {};
    for (ext in config.MIMETypes) {
        var mimetype = config.MIMETypes[ext];
        add[ext+'.gz'] = mimetype;
        add[ext+'.tar'] = mimetype;
        add[ext+'.tar.gz'] = mimetype;
        add[ext+'.zip'] = mimetype;
    }
    for (ext in add)
        config.MIMETypes[ext] = add[ext];
    
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
        
        response.writeHead (200, {
            "Content-Type":             config.MIMETypes[ext] ? 
                                         config.MIMETypes[ext] :
                                         "application/xml",
            "Content-Length":           size,
            "Content-Disposition":      'attachment; filename="'+id+ext+'"'
        });
        var fileStream = fs.createReadStream (path);
        fileStream.on ('error', function () {
            response.end ();
        });
        fileStream.pipe (response);
    });
};


module.exports = {
    configure:          configure,
    start:              start,
    react:              react
};
