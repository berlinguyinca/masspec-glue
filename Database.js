

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
	db.collection (name, function (err, col) {
		if (err) {
			console.log ('Could not access database collection '.red + name.yellow);
			process.exit();
		}
		if (name != "directories")
			return callback (col);
		col.ensureIndex ({next:1}, function (err) {
			console.log ("setting database index".blue);
            if (err) {
                console.log ('ERROR - could not ensure database index'.red);
                process.exit();
            }
            callback (col);
        });
	})
};

module.exports = {
	configure: 			configure,
	start: 				start,
	getCollection: 		getCollection
};