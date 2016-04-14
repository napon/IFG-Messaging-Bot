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
var os = require('os');

graph.setAccessToken(process.env.access_token);
graph.setVersion('2.4');

var controller = Botkit.facebookbot({
    debug: true,
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
    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, "Hello! I'm a bot for IFG! You can ask me about our upcoming events or ask me for a Bible verse of the day! :)");
        }
    });
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
        
        var nextEvent = res.data[0];
        var eventDate = new Date(nextEvent.start_time);
        var todayDate = new Date();
        if (eventDate.getTime() < todayDate) {
             cb([]);
             return;
        }

        graph.get('/' + nextEvent.id + '/picture?type=large', function(err2, picRes) {
            console.log('err2: ' + JSON.stringify(err2));
            console.log('picRes: ' + JSON.stringify(picRes));
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

            cb([nextEventPost]);
            return;
        });
    });
}

controller.hears(['the next event', 'coming up events', 'event coming up'], 'message_received', 
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

controller.hears(['identify yourself', 'who are you', 'your name', 'who made you'], 'message_received',
    function(bot, message) {
        bot.reply(message,
            "Beep! Boop! I am a bot created by IFG. You can report your concerns directly to my master at <ifg.ivcf@gmail.com>");
});

controller.hears(['uptime', 'how old are you'], 'message_received',
    function(bot, message) {
        var uptime = formatUptime(process.uptime());
        bot.reply(message,
            "I have been running for " + uptime + ".");
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
