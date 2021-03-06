const express = require('express');
const request = require('request');
const uuidv4 = require('uuid/v4');
const port = 8082;
var app = express();
var version = 1.3;

//Change to true to increase logging:
var verbose = false;

//This is your pebble timline token for rws:
var SETTING_timelineToken = "";

//This is an array of access keys. E.g. SETTING_authorizedKeys = ["monzo-dw43gV9kDm"]:
var SETTING_authorizedKeys = [];

//Set to true to only include transaction amount:
var SETTING_reducedInfoMode = false;

//Translate these to change the language. All other text will be as set to the API values
var STRING_spent = "Spent"
var STRING_recieved = "Recieved"
var STRING_at = "@"
var STRING_from = "from"


//End of settings, do not change anything below this line --------------

app.use(function(req, res, next) {
  req.rawBody = '';
  req.setEncoding('utf8');

  req.on('data', function(chunk) {
    req.rawBody += chunk;
  });

  req.on('end', function() {
    next();
  });
});

function log(text, isVerbose = false) {
  if ((isVerbose == true && verbose == true) || (isVerbose == false)) {
    var d = new Date().toISOString();
    console.log("[" + d + "] " + text);
  }
}

const monthNames = ["January", "February", "March", "April", "May", "June",
   "July", "August", "September", "October", "November", "December"
 ];

function currencyToSymbol(currency) {
  switch (currency) {
    case "GBP":
      return "£";
    break;
    case "USD":
      return "$";
    break;
    case "EUR":
      return "€";
    break;
    case "JPY":
      return "¥";
    case "RUB":
      return "₽";
    case "BTC":
      return "₿";
    default:
      return "§";
  }
}
function monthFromString(datestring) {
  var d = new Date(datestring);
  return monthNames[d.getMonth()];
}
function moneyFormat(money) {
  money = money.toString();
  var len = money.length;
  if (money == "0") {
    return money;
  } else if (len < 2) {
    return "0.0" + money;
  } else if (len < 3) {
    return  "0." + money;
  } else {
    return money.substring(0, len - 2) + "." + money.substring(len - 2);
  }
}
function generateNewPinID() {
  return "willow-systems-" + uuidv4().split("-")[0];
}
function handleMonzoTransactionCreated(obj) {
  log("transaction::monzo::amount:" + obj.data.amount.toString());
  log("Obj: " + JSON.stringify(obj), true);

  var data = obj.data;


  //First of all, exclude pot related transfers
  if (data.scheme != null && data.scheme == "uk_retail_pot") {

    log("Skip transaction, is pot related", true);

  } else {

    //We need to act according to what transaction type it is
    //Create a final data object that will be safe to use
    var fdata = {};
    fdata.amountString = "ERROR";

    //Did we spend or recieve?
    if (data.amount.toString().includes("-")) {
      fdata.verb = STRING_spent;
      fdata.titleSeperator = STRING_at;
    } else {
      fdata.verb = STRING_recieved;
      fdata.titleSeperator = STRING_from;
    }


    //Create the first part of the title. E.g. Spent £10.00
    fdata.amountString = currencyToSymbol(obj.data.currency) + moneyFormat(obj.data.amount.toString().replace("-",""));

    if (data.local_currency != null && (data.local_currency != data.currency)) {
      //It was a foreign currency, append the local amount E.g. Spent £10.00 (€11.00)
      fdata.amountString = fdata.amountString + ' (' + currencyToSymbol(obj.data.local_currency) + moneyFormat(obj.data.local_amount.toString().replace("-","")) + ')';
    }

    var pbody = ""
    //Set the body as the merchant address (we will remove this if in reduced info mode)
    if (data.merchant != null && data.merchant.address != null && data.merchant.address.short_formatted != null) {
      pbody = data.merchant.address.short_formatted;
    }

    if (SETTING_reducedInfoMode) {
      //We don't want to put much information in the pin
      pbody = ""
      var ptitle = fdata.verb + " " + fdata.amountString;
    } else {
      var ptitle = fdata.verb + " " + fdata.amountString + " " + fdata.titleSeperator + " " + obj.data.description;
    }

    //Hockey puck? No no, that's a coin now...
    createTimelinePin(generateNewPinID(), SETTING_timelineToken, obj.data.created.toString(), ptitle, pbody, "HOCKEY_GAME");
    log("Created pin", true)

  }
}
function handleSimplePinCreation(obj) {
  var pinDate = new Date().toISOString().split('.')[0]+"Z";
  createTimelinePin(generateNewPinID(), SETTING_timelineToken, pinDate, obj.data.title, obj.data.body);
}
function createTimelinePin(id, token, time, title, body, flag = "NOTIFICATION_FLAG") {
  //Timeformat = "2015-09-22T16:30:00Z"
  var pin = {};
  pin.id = id;
  pin.time = time;
  pin.layout = {};
  pin.layout.type = "genericPin";
  pin.layout.title = title;
  pin.layout.subtitle = body;
  pin.layout.tinyIcon = "system://images/" + flag.toString();
  // pin.layout.primaryColor = "#FFFFFF";
  // pin.layout.secondaryColor = "#666666";
  // pin.layout.backgroundColor = "#5556FF";


  log("", true);

  log("Pin Data: " + JSON.stringify(pin), true);

  // Set the headers
  var headers = {
      'Content-Type': 'application/json',
      'X-User-Token': token,
  }

  // Configure the request
  var options = {
    url: 'https://timeline-api.rebble.io/v1/user/pins/' + id,
    method: 'PUT',
    headers: headers,
    json: pin,
  }

  log("request.headers: " + JSON.stringify(headers), true);
  log("request.options: " + JSON.stringify(options), true);

  // Start the request
  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      // Print out the response body
      log("Success - Successful pin creation");
      log(body, true);
    } else {
      log("Error - Pin creation error - " + response.statusCode);
      log("Error: " + error);
      log("Body: " + JSON.stringify(body));
    }
  })
}


//Web app side
app.post('/incoming/',function(req,res){
  log("Return 401 - Missing Key");
  res.status(401);
  res.end("Missing Auth Key");
});
app.post('/incoming/:key',function(req,res){
  var authorized = false;
  for (var i = 0; i < SETTING_authorizedKeys.length; i++) {
    if (SETTING_authorizedKeys[i] == req.params.key) {
      authorized = true;
    }
  }

  if (authorized) {
    var body=req.rawBody;
    body = JSON.parse(body);

    log("incoming - " + body.type);
    log("user - " + req.params.key.split("-")[0].toString());
    //Reply straight away
    res.end("200");

    switch (body.type) {
      case "transaction.created":
        //Monzo transaction created
        handleMonzoTransactionCreated(body);
        break;
      case "simple":
        handleSimplePinCreation(body);
      break;
      default:
        log("Unknown handle type '" + body.type + "'");
    }
  } else {
    log("Return 403 - Invalid Key");
    res.status(403);
    res.end("Invalid Auth Key");
  }
});
app.get('/updateToken/',function(req,res){
  log("updateToken");
  res.status(401);
  res.end("Missing Auth Key");
});
app.get('/updateToken/:key/',function(req,res){
  log("updateToken");
  res.status(400);
  res.end("Missing token");
});
app.get('/updateToken/:key/:token',function(req,res){
  log("updateToken");
  var authorized = false;
  for (var i = 0; i < SETTING_authorizedKeys.length; i++) {
    if (SETTING_authorizedKeys[i] == req.params.key) {
      authorized = true;
    }
  }
  if (authorized) {
    SETTING_timelineToken = req.params.token;
    res.end("Updated token to " + req.params.token);
  } else {
    log("Return 403 - Invalid Key");
    res.status(403);
    res.end("Invalid Auth Key");
  }

});
app.get('/ping',function(req,res){
  log("ping - pong");
  res.end("pong");
});


app.listen(port,function(){
  log("Listening on port " + port);
})
