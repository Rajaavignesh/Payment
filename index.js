"use strict";

const express = require("express");
const braintree = require("braintree");
const paypal = require("paypal-rest-sdk");

const bodyParser = require("body-parser");
const mysql = require("mysql");
const app = express();
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

// const Env= use()

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Serve index.html on the root path
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

//Establish the database connection

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "db_project",
});

db.connect(function (error) {
  if (error) {
    console.log(error);
    console.log("Error Connecting to DB");
  } else {
    console.log("Successfully connected to DB");
  }
});

//Establish the port
app.listen(5000, function check(error) {
  if (error) console.log("Error.....!!!!");
  else console.log("Started....!!!!");
});

// Set up PayPal API credentials
paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id: process.env.client_id,
  client_secret: process.env.client_secret,
});

// Handle credit card payment request
app.post("/process_payment", async (req, res) => {


  const cardData = {
    type: req.body.card_type,
    number: req.body.card_number,
    expire_month: req.body.expire_month,
    expire_year: req.body.expire_year,
    cvv2: req.body.cvv2,
  };

 
  const paymentDetails = {
    intent: "sale",
    payer: {
      payment_method: "credit_card",
      funding_instruments: [
        {
          credit_card: {
            type: cardData.type,
            number: cardData.number,
            expire_month: cardData.expire_month,
            expire_year: cardData.expire_year,
            cvv: cardData.cvv2,
          },
        },
      ],
    },
    transactions: [
      {
        amount: {
          total: req.body.amount,
          currency: req.body.currency,
        },
      },
    ],
  };
  
   if (
    cardData.type === "AMEX" &&
    (req.body.currency === "USD" ||
      req.body.currency === "EUR" ||
      req.body.currency === "AUD")
  ) {
    // Use Paypal
    var payment = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: "http://localhost:5000/execute-payment",
        cancel_url: "http://localhost:5000/cancel-payment",
      },
      transactions: [
        {
          amount: {
            total: req.body.amount,
            currency: req.body.currency,
          },
          description: "Payment description",
        },
      ],
    };
    let data
    paypal.payment.create(payment, function (error, payment) {
      if (error) {
        console.error(error);
        res.send(error);
      } else {
        // console.log(payment);
        var paymentId = payment.id;

        var redirectUrl;
        for (var i = 0; i < payment.links.length; i++) {
          var link = payment.links[i];
          if (link.method === "REDIRECT") {
            redirectUrl = link.href;
          }
        }
        data = {
          transaction_id: payment.id,
          status: payment.state,
          currency_code: req.body.currency,
          redirect_url: redirectUrl
        };
        
        res.status(200).send({data: data});
      }
    });





  } else {
    if (req.body.currency !== "USD" && cardData.type === "AMEX") {
      // Return error message
      res.status(400).send("AMEX is possible to use only for USD");
    } else {
      // Use Braintree

      console.log("Payment processed using Braintree");

      const gateway = new braintree.BraintreeGateway({
        environment: braintree.Environment.Sandbox,
        merchantId: process.env.merchantId,
        publicKey: process.env.publicKey,
        privateKey: process.env.privateKey,
      });
      let data
      // create a transaction sale request
      let transactionRequest = {
        amount: req.body.amount,
        customer: {
          firstName: "John",
          lastName: "Doe",
        },
        creditCard: {
          number: req.body.card_number,
          expirationDate: `${req.body.expire_month}/${req.body.expire_year}`,
          cvv: req.body.cvv2,
        },
        options: {
          submitForSettlement: true,
        },
      };

      // make the transaction sale request

      await gateway.transaction.sale(
        transactionRequest,
        function (err, result) {
          if (err) {
            console.error(err);
            res.status(500).send(err);
          }

          if (result.success) {
            console.log("Transaction ID: " + result.transaction.id);

            data = {
              transaction_id: result.transaction.id,
              status: result.transaction.status,
              currency_code: result.transaction.currencyIsoCode,
              amount: result.transaction.amount,
            };
            res.status(200).send({ data: data });
          } else {
            console.log(result.message);
          }

          console.log(data);
        }
      );
    }
  }


  
});

//test payment Paypal
app.post("/create-payment", function (req, res) {
  var payment = {
    intent: "sale",
    payer: {
      payment_method: "paypal",
    },
    redirect_urls: {
      return_url: "http://localhost:5000/execute-payment",
      cancel_url: "http://localhost:5000/cancel-payment",
    },
    transactions: [
      {
        amount: {
          total: "10.00",
          currency: "USD",
        },
        description: "Payment description",
      },
    ],
  };

  paypal.payment.create(payment, function (error, payment) {
    if (error) {
      console.error(error);
      res.send(error);
    } else {
      console.log(payment);
      var paymentId = payment.id;
      var redirectUrl;
      for (var i = 0; i < payment.links.length; i++) {
        var link = payment.links[i];
        if (link.method === "REDIRECT") {
          redirectUrl = link.href;
        }
      }
      //  console.log("redirectUrl", redirectUrl)
      res.redirect(redirectUrl);
    }
  });
});

app.get("/success", (req, res) => {
  var paymentId = "PAYID-MQ6CYMY9JM447478A2779232";
  var payerId = { payer_id: req.query.PayerID };

  paypal.payment.execute(paymentId, payerId, function (error, payment) {
    if (error) {
      console.error(error);
      res.status(400).send(error);
    } else {
      console.log(payment);
      res.send("Payment Success");
    }
  });
});

app.get("/cancel", (req, res) => res.send("Payment Cancelled"));
