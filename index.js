/**
 * A Bot for Slack!
 */


/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here!")
});

controller.hears(
    ['hello', 'hi', 'greetings'],
    ['direct_mention', 'mention', 'direct_message'],
    function(bot,message) {
        bot.reply(message,'Hello!');
    }
);

controller.hears(
    ['bye', 'see you', 'good night'],
    ['direct_mention', 'mention', 'direct_message'],
    function(bot,message) {
        bot.reply(message,'See you later!');
    }
);

controller.hears(
    ['play'],
    ['direct_mention', 'mention', 'direct_message'],
    function trivia (bot,message) {
        const request = require('request');
        const lmgtfy = require('lmgtfy');
        
        request({url: 'http://jservice.io//api/random', json: true}, function (err, res, json) {
            if (err) throw err;
            
            // answer can look like '(foo) bar', 'foo (or bar)' '<i>foo bar</i>' which prevents it from being accepted, the func to get rid of that
            // also makes articles unnecessary
            // not sure if there're other unacceptable answers
            function getAnswer() { // returns e.g. [boo, bar]
                var answer = '',
                    secondAnswer = '';
                    
                if (json[0].answer.startsWith('<')) {
                    var indx1 = json[0].answer.indexOf('>'),
                        indx2 = json[0].answer.lastIndexOf('<');
                    answer = json[0].answer.slice(indx1 + 1, indx2);
                    return [answer, secondAnswer];
                } else if (json[0].answer.startsWith('(')) {
                    var indx = json[0].answer.indexOf(')');
                    answer = json[0].answer.slice(1, indx);
                    secondAnswer = json[0].answer.slice(indx + 2);
                    return [answer, secondAnswer];
                } else if(json[0].answer.endsWith(')')) {
                    var ind1 = json[0].answer.indexOf('('),
                        ind2 = json[0].answer.indexOf(')');
                    answer = json[0].answer.slice(0, ind1 - 2);
                    secondAnswer = json[0].answer.slice(ind1 + 4, ind2 - 1);
                    return [answer, secondAnswer];
                } else if (json[0].answer.startsWith('a')) {
                    answer = json[0].answer;
                    secondAnswer = json[0].answer.slice(2);
                    return [answer, secondAnswer];
                } else if (json[0].answer.startsWith('the')) {
                    answer = json[0].answer;
                    secondAnswer = json[0].answer.slice(4);
                    return [answer, secondAnswer];
                } else {
                    answer = json[0].answer;
                    return [answer];
                }
            }
            
            var answers = getAnswer();
            
            var category = '*Category:* ' + json[0].category.title,
                question = json[0].question + ' *' + json[0].answer + '*', // provide answer for testing, obviously will be removed
                attempts = 3,
                botAsks = {
                    "attachments": [
                        {
                            "title": "Question",
                            "pretext": category,
                            "text": question,
                            "color": "#32BEA6",
                            "mrkdwn_in": [
                                "text",
                                "pretext"
                            ]
                        }
                    ]
                };
                
                bot.startConversation(message, function (err, convo) {
                    if (err) throw err;
                    
                        convo.ask(botAsks, [
                        {
                            pattern: answers[0],
                            callback: function(response,convo) {
                                convo.say('Correct!');
                                trivia(bot, message);
                                convo.next();
                            }
                        },
                        {
                            pattern: answers[1],
                            callback: function(response,convo) {
                                convo.say('Correct!');
                                trivia(bot, message);
                                convo.next();
                            }
                        },
                        {
                            pattern: 'next',
                            callback: function(response,convo) {
                                trivia(bot, message);
                                convo.next();
                            }
                        },
                        {
                            pattern: 'stop',
                            callback: function(response,convo) {
                                convo.say('Have a nice day!');
                                convo.next();
                            }
                        },
                        {
                            default: true,
                            callback: function(response,convo) {
                                attempts--;
                                if (attempts == 0) {
                                    convo.ask('The answer is: *' + json[0].answer + '*\n\nDo you want to learn about it?', [
                                        {
                                            pattern: bot.utterances.yes,
                                            callback: function(response, convo) {
                                                convo.say('Let me google it for you!');
                                                convo.say(lmgtfy(json[0].answer));
                                                convo.next();
                                            }
                                        },
                                        {
                                            pattern: bot.utterances.no,
                                            callback: function(response, convo) {
                                                convo.say('Ok! See you!');
                                                convo.next();
                                            }
                                        }
                                        ]);
                                    convo.next();
                                } else {
                                    convo.say("Nope, try again. " + attempts + ' attempts left.');
                                    convo.repeat(); // silentRepeat doesn't work :(
                                }
                                convo.next();
                            }
                        }
                    ]);
                  
                });
            
        });
    });


/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
//controller.on('direct_message,mention,direct_mention', function (bot, message) {
//    bot.api.reactions.add({
//        timestamp: message.ts,
//        channel: message.channel,
//        name: 'robot_face',
//    }, function (err) {
//        if (err) {
//            console.log(err)
//        }
//        bot.reply(message, 'I heard you loud and clear boss.');
//    });
//});
