
var mg = require ('../main');

mg.configure ({
    filesystem:         {
        fileExtensions:     [
            "xml"
        ],
        mountPoints:        [
            "/home/schmidty/Code/work/masspec-glue/repo/tests/playground/mount0",
            "/home/schmidty/Code/work/masspec-glue/repo/tests/playground/mount1",
            "/home/schmidty/Code/work/masspec-glue/repo/tests/playground/mount2",
            "/home/schmidty/Code/work/masspec-glue/repo/tests/playground/mount3"
        ]
        //~ refresh:            1000 * 5,
        //~ refreshFuzz:        1000 * 5
    }
});

mg.start (function () {console.log ('running');});



