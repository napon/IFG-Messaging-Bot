var http = require('http');
var app = require('express')();
var bodyParser = require('body-parser');
var graph = require('fbgraph');

var port = process.env.PORT || 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.post('/webhook', function (req, res) {
    var body = req.body;
    var action = body.result.action;
    var params = body.result.parameters;
    if (action === "verse") {
        handleVerse(function(data) {
            res.send(data);
        });
    } else if (action === "nextEvent") {
        handleEvent(params.token, function(data) {
            res.send(data);
        });
    }
});

function handleEvent(token, cb) {
	getUpcomingEvents(token, function(events) {
		if (events.length === 0) {
			cb(createResponse("Looks like we don't have an event coming up just yet! Stay tuned!"));
		} else {
			var data = {
				attachment: {
					'type': 'template',
					'payload': {
						'template_type': 'generic',
						'elements': events
					}
				}
			};	
			cb(createResponse("Here's what's coming up!", data));
		}
	});
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

function getUpcomingEvents(token, cb) {
	graph.setAccessToken(token);
	
    var events = [];
    graph.get('/631063610257770/events', function(err, res) {
        if (err) {
            console.log('err: ' + JSON.stringify(err));
            cb([]);
            return;
        }
	   
        var data = res.data;
        data.sort(function (a, b) { return new Date(a.start_time).getTime() - new Date(b.start_time).getTime(); });

        var nextEvent = data[0];
        var eventDate = new Date(nextEvent.start_time);
        var todayDate = new Date();

        for (var i = 1; i < data.length; i++) {
            nextEvent = data[i];
            eventDate = new Date(nextEvent.start_time);
            if (eventDate.getTime() > todayDate.getTime()) {
                break;
            }
        }

        if (eventDate.getTime() < todayDate.getTime()) {
             cb([]);
             return;
        }

        graph.get('/' + nextEvent.id + '/picture?type=large', function(err2, picRes) {
            var nextEventPost = {
                'title': nextEvent.name,
                'subtitle': nextEvent.place.name,
                'image_url': picRes.location,
                'buttons': [
                    {
                        'type': 'web_url',
                        'url': 'https://www.facebook.com/events/' + nextEvent.id,
                        'title': 'More info'
                    }
                ]
            };
            console.log('returning: ' + JSON.stringify(nextEventPost));
            cb([nextEventPost]);
            return;
        });
    });
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
