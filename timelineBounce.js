const express = require('express');
const request = require('request');
const port = 8082;
const uuidv4 = require('uuid/v4');
var app = express();
var verbose = true;
var version = 1.0;

var timelineToken = "adrCWt4C5tOA-qGFkU7aVkEobvTxGElVGrBFXrcz0ck";

var authorizedKeys = ["monzo-87af5abcf0de4937", "juliet-ce20ef18-845e"]

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

app.post('/incoming/',function(req,res){
  log("Return 401 - Missing Key");
  res.status(401);
  res.end("Missing Auth Key");
});
app.post('/incoming/:key',function(req,res){
  var authorized = false;
  for (var i = 0; i < authorizedKeys.length; i++) {
    if (authorizedKeys[i] == req.params.key) {
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
  for (var i = 0; i < authorizedKeys.length; i++) {
    if (authorizedKeys[i] == req.params.key) {
      authorized = true;
    }
  }
  if (authorized) {
    timelineToken = req.params.token;
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

function generateNewPinID() {
  return "willow-systems-" + uuidv4().split("-")[0];
}

function handleMonzoTransactionCreated(obj) {
  log("Handling Monzo Transaction", true);
  log("Obj: " + JSON.stringify(obj), true);
  // var pbody = obj.data.merchant.address.address + ", " + obj.data.merchant.address.city;
  var pbody = "";
  var ptitle = "Spent " + currencyToSymbol(obj.data.currency) + moneyFormat(obj.data.amount.toString().replace("-",""));
  createTimelinePin(generateNewPinID(), timelineToken, obj.data.created.toString(), ptitle, pbody, "HOCKEY_GAME");
  log("Created pin", true)
}
function handleSimplePinCreation(obj) {
  var pinDate = new Date().toISOString().split('.')[0]+"Z";
  createTimelinePin(generateNewPinID(), timelineToken, pinDate, obj.title, obj.body);
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


app.listen(port,function(){
  log("Listening on port " + port);
})
