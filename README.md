Indexes files with unique names from a structured directory into a 
flat namespace.

Deployment
==========
Relies on Node.js, npm and MongoDB.

__Installation:__ To install masspec_glue, simply execute 
`sudo npm install -g git+https://github.com/shenanigans/masspec_glue#0.1.0`
from any directory. It is installed on the execution path.

__Useage:__ A configuration file is required. This configuration may be 
a JSON document or a "structured properties" document, which is an 
extension of the .properties style of config file. JSON is recommended, 
for examples of the structured properties dialect, see 
`tests/testConf.properties`.

Here is a sample configuration (mostly the default configuration) in 
JSON (with js-style comments added - real configuration file must not 
have comments!)
```javascript
{
    "port":           	9001,		// the web service listens on this port
    "endpoints":      	{},			// changes the URLs where services reside
    "processes":      	1,			// fork to n subprocesses
    "FileCache":      	{
	    "mountPoints":  	[],		// these directory paths are indexed
	    "fileExtensions":   [		// files with these extensions are indexed
            "cdf",
            "txt",
            "mzxml",
            "xml"
        ],
	    "trailingExtensions": [		// these extensions may tail a qualifying filename
	        "gz",
	        "tar",
	        "tar.gz",
	        "zip"
	    ],
	    "refresh":          180000, // number of milliseconds between directory scans.
	    "refreshFuzz":      180000, // max mills to add randomly to rescan timer.
	    "heartRate":        1000,   // time to wait after zero scheduled rescans are found
	    "heartRateFuzz":    1000,   // before checking again.
	    "statsInFlight":    50		// crude file access parallelism limiter.
	},
    Database:       {
		"ip": 				"127.0.0.1",		// access information for the mongodb 
		"port": 			27017,				// instance that will persist the 
		"name": 			"masspec_glue",     // index.
		"collections":		{
			"files":  			"file",			// change the name of the database
			"directories": 		"dir"			// collections used.
		}
	}
}
```

`FileCache.fileExtensions`, `FileCache.mountPoints` and `Database.ip` 
are typically the only fields which must be configured. masspec_glue has 
been simplified from its original design. There is no longer any 
`/index` endpoint. Only the endpoints `/data/[filename]` and 
`/stat/[filename]` are active. Both use the GET verb and are therefor 
accessible from the browser for testing.

Launch masspec_glue with `masspec_glue /path/to/config.json`. It will 
immediately begin listening on `port`.

