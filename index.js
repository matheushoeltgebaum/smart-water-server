const express = require("express"),
  admin = require("firebase-admin"),
  http = require("http"),
  axios = require("axios");

const serviceAccount = require("./config/smart-water-server-admin.json");

//Inicializa o App Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://smart-water-5839d.firebaseio.com"
});

const app = express();

//Configura o servidor para tratar requisições com JSON e codificação na URL.
app.use(express.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

//Carrega o database.
let db = admin.firestore();

const sigfoxApiUrl = "https://api.sigfox.com";
app.post("/sigfoxDevice", (req, res) => {
  let auth = req.body.auth;

  //Realiza a requisição para o Sigfox, buscando o device vinculado a conta informada.
  axios
    .get(sigfoxApiUrl + "/v2/devices?limit=1", {
      headers: {
        Authorization: "Basic " + auth
      }
    })
    .then(resp => {
      var data = resp.data;
      res.status(200).json(data);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        error: "Não foi possível encontrar devices para a conta informada."
      });
    });
});

app.post("/deviceMessages", (req, res) => {
  var deviceId = req.body.deviceId;
  var auth = req.body.auth;

  axios
    .get(sigfoxApiUrl + "/v2/devices/" + deviceId + "/messages", {
      headers: {
        Authorization: "Basic " + auth
      }
    })
    .then(resp => {
      var data = resp.data;
      res.status(200).json(data);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        error: "Não foi possível buscar as mensagens do device informado."
      });
    });
});

app.post("/sigfoxCredentials", (req, res) => {
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
            //Gera o token de acesso para o sistema
            res.status(200).json({
              apiUser: doc.get("apiUser"),
              apiPassword: doc.get("apiPassword")
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

app.post("/token", (req, res) => {
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
            //Gera o token de acesso para o sistema
            admin
              .auth()
              .createCustomToken(doc.id)
              .then(function(token) {
                res.status(200).json({ token: token });
              })
              .catch(err => {
                //console.log(err);
                res
                  .status(500)
                  .json({ error: "Erro ao gerar token de acesso." });
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

const port = process.env.PORT || 3000;

//Instancia o servidor.
http.createServer(app).listen(port, function(err) {
  console.log("listening in http://localhost:" + port);
});
