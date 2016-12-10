var http = require('http');
var url = require('url');
var qs = require('querystring');
var sqlite3 = require('sqlite3').verbose();
var config = require('./config.js');
var port = config.port || 8000;

console.log("Starting app");

var db = new sqlite3.Database('links.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
    console.log("Starting DB");
    
    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS links (path TEXT PRIMARY KEY NOT NULL, destination TEXT NOT NULL, used INT NOT NULL)", function (err) {
            if (err) {
                console.log(err);
                process.exit(2);
            }
            console.log("Started DB");
        });
    });
});

http.createServer(function (req, res) {
    var url_params = url.parse(req.url);
    var query = qs.parse(url_params.query);
    console.log(url_params);
    console.log(query);
    if (url_params.pathname && url_params.pathname.length > 2 && url_params.pathname[2] == '.') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end("Not found");
    }
    else if (query.secret == config.secret) {
        switch (url_params.pathname) {
            case "":
            case "/":
                res.writeHead(200, { 'Content-Type': 'text/html' });
                getFrontPageHtml(function (html) {
                    res.end(html);
                });
                break;
            case "/new":
                if (typeof query.target === "undefined" || query.target.length == 0) {
                    returnError(res, 400, "Bad Request: Target must be specified");
                }
                else {
                    var path,
                        target = query.target;
                    if (typeof query.path !== "undefined" && query.path.length > 0) {
                        path = query.path;
                        newLink(res, path, target);
                    }
                    else {
                        db.get('SELECT path FROM links WHERE destination = $destination', {
                            $destination: target
                        }, function (err, row) {
                            if (err) {
                                returnError(res, 500, "SQL Error");
                            }
                            else {
                                console.log("Existing " + (row ? row.path : "none"));
                                if (row && row.path) {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        status: 200,
                                        short: config.base_url + row.path,
                                        destination: target
                                    }));
                                }
                                else {
                                    generateNewLinkPath(res, target);
                                }
                            }
                        });
                    }
                }
                break;
            default:
                returnError(res, 404, "Not Found");
                break;
        }
    }
    else if (url_params.pathname.length < 2) {
        returnError(res, 200, "Forbidden to access /");
    }
    else {
        var path = url_params.pathname.substring(1);
        // Follow redirect
        db.get('SELECT destination FROM links WHERE path = $path', {
            $path: path
        }, function (err, row) {
            if (err) {
                console.log(err);
                returnError(res, 500, "SQL Error");
            }
            else if (!row || !row.destination) {
                returnError(res, 404, "Not Found");
            }
            else {
                res.writeHead(301, { 'Content-Type': 'text/html', Location: row.destination });
                res.end('<script type="text/javascript">window.location.href="' + row.destination + '";</script><a href="' + row.destination + '">Click here to follow redirect.</a>');
                db.run('UPDATE links SET used = used + 1 WHERE path = $path', {
                    $path: path
                });
            }
        });
    }
}).listen(port);
console.log("Starting HTTP");

function generateNewLinkPath(res, target) {
    var path = numToPath(Math.floor(Math.random() * (Math.pow(64, 5) - 1) + 1));
    db.get('SELECT COUNT(1) AS amount FROM links WHERE path = $path', {
        $path: path
    }, function (err, row) {
        if (err) {
            returnError(res, 500, "SQL Error");
        }
        else {
            if (row && row.amount) {
                generateNewLinkPath(res);
            }
            else {
                newLink(res, path, target);
            }
        }
    });
}

var validChars = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890_-';

function numToPath(num) {
    if (num < validChars.length)
        return validChars[num];
    return numToPath(Math.floor(num / validChars.length)) + numToPath(num % validChars.length);
}

function returnError(res, code, message) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: code,
        msg: message
    }));
}

function newLink(res, path, target) {
    if (config.includeHostInPath) {
        var targetparts = url.parse(target);
        path = targetparts.hostname + "/" + path;
    }
    db.run('INSERT OR IGNORE INTO links VALUES ($path, $destination, 0)', {
        $path: path,
        $destination: target
    }, function (err) {
        if (err) {
            console.log(err);
            returnError(res, 500, "SQL Error");
        }
        else {
            db.run('UPDATE links SET destination = $destination WHERE path = $path', {
                $path: path,
                $destination: target
            }, function (err) {
                if (err) {
                    console.log(err);
                    returnError(res, 500, "SQL Error");
                }
                else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 200,
                        short: config.base_url + path,
                        destination: target
                    }));
                }
            });
        }
    });
}

function HtmlReplacer(c) {
    return { '"': '&quot;', '&': '&amp;', "'": '&#39;', '/': '&#47;', '<': '&lt;', '>': '&gt;' }[c] || "[UNKNOWN]";
}

function escapeHtml(text) {
    return text.toString().replace(/["&'\/<>]/g, HtmlReplacer);
}

function getFrontPageHtml(callback) {
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Shorten Link</title></head><body>' +
        '<form  action="' + config.base_url + 'new" method="GET"><input type="hidden" name="secret" value="' + config.secret +
        '" /><input type="text" name="path" placeholder="(optional) path" /><input type="url" name="target" placeholder="target" /><input name="submit" type="submit" value="Create" /></form><ul>';
    
    db.each("SELECT rowid AS id, path, destination, used FROM links", function (err, row) {
        if (err) {
            console.log(err);
        }
        else {
            console.log(row.id + " (" + row.used + ") " + row.path + ": " + row.destination);
            html += '<li>' + row.id + " (" + row.used + ") " + escapeHtml(row.path) + ": " + escapeHtml(row.destination) + '</li>';
        }
    }, function (err) {
        if (err) {
            console.log(err);
        }
        html += '</ul></body></html>';
        callback(html);
    });
}

function exitHandler() {
    console.log("Closing db connection");
    db.close(function (err) {
        if (err) {
            console.log(err);
            process.exit(3);
        }
        else
            process.exit(0);
    });
}

process.on('SIGINT', exitHandler);