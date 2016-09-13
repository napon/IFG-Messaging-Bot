if (!process.env.access_token) {
    console.log('Error: Specify access_token in environment.');
    process.exit(1);
}

if (!process.env.page_token) {
    console.log('Error: Specify page_token in environment');
    process.exit(1);
}

if (!process.env.verify_token) {
    console.log('Error: Specify verify_token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var graph = require('fbgraph');
var http = require('http');

graph.setAccessToken(process.env.access_token);
graph.setVersion('2.4');

var controller = Botkit.facebookbot({
    debug: false,
    access_token: process.env.page_token,
    verify_token: process.env.verify_token,
});

var bot = controller.spawn({
});

controller.setupWebserver(process.env.port || 3000, function(err, webserver) {
    controller.createWebhookEndpoints(webserver, bot, function() {
        console.log('ONLINE!');
    });
});

controller.hears(['hello', 'hi', 'hey'], 'message_received', function(bot, message) {
    bot.reply(message, "Hello! I'm a bot for IFG! You can ask me about our upcoming events or ask me for a Bible verse of the day! :)");
});

function getUpcomingEvents(cb) {
    var events = [];
    graph.get('/631063610257770/events', function(err, res) {
        //console.log('res: ' + JSON.stringify(res.data));
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

controller.hears(['upcoming event', 'next event', 'coming up event', 'event coming up'], 'message_received',
    function(bot, message) {
    getUpcomingEvents(function(events) {
        if (events.length == 0) {
            bot.reply(message, "Looks like we don't have an event coming up just yet! Stay tuned!");
        } else {
            bot.reply(message, "Here is what's coming up!");
            bot.reply(message, {
                attachment: {
                    'type': 'template',
                    'payload': {
                        'template_type': 'generic',
                        'elements': events
                    }
                }
            });
        }
    });
});

controller.hears(['verse', 'passage', 'bible'], 'message_received', function(bot, message) {
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
            	bot.reply(message, '"' + verse + '" - ' + reference + ' - ' + version + '.');
	    } catch (e) {
		bot.reply(message, 'There seems to be an error with fetching today\'s verse. I\'ll get this fixed ASAP!');
		console.log('ERROR VERSE API: ' + e);
		console.log('Result from API call: ' + body);
	    }
            bot.reply(message, 'Have an amazing day! <3');
        });
    });
});

controller.hears(['identify yourself', 'who are you', 'your name', 'who made you'], 'message_received',
    function(bot, message) {
        bot.reply(message,
            "Beep! Boop! I am a bot created by IFG. You can report your concerns directly to my master at <ifg.ivcf@gmail.com>");
});

controller.hears(['thanks', 'thank you', 'ty'], 'message_received', function(bot, message) {
    var responses = [':)', 'No problem! :)', ':D', 'You are welcome!'];
    bot.reply(message, responses[Math.floor(Math.random()*responses.length)]);
});

controller.hears(['bye'], 'message_received', function(bot, message) {
    var responses = ['See ya!', 'Good bye!'];
    bot.reply(message, responses[Math.floor(Math.random()*responses.length)]);
});

controller.hears(['uptime', 'how old are you'], 'message_received',
    function(bot, message) {
        var uptime = formatUptime(process.uptime());
        bot.reply(message,
            "I have been running for " + uptime + ".");
});

controller.hears(['ok', 'okay'], 'message_received', function(bot, message) {
	bot.reply(message, ":)");
});

controller.on('message_received', function(bot, message) {
    bot.reply(message, "I'm not that smart yet! Try asking me for the next event or for a bible verse!");
    return false;
});

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
