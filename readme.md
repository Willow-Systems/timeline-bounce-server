# Pebble - Timeline Bounce Server

Version 1.1

#### About



Timeline bounce is a NodeJS server which accepts web requests with JSON data and then generates web requests to [rebble web services](https://rebble.io) to create a timeline pin for the [pebble smartwatch](https://en.wikipedia.org/wiki/Pebble_(watch)).   

   

Although it can be used to make programmatic timeline pin creation easier, it is designed to be used with [Monzo Webhooks](https://docs.monzo.com/#webhooks) to push debit card transaction information to timeline.



#### Prerequisites



The server is designed to run 24/7, and be publicly available on the internet, so as to allow Monzo web hooks to trigger it. It has a very basic form of authentication explained later. Before you can get it fully working, you will need:



- A server (or computer on 24/7) with NodeJS and npm installed

- A URL or Static IP address which is publicly accessible (Use a dynamic DNS if running from your home)

- Port 443 forwarded to Nginx, or the application if you want to update the code to use HTTPS with express (see the warning below)



The server runs by default on port 8082, and does not include HTTPS, this is because it is designed to run behind NGINX.



###### ⚠️ Security Warning ⚠️



I **STRONGLY** advise you to run the server behind a reverse proxy which adds TLS. If not, you will have to modify the nodeJS code to handle TLS with express.



The authentication token is sent as part of the URL, so **if you do not use HTTPS you will be vulnerably to Man-In-The-Middle attacks and more**. It's a terrible idea.

  

If you do not already have nginx setup, you'll need to install it and use a service like Let'sEncrypt to get an https certificate for your domain.





#### Server Installation



Install the prerequisite librarys:



`npm install express request uuid`



That's it. You can now run the server in the background. 



Before you run the server, you will need to configure it with some keys.



#### Server Configuration



You need to update the server file with your pebble timeline token, used to authenticate the server to rebble web services, as well as the 'access tokens' used to authenticate incoming requests to the server.



Update the following lines:



##### Timeline Token



> var SETTING_timelineToken = ""



This should be your timeline token. If you don't have a token and need to generate one, you can use the [generate token app](https://github.com/Willow-Systems/pebble-generate-token). Eventually I'll make an app which will generate a token and push it to the server.



> var SETTING_timelineToken = ""



becomes



> var SETTING_timelineToken = "<your pebble timeline token>"



##### Access Keys



The access keys are sent at the end of incoming requests in the URL, this is so that we stay compatible with Monzo's webhooks. The format of an access token is:   



<name>-<token>  



e.g. 



monzo-fd83J1gzDjl



To set the access keys, update the line



> var SETTING_authorizedKeys = []



to 



> var SETTING_authorizedKeys = ["monzo-fd83J1gzDjl", "otheruser-oXC2k49vS"]



##### Reduced Info Mode



When a transaction is created in Monzo (i.e. you spend some money) a pin is created with the amount, the date, and the vendor name and address. If you want to only show the amount, set reduced info mode to true, by updating the line



> SETTING_reducedInfoMode = false



to 



> SETTING_reducedInfoMode = true



##### Verbose



To increase logging, update



> verbose = false;



to 



> verbose = true;



#### Localisation



If you want to change the language of the pins, you can update the string variable which start with STRING_, such as 



> STRING_spent = "spent"



could be translated into french by updating it to 



> STRING_spent = "dépensé"



#### Running the server 



Once you have updated your settings, save the nodejs file and run it in the background.



On linux you can do this via nohup:



`nohup node timelineBounce.js &`



The server log will now be in nohup.out



#### Next Steps



Now you need to configure the Monzo webhook to call your server. This should be at the address configured in Nginx, which forwards to the server.   

   

#### API Reference



Here are the API endpoints which the server accepts:



GET /ping  -  Returns 'pong' and a 200 code, useful for testing internet-facing connectivity



POST /incoming/{key}  -  Used for creating a pin, see below for POST body details. {key} is the access key



POST BODY:



There are currently two types of request `simple`, which does minimal parsing, just creates a token, and `transaction.created`, which is for a new Monzo card transaction



For the simple token creation, the JSON is:

> {

    "type": "simple",

    "data": {

        "title": "Title of the pin",

        "body": "Body of the pin"

    }

  }

  

If `type` is `transaction.created` it will be handled as a monzo transaction creation, and parsed according to the format [in the monzo documentation](https://docs.monzo.com/#transaction-created)    

    

GET /updateToken/{key}/{token}  -  Updated the in-memory timeline token to the value provided in {token}, this isn't a mature feature yet, as a server restart will revert to the declared value. Eventually I'll make a dedicated watchapp which will update the token using this endpoint



#### Questions



If you have any further questions, find me (will0) on the [rebble discord](https://discordapp.com/invite/aRUAYFN)
