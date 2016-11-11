var http = require('http');
var app = require('express')();
var bodyParser = require('body-parser');
var port = process.env.PORT || 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.post('/webhook', function (req, res) {
    var body = req.body;
    var action = body.result.action;
    if (action === "verse") {
        handleVerse(function(data) {
            res.send(data);
        });
    } else if (action === "nextEvent") {
        handleEvent(function(data) {
            res.send(data);
        });
    } else {
        res.send('IDK');
    }
});

function handleEvent(cb) {
    cb(createResponse('hello next event'));
}

function handleVerse(cb) {
	var response = "";
	http.get('http://www.ourmanna.com/verses/api/get/?format=json', function(res) {
        var body = '';
        res.on('data', function(d) {
            body += d;
        });
        res.on('end', function(d) {
			try {
					var parsedJSON = JSON.parse(body.replace(/""/g, '"'));
					var verse = parsedJSON.verse.details.text;
					var reference = parsedJSON.verse.details.reference;
					var version = parsedJSON.verse.details.version;
					response = '"' + verse + '" - ' + reference + ' - ' + version + '.';
    				cb(createResponse(response));
			} catch (e) {
                console.log(e);
				response = 'There seems to be an error with fetching today\'s verse. I\'ll get this fixed ASAP!';
    			cb(createResponse(response));
			}
		});
	}.bind(this));
}

function createResponse(displayText, data) {
    var d = data? {"facebook": data} : undefined;
    return {
        "speech": displayText,
        "displayText": displayText,
        "data": d,
        "source": "ifg-bot"
    };
}

app.listen(port, function() {
    console.log('Listening on ' + port + '..');
});
