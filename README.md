



Deployment
==========
* # npm install -g git+https://shenanigans%40kaztl.com@code.google.com/p/masspec-glue/ 
* # npm install -g forever
* # npm config set masspec_glue:config /absolute/path/to/config.properties
* json is fine too. Only *.json is parsed as json.
* # npm start masspec_glue
* process control is via forever.

Testing
=======
* # npm install git+https://shenanigans%40kaztl.com@code.google.com/p/masspec-glue/ 
* # npm config set masspec_glue:config `pwd`/node_modules/masspec_glue/tests/testconf.properties
* # npm start masspec_glue
* $ google-chrome node_modules/masspec_glue/tests/function.html

