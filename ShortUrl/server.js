var http = require('http');
var url = require('url');
var sqlite3 = require('sqlite3').verbose();
var config = require('./config.sample.js');
var port = config.port || 8000;

var db = new sqlite3.Database('links.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
    
    db.serialize(function () {
        db.run("CREATE TABLE IF NOT EXISTS links (path TEXT, destination TEXT)");
    });
});

http.createServer(function (req, res) {
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
                
                
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end({
                    short: config.base_url + 'test',
                    destination: ''
                });
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

function escapeHTML(html) {
    var text = html.replace(/["&'\/<>]/g, function (idx) {
        return ['&quot;', '&amp;', '&#39;', '&#47;', '&lt;', '&gt;'][idx];
    });
}

function getFrontPageHtml() {
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Shorten Link</title></head><body>' +
        '<form action=/new method=POST><input type=text placeholder="(optional) path" /><input type=url placeholder=target /><input type=submit value=Create /></form><ul>';
    
    db.each("SELECT rowid AS id, path, destination FROM links", function (err, row) {
        console.log(row.id + " " + row.path + ": " + row.destination);
        html += '<li>' + escapeHTML(row.id) + " " + escapeHTML(row.path) + ": " + escapeHTML(row.destination) + '</li>';
    });
    html += '</ul></body></html>';
    
    return html;
}