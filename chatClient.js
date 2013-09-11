/**
 * Created with JetBrains PhpStorm.
 * User: walid
 * Date: 9/8/13
 * Time: 2:26 PM
 * To change this template use File | Settings | File Templates.
 */

var chatterBox = (function (timerPeriod, numChatsToKeep) {


    timerPeriod = timerPeriod || 3000;
    numChatsToKeep = numChatsToKeep || 20;

    // Model
    var timer = null;
    var currentUser = window.location.href.slice(window.location.href.search('username=') + 9);
    var $input = $('input.draft');
    var $send = $('button.send');
    var displayedMessages = [];


    // Start clean
    $('li').remove();

    // Set up message FIFO
    var setLength = function (newNumChatsToKeep) {
        numChatsToKeep = newNumChatsToKeep;
    }

    // Set up update rate
    var setPeriod = function (newPeriod) {
        stopMonitor();
        timerPeriod = newPeriod;
        startMonitor();
    }

    // Either hitting <enter> in input box or clicking <send> button, with characters present
    // will send message. <send> button is disable if no characters in input field.

    // Keyboard event handler
    $input.on('keyup', function (e) {
        if (e.keyCode === 13) {
            var writtenMessage = $(this).val();
            $(this).val('');
            Chat.send(writtenMessage);
            $send.prop('disabled', true);
        } else {
            $send.prop('disabled', $(this).val().length == 0);
        }
    });

    // Send button event handler
    $send.on('click', function (e) {
        var writtenMessage = $input.val();
        $input.val('');
        Chat.send(writtenMessage);
        $(this).prop('disabled', true);
    });

    // View update
    var updateView = function (newMessages) {
        newMessages.forEach(function (e) {
            Chat.display(e);
        });
    };

    // Select what methods to override in Chat
    var overRideDefaults = function (override) {
        for (var o in override) {
            switch (override[o]) {

                // Chat.display appends a single message to the DOM.  Not cool. Should have
                // made it an array
                case 'display':
                    delete Chat.display;
                    Chat.display = function (message) {

                        // Pull out the message's user and time stamp.  We'll compare to
                        // those in the displayed messages.
                        var timeRegExp = /\(\d{1,2}:\d{1,2}:\d{1,2}\.\d{1,3}\)/g;
                        var nameRegExp = /[a-z]+:/gi;
                        var userName = message.match(nameRegExp);
                        var timeStamp = message.match(timeRegExp);

                        // Detect repeat messages by comparing the timestamp and user
                        var newMessage = displayedMessages.every(function (m) {
                            return( (m.search(timeStamp[0]) === -1) || (m.search(userName[0]) === -1) );
                        });

                        // Process only new message, and store in message array;
                        if (newMessage || displayedMessages.length == 0) {
                            var isEcho = message.search(new RegExp(currentUser + ':'));
                            var isRobo = message.search(new RegExp('RoboChat' + ':'), 'i');

                            // Escape the HTML to avoid XSS type attacks ...
                            var $temp = $('<li>').text(message);
                            if (isEcho > -1) $temp.addClass('isEcho');
                            if (isRobo > -1) $temp.addClass('isRobo');
                            $temp.appendTo('ol.messages');

                            // push into the internal array so we can check for duplicates without
                            // continually going to the DOM
                            displayedMessages.push(message);
                            if (displayedMessages.length > numChatsToKeep) {
                                var $li = $('li');
                                $li.slice(0, $li.length - numChatsToKeep).remove();
                                displayedMessages.splice(0, displayedMessages.length - numChatsToKeep);
                            }
                        }
                    };
                    break;

                // Chat.fetch sends an array of strings of messages to its callback, fetchCallback.
                // I assumed (probably wrongly) that Chat.display() should display a single message at a time
                // so, I iterate the array in UpdateView.  This causes the drawback that I update the DOM once
                // for each message.  In a refactor, I would create an array of <li> tags, and append the whole
                // thing to <ol>.
                case 'fetch':
                    delete Chat.fetch;
                    Chat.fetch = function (fetchCallback) {
                        $.ajax({
                            url: 'https://api.parse.com/1/classes/chats',
                            data: {
                                order: 'createdAt'
                            },
                            dataType: 'json',
                            timeout: 2500
                        }).then(function (retrievedData) {
                                var receivedMessages = retrievedData.results;
                                var ar = [];
                                receivedMessages.forEach(function (e, i) {
                                    ar[i] = '(' + e.createdAt.substring(e.createdAt.indexOf('T') + 1, e.createdAt.length - 1) + ') ' + e.text;
                                });
                                $("#fetchStatus").removeClass('statusError').addClass('statusOk').html('Ok');
                                fetchCallback(ar);
                            }, function (error) {
                                console.warn('ERROR ON FETCH: "' + error.statusText + '"');
                                $("#fetchStatus").removeClass('statusOk').addClass('statusError').html('Timeout');
                            });
                    };
                    break;

                // Would have liked to send userName as part of data object.  Chat.guide(10) explicitly states:
                // * The endpoint is expecting to get an object from you that contains a property named "text" (and no other properties).
                // So, username is appended to the string in .text property of data {}, as opposed to a separate property.
                case 'send' :
                    delete Chat.send;
                    Chat.send = function (messageToSend) {
                        $.ajax({
                            url: 'https://api.parse.com/1/classes/chats',
                            type: 'POST',
                            timeout: 2500,
                            data: JSON.stringify({
                                text: currentUser + ': ' + messageToSend
                            })
                        }).then(function (confirmation) {
                                console.log('Ajax Sent. Resource ' + confirmation.objectId + ' created at ' + confirmation.createdAt);
                                $("#sendStatus").removeClass('statusError').addClass('statusOk').html('Ok');
                            }, function (error) {
                                console.warn('ERROR ON SEND: "' + error.statusText + '"');
                                $("#sendStatus").removeClass('statusOk').addClass('statusError').html('Timeout');
                            });
                    };
                    break;
            }
        }
    }


    // The following are used for debugging

    // Define the start / stop methods
    var startMonitor;
    startMonitor = function (t) {
        if (typeof t === "number") {
            t = Math.floor(t / 1000) * 1000;
            timerPeriod = t > 1000 ? t : timerPeriod;
        }
        timer = setInterval(function () {
            Chat.fetch(function (fetchedMessages) {
                updateView(fetchedMessages);
            });
        }, timerPeriod);
    };

    var stopMonitor = function () {
        if (timer) {
            clearInterval(timer);
        }
    };

    //  selectively override any of the Chat methods
    overRideDefaults(['display', 'fetch', 'send']);

    // Start up first fetch
    Chat.fetch(function (fetchedMessages) {
        updateView(fetchedMessages);
    });

    // Start everything up
    startMonitor(timerPeriod);

    // public interface, again just for testing
    return {
        start: startMonitor,
        stop: stopMonitor,
        length: setLength,
        period: setPeriod
    }

})(3000, 20);