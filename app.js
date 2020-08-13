var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');

var baseURL = 'https://developers.zomato.com/api/v2.1/';
var apiKey = '4bb2bf64698117f091ba0f1cf126e71d'; //Zomato key

var categories = null;
var cuisines = null;

var cuisineId;
var categoryId;

getCategories();

getCuisines(76);

// Lets setup the Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});


// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});


// Listen for messages from users 
server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();
var bot = new builder.UniversalBot(connector,[
    function (session, results) {
        session.send("Bienvenido!");
        session.send("¿Estás Hambriento? Busquemos un restaurante");
        session.send("Escribe 'buscar restaurante' para comenzar la busqueda.");
        session.endDialog();
    },
    
   
]).set('storage', inMemoryStorage); 

bot.recognizer({
    recognize: function (context, done) {
          var intent = { score: 0.0 };
  
          if (context.message.text) {
              switch (context.message.text.toLowerCase()) {
                  case 'help':
                      intent = { score: 1.0, intent: 'get-help' };
                      break;
                  case 'adios':
                      intent = { score: 1.0, intent: 'say-goodbye' };
                      break;
              }
          }
          done(null, intent)
      }
  });
  
  
  bot.dialog('help', [
      function (session) {
          session.send('¡Puedo ayudarte a buscar un restaurante o pedir una comida para llevar!!');
          session.endDialog();
      }
  ]).triggerAction({
      matches: 'get-help'
  });
  
  bot.dialog('adios', [
      function (session) {
          session.send('Hasta Luego!');
          session.endConversation();
      }
  ]).triggerAction({
      matches: 'say-goodbye'
  });

bot.dialog('searchRestaurant', [
    function (session) {
        session.send('Ok. Buscando un restaurante!');
        builder.Prompts.text(session, 'Donde?');
    },
    function (session, results) {
        session.conversationData.searchLocation = results.response;
        builder.Prompts.text(session, 'Cocina? Indian, Italian, o algún otro?');
    },
    function (session, results) {
        session.conversationData.searchCuisine = results.response;
        builder.Prompts.text(session, 'Delivery (Entrega) or Dine-in (Cenar en)?');
    },
    function (session, results) {
        session.conversationData.searchCategory = results.response;
        session.send('Ok. Buscando Restaurante..');
        getRestaurant(session.conversationData.searchCuisine, 
                      session.conversationData.searchLocation, 
                      session.conversationData.searchCategory, 
                      session);
    }
])
    .triggerAction({
    matches: /^buscar restaurante$/i,
    confirmPrompt: 'Su tarea de búsqueda de restaurante será abandonada. ¿Estás seguro?'
});

function getRestaurant(cuisine, location, category, session){
    
    cuisineId = getCuisineId(cuisine);
    categoryId = getCategoryId(category);
    
    var options = {
        uri: baseURL + 'locations',
        headers: {
            'user-key': apiKey
        },
        qs: {'query':location},
        method: 'GET'
        }
    var callback = function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            } else {
                console.log("************",body);
                locationInfo = JSON.parse(body).location_suggestions;
                search(locationInfo[0], cuisineId, categoryId, session);
                
            }
        }
    
    request(options,callback);
    
    
}

function search(location, cuisineId, categoryId, session){
    var options = {
        uri: baseURL + 'search',
        headers: {
            'user-key': apiKey
        },
        qs: {'entity_id': location.entity_id,
            'entity_type': location.entity_type, 
            'cuisines': [cuisineId],
            'category': categoryId},
        method: 'GET'
    }
    var callback = function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            } else {
                console.log('Found restaurants:')
                console.log("==========",response.body);
                //var resultsCount = JSON.parse(body).results_found;
                //console.log('Found:' + resultsCount);
                //session.send('I have found ' + resultsCount + ' restaurants for you!');
                var results = JSON.parse(body).restaurants;
                console.log("XXXXXXXXXXXX",results);
                var msg = presentInCards(session, results);
                session.send(msg);
                session.endDialog();
            }
        }
    
    request(options,callback);
}

function getCuisineId(cuisine, location){
    var cuisine_id = null;
    for (var i=0; i < cuisines.length; i++){
        var c = cuisines[i].cuisine;
        if (c.cuisine_name == cuisine){
            cuisineId = c.cuisine_id;
            break;
        }
    }
    console.log('>>>>>>Found:>>>>>>' + cuisineId);
    return cuisineId;
}

function getCuisines(cityId){
    
    var options = {
        uri: baseURL + 'cuisines',
        headers: {
            'user-key': apiKey
        },
        qs: {'city_id':cityId},
        method: 'GET'
        }
    var callback = function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            } else {
                console.log('Ppppppppppppppp',body);
                cuisines = JSON.parse(body).cuisines;
                
            }
        }
    
    request(options,callback);
}

function getCategoryId(category){
    var category_id = null;
    for (var i=0; i < categories.length; i++){
        var c = categories[i].categories;
        if (c.name == category){
            category_id = c.id;
            break;
        }
    }
    console.log('<<<<<<<<Found<<<<<<<:' + category_id);
    return category_id;
}

function getCategories(){
    var options = {
        uri: baseURL + 'categories',
        headers: {
            'user-key': apiKey
        },
        qs: {},
        method: 'GET'
        }
    var callback = function(error, response, body) {
            if (error) {
                console.log('Error sending messages: ', error)
            } else if (response.body.error) {
                console.log('Error: ', response.body.error)
            } else {
                console.log("Ccccccccccccccc",body);
                categories = JSON.parse(body).categories;
            }
        }
    
    request(options,callback);
}

function presentInCards(session, results){
    
    var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel)
    
    var heroCardArray = [];
    var l = results.length;
    if (results.length > 10){
        l = 10;
    }
    for (var i = 0; i < l; i++){
        var r = results[i].restaurant;
        
        var herocard = new builder.HeroCard(session)
            .title(r.name)
            .subtitle(r.location.address)
            //.text(r.timings)
            .text(r.user_rating.aggregate_rating)
            .images([builder.CardImage.create(session, r.thumb)])
            .buttons([
                builder.CardAction.imBack(session, "book_table:" + r.id, "Book a table")
            ]);
        heroCardArray.push(herocard);

    }
    
    msg.attachments(heroCardArray);
    
    return msg;
}
// Echo their message back.. just parrotting!
/* var bot = new builder.UniversalBot(connector, function (session) {
   session.send("You said: %s", session.message.text);
    
});  */




