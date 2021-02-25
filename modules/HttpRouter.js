class HttpRouter {
    app = require('express')();
    http = require('http').Server(this.app);
    routes = [
        { path: '/', resource: '/create.html' },
        { path: '/style', resource: '/css/style.css' },
        { path: '/js/create', resource: '/js/create.js' },
        { path: '/js/play', resource: '/js/play.js' },
        { path: '/*', resource: '/play.html' },
    ];

    constructor() {
        for (let i = 0; i < this.routes.length; i++) {
            this.app.get(this.routes[i].path, (req, res) => {
                res.sendFile(this.routes[i].resource, { root: './' });
            });
        }
    }

    serve(port) {
        // Web server
        this.http.listen(port, () => {
            console.log(`Socket.IO server running at http://localhost:${port}/`);
        });
    }
}

module.exports.HttpRouter = HttpRouter;



