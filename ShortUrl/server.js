var http = require('http');
var url = require('url');
var qs = require('querystring');
var sqlite3 = require('sqlite3').verbose();
var config = require('./config.sample.js');
var port = config.port || 8000;

var db = new sqlite3.Database('links.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
    
    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS links (path TEXT PRIMARY KEY NOT NULL, destination TEXT NOT NULL)");
    });
});

http.createServer(function (req, res) {
    var postData = '';
    
    if (req.method == "POST") {
        var body = '';
        req.on('data', function (data) {
            body += data;
            if (body.length > 1e3)
                req.connection.destroy();
        });
        req.constructor('end', function () {
            postData = qs.parse(body);
        });
    }
    
    var url_params = url.parse(req.url);
    if (url_params.pathname.length > 2 && url_params.pathname[2] == '.') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end("Not found");
    }
    else if (url_params.query == "secret=" + config.secret) {
        switch (url_params.pathname) {
            case "":
            case "/":
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(getFrontPageHtml());
                break;
            case "/new":
                if (post["target"].length == 0) {
                    returnError(res, 400, "Bad Request: Target must be specified");
                }
                else {
                    var path,
                        target = post["target"];
                    if (post["path"].length > 0) {
                        path = post["path"];
                        newLink(res, path, target);
                    }
                    else {
                        db.get('SELECT Count(*) AS count FROM links', function (err, row) {
                            if (err) {
                                returnError(res, 500, "SQL Error");
                            }
                            else {
                                newLink(res, numToPath(row["count"] + 1), target);
                            }
                        });
                    }
                }
                break;
            default:
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end("Not found");
                break;
        }
    }
    else {
        // Follow redirect
    }
}).listen(port);

var validChars = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890_-';

function numToPath(num) {
    if (num < validChars.length)
        return validChars[num];
    return numToPath(num / validChars.length) + numToPath(num % validChars.length);
}

function returnError(res, code, message) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end({
        status: code,
        msg: message
    });
}

function newLink(res, path, target) {
    db.run('INSERT OR IGNORE INTO links VALUES ($path, $destination)', {
        $path: path,
        $destination: target
    }, function (err) {
        if (err) {
            console.log(err);
            returnError(res, 500, "SQL Error");
        }
        else {
            db.run('UPDATE links SET destination = $destination WHERE path LIKE $path', {
                $path: path,
                $destination: target
            }, function (err) {
                if (err) {
                    console.log(err);
                    returnError(res, 500, "SQL Error");
                }
                else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end({
                        status: 200,
                        short: config.base_url + 'test',
                        destination: ''
                    });
                }
            });
        }
    });
}

function escapeHTML(html) {
    var text = html.replace(/["&'\/<>]/g, function (idx) {
        return ['&quot;', '&amp;', '&#39;', '&#47;', '&lt;', '&gt;'][idx];
    });
}

function getFrontPageHtml() {
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Shorten Link</title></head><body>' +
        '<form action="/new?secret=' + config.secret +
        '" method=POST><input type=text name=path placeholder="(optional) path" /><input type=url name=target placeholder=target /><input type=submit value=Create /></form><ul>';
    
    db.each("SELECT rowid AS id, path, destination FROM links", function (err, row) {
        console.log(row.id + " " + row.path + ": " + row.destination);
        html += '<li>' + escapeHTML(row.id) + " " + escapeHTML(row.path) + ": " + escapeHTML(row.destination) + '</li>';
    });
    html += '</ul></body></html>';
    
    return html;
}