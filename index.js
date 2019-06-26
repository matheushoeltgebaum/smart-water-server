const express = require("express"),
  admin = require("firebase-admin"),
  http = require("http"),
  jwt = require('jsonwebtoken'),
  middleware = require('./middleware');

require("dotenv").config();
let secret = process.env.SECRET;

admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  }),
  databaseURL: "https://smart-water-5839d.firebaseio.com"
});

const app = express();

//Configura o servidor para tratar requisições com JSON e codificação na URL.
app.use(express.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

//Carrega o database.
let db = admin.firestore();

app.get("/", (req, res) => {
    res.status(200).send("Welcome to the Smart Water Server!");
  });

app.post("/credentials", (req, res) => {
  let username = req.body.login;
  let password = req.body.password;

  if (username && password) {
    let users = db.collection("users");

    //Realiza uma query buscando o usuário pelo nome do usuário e senha da requisição.
    var userQuery = users
      .where("username", "==", username)
      .where("password", "==", password)
      .limit(1);

    userQuery
      .get()
      .then(snapshot => {
        if (snapshot.size > 0) {
          snapshot.forEach(doc => {
            let token = jwt.sign({username: username}, secret, {
                expiresIn: '3h'
            });
            res.status(200).json({
              deviceId: doc.get("deviceId"),
              token: token
            });
          });
        } else {
          res.status(401).json({ error: "Usuário ou senha incorretos." });
        }
      })
      .catch(err => {
        console.log("Error getting documents", err);
      });
  } else {
    res.status(400).json({ error: "Usuário ou senha não informados." });
  }
});

app.post("/uplink", middleware.checkToken, (req, res) => {
  let deviceId = req.body.device;
  let data = req.body.data;
  let time = req.body.time;

  //Remove padding de 0 existente à frente do valor.
  data = data.replace(/^0+/g, "");

  let messages = db.collection("messages");

  messages.add({
    deviceId: deviceId,
    data: Number(data),
    time: Number(time)
  });

  res.status(200).json({
	  "deviceId": deviceId,
	  "downlinkData": 00
  });
});

app.post("/yearlyMessages", middleware.checkToken, (req, res) => {
  let deviceId = req.body.deviceId;
  let currentDate = req.body.date ? new Date(req.body.date) : new Date();
  let messages = db.collection("messages");
  let response = [];

  //Realiza uma query buscando as mensagens com base no id do device.
  var messagesQuery = messages.where("deviceId", "==", deviceId);
  let initialPeriodDate = Date.parse(
    new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth() + 1,
      1
    ).toDateString()
  );

  let finalPeriodDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  messagesQuery
    .get()
    .then(snapshot => {
      if (snapshot.size > 0) {
        snapshot.forEach(doc => {
          let time = doc.get("time") * 1000;
		  //Pega apenas o dia, mês e ano da data (desconsiderando tempo).
		  time = Date.parse(new Date(time).toDateString());
          //Verifica se a mensagem está dentro do intervalo de 1 ano.
          if (time >= initialPeriodDate && time <= finalPeriodDate) {
            response.push({
              time: time,
              data: doc.get("data") / 100
            });
          }
        });
      }
      res.status(200).json(
        response.sort((a, b) => {
          if (a.time < b.time) {
            return -1;
          }
          if (a.time > b.time) {
            return 1;
          }

          return 0;
        })
      );
    })
    .catch(err => {
      console.log("Error getting messages from device.", err);
      res.status(500).json({
        error: "Não foi possível buscar as mensagens do dispositivo informado"
      });
    });
});

app.post("/monthlyMessages", middleware.checkToken, (req, res) => {
  let deviceId = req.body.deviceId;
  let currentDate = req.body.date ? new Date(req.body.date) : new Date();
  let messages = db.collection("messages");
  let response = [];

  //Realiza uma query buscando as mensagens com base no id do device.
  var messagesQuery = messages.where("deviceId", "==", deviceId);
  let initialPeriodDate = Date.parse(
    new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    ).toDateString()
  );

  let finalPeriodDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  messagesQuery
    .get()
    .then(snapshot => {
      if (snapshot.size > 0) {
        snapshot.forEach(doc => {
          let time = doc.get("time") * 1000;
		  //Pega apenas o dia, mês e ano da data (desconsiderando tempo).
		  time = Date.parse(new Date(time).toDateString());
          //Verifica se a mensagem está dentro do intervalo de 1 ano.
          if (time >= initialPeriodDate && time <= finalPeriodDate) {
            response.push({
              time: time,
              data: doc.get("data") / 100
            });
          }
        });
      }
      res.status(200).json(
        response.sort((a, b) => {
          if (a.time < b.time) {
            return -1;
          }
          if (a.time > b.time) {
            return 1;
          }

          return 0;
        })
      );
    })
    .catch(err => {
      console.log("Error getting messages from device.", err);
      res.status(500).json({
        error: "Não foi possível buscar as mensagens do dispositivo informado"
      });
    });
});

const port = process.env.PORT || 3000;

//Instancia o servidor.
http.createServer(app).listen(port, function(err) {
  console.log("Server listening on port: " + port);
});
