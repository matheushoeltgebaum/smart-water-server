let jwt = require('jsonwebtoken');

require("dotenv").config();
let secret = process.env.SECRET;

let checkToken = (req, res, next) => {
    let token = req.headers['x-access-token'] || req.headers['authorization'];
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    if (token) {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    error: 'Token não é válido.'
                });
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.status(401).json({
            error: 'Token não informado.'
        });
    }
};

module.exports = {
    checkToken: checkToken
}