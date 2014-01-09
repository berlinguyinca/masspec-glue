

var Mongo = require ('mongodb');

var config = {
	ip: 				"127.0.0.1",
	port: 				27017,
	name: 				"masspec_glue",
	collections: 		{
		"files":  			"file",
		"directories": 		"dir"
	}
};
var configure = function (newconf) {
	config.merge (newconf);
};

var db;
var start = function (callback) {
	var dbsrv = new Mongo.Server (config.ip, config.port, {});
	db = new Mongo.Db (config.name, dbsrv, {journal:false});
	db.open (function () {
	    console.log ('opened database connection'.green);
	    callback();
    });
};

var getCollection = function (name, callback) {
	var cname = config.collections[name];
	db.collection (cname, function (err, col) {
		if (err) {
			console.log ('Could not access database collection '.red + name.yellow);
			process.exit();
		}
		if (name == "directories")
			col.ensureIndex ({n:1}, function (err) {
				console.log ("ensuring Directories database index".blue);
	            if (err) {
	                console.log ('ERROR - could not ensure Directories database index'.red);
	                process.exit();
	            }
	            callback (col);
	        });
		else if (name == "files")
			col.ensureIndex ({id:1}, {unique:true}, function (err) {
				console.log ("ensuring Files database index".blue);
	            if (err) {
	                console.log ('ERROR - could not ensure Files database index'.red);
	                process.exit();
	            }
	            callback (col);
			})
		else
			callback (col);
	})
};

module.exports = {
	configure: 			configure,
	start: 				start,
	getCollection: 		getCollection
};