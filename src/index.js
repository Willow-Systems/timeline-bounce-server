import Express from "express";
import toml from "toml";
import fs from "fs";
import XMLHttpRequest from "xmlhttprequest-ssl";
const port = 8082;
var app = Express();

// Tools
import log from "./tools/logging.js";
import { currencyToSymbol, moneyFormat } from "./tools/currency.js";
import generateNewPinID from "./tools/pinid.js";
import parse from "./tools/middleware.js";

// You shouldn't ever need to change these; see config.toml
const config = toml.parse(fs.readFileSync("config.toml", "utf-8"));
export var verbose = config.util.verbose; // hacky but it works
var SETTING_timelineToken = config.rws.timeline_token;
var SETTING_authorizedKeys = config.util.authorized_keys;
var SETTING_reducedInfoMode = config.monzo.reduced_info_mode;
var STRING_spent = config.monzo.spent;
var STRING_recieved = config.monzo.recieved;
var STRING_at = config.monzo.at;
var STRING_from = config.monzo.from;

app.use(parse);

//
// Monzo
//

/**
 * Handle a Monzo transaction created event via the webhook
 */
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
    fdata.amountString =
      currencyToSymbol(obj.data.currency) +
      moneyFormat(obj.data.amount.toString().replace("-", ""));

    if (data.local_currency != null && data.local_currency != data.currency) {
      //It was a foreign currency, append the local amount E.g. Spent £10.00 (€11.00)
      fdata.amountString =
        fdata.amountString +
        " (" +
        currencyToSymbol(obj.data.local_currency) +
        moneyFormat(obj.data.local_amount.toString().replace("-", "")) +
        ")";
    }

    var pbody = "";
    //Set the body as the merchant address (we will remove this if in reduced info mode)
    if (
      data.merchant != null &&
      data.merchant.address != null &&
      data.merchant.address.short_formatted != null
    ) {
      pbody = data.merchant.address.short_formatted;
    }

    if (SETTING_reducedInfoMode) {
      //We don't want to put much information in the pin
      pbody = "";
      var ptitle = fdata.verb + " " + fdata.amountString;
    } else {
      var ptitle =
        fdata.verb +
        " " +
        fdata.amountString +
        " " +
        fdata.titleSeperator +
        " " +
        obj.data.description;
    }

    //Hockey puck? No no, that's a coin now...
    createTimelinePin(
      generateNewPinID(),
      SETTING_timelineToken,
      obj.data.created.toString(),
      ptitle,
      pbody,
      "HOCKEY_GAME"
    );
    log("Created pin", true);
  }
}

//
// Pin Management
//

// Handle a simple pin creation request (non-complex, simple title and body pins)
function handleSimplePinCreation(obj) {
  var pinDate = new Date().toISOString().split(".")[0] + "Z";
  createTimelinePin(
    generateNewPinID(),
    SETTING_timelineToken,
    pinDate,
    obj.data.title,
    obj.data.body
  );
}

// Create a "complex" pin, with a title, body, icon, and theoretically more if you want
function createTimelinePin(
  id,
  token,
  time,
  title,
  body,
  flag = "NOTIFICATION_FLAG"
) {
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
    "Content-Type": "application/json",
    "X-User-Token": token
  };

  // Configure the request
  var options = {
    url: "https://timeline-api.rebble.io/v1/user/pins/" + id,
    method: "PUT",
    headers: headers,
    json: pin
  };

  log("request.headers: " + JSON.stringify(headers), true);
  log("request.options: " + JSON.stringify(options), true);

  // Start the request
  var xhr = new XMLHttpRequest();
  xhr.open(options.method, options.url);
  for (var k in options.headers) {
    xhr.setRequestHeader(k, options.headers[k]);
  }
  xhr.send(JSON.stringify(pin));

  // error handling
  xhr.addEventListener("error", function (e) {
    log("Error - Pin creation error - " + e);
  });
  xhr.addEventListener("load", function () {
    // parse response
    xhr.response = JSON.parse(xhr.responseText);
    console.log(xhr.response);
    if (xhr.response.status == 200) {
      log("Success - Successful pin creation");
      log(xhr.response.responseText, true);
    } else {
      log(
        "Error - Pin creation error - " +
          JSON.stringify(xhr.response) +
          " - " +
          xhr.status
      );
      log("Body: " + JSON.stringify(xhr.response), true);
    }
  });
}

//
// Web pin pusher (for testing)
//

// Missing key (sad)
app.post("/incoming/", function (req, res) {
  log("Return 401 - Missing Key");
  res.status(401);
  res.end("Missing Auth Key");
});
// Has a key (happy)
app.post("/incoming/:key", function (req, res) {
  var authorized = false;
  for (var i = 0; i < SETTING_authorizedKeys.length; i++) {
    if (SETTING_authorizedKeys[i] == req.params.key) {
      authorized = true;
    }
  }

  if (authorized) {
    var body = req.rawBody;
    body = JSON.parse(body);

    log("incoming - " + body.type);
    log("user - " + req.params.key.split("-")[0].toString());
    //Reply straight away (we don't want to wait for the pin to be created, as RWS can take a while to push)
    res.end("200");

    switch (body.type) {
      case "transaction.created":
        //Monzo transaction created, handle it using the above helper function
        handleMonzoTransactionCreated(body);
        break;
      case "simple":
        // Simple pin creation request, handle it using the above helper function
        handleSimplePinCreation(body);
        break;
      default:
        // Clueless; log it and panic
        log("Unknown handle type '" + body.type + "'");
    }
  } else {
    // Invalid key (sad)
    log("Return 403 - Invalid Key");
    res.status(403);
    res.end("Invalid Auth Key");
  }
});

// Update the token, but you forgot the key (sad)
app.get("/updateToken/", function (req, res) {
  log("updateToken");
  res.status(401);
  res.end("Missing Auth Key");
});
// Update the token, but you forgot the token (sad)
app.get("/updateToken/:key/", function (req, res) {
  log("updateToken");
  res.status(400);
  res.end("Missing token");
});
// Update the token
app.get("/updateToken/:key/:token", function (req, res) {
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
app.get("/ping", function (req, res) {
  log("ping - pong");
  res.end("pong");
});
app.listen(port, function () {
  log("Listening on port " + port);
});
