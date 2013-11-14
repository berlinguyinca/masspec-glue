



Deployment
==========
* needs a mongodb instance and appropriate configuration, see tests/testconf.properties
* # npm install -g git+https://shenanigans%40kaztl.com@code.google.com/p/masspec-glue/ 
* # npm install -g forever
* masspec_glue /absolute/path/to/config.properties
* process control is via forever.

Testing
=======
* needs an empty mongodb instance at 127.0.0.1:27017
* # npm install git+https://shenanigans%40kaztl.com@code.google.com/p/masspec-glue/ 
* # npm test masspec_glue

