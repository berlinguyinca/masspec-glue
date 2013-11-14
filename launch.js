#!/usr/bin/env node

var fs = require ('fs');
var properties = require ('properties');
var server = require ('./main');
// require ('colors'); implied by requiring main
var localdir = require('path').dirname (module.filename);

var configFilename = process.argv.length > 2 ?
    process.argv[2] : process.env.npm_package_config_config;

fs.readFile (configFilename, function (err, configFileStr) {
    if (err || !configFileStr) {
        console.log ("Configuration not found.\n".red + configFilename);
        process.exit();
    }
    
    try {
        var configDoc;
        if (configFilename.slice (-5) == ".json")
            configDoc = JSON.parse (configFileStr, function (key, val) {
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
            });
        else
            configDoc = properties.parse (configFileStr.toString(), {
                namespaces:     true,
                reviver:        function (key, value, section) {
                    //Do not split section lines
                    if (this.isSection) return this.assert ();

                    //Split all the string values by a comma
                    if (typeof value === "string"){
                        var match;
                        while (match = value.match (/(?:^|[^\\])\$LIBDIR/)) {
                            var cut = match.index ? match.index + 1 : 0;
                            value = 
                                value.slice (0,cut) + 
                                localdir +
                                value.slice (cut+(cut ? 7 : match[0].length));
                        }
                        var values = value.split (",");
                        if (values.length == 1) return value;
                        for (var i=0,j=values.length; i<j; i++)
                            if (!values[i]) {
                                values.splice (i,1);
                                i--; j--;
                            } else 
                                values[i] = values[i].replace (/\s/g, "");
                        return values;
                    }

                    //Do not split the rest of the lines
                    return this.assert ();
                }
            });
    } catch (err) {
        console.log ('Invalid configuration document found.'.red, err);
        console.log (err.stack);
        process.exit();
    }
    
    server.configure (configDoc);
    server.start ();
});
