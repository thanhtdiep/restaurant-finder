var express = require('express');
var router = express.Router();
const fs = require('fs');
const axios = require('axios');

// MongoDB
const MongoClient = require('mongodb').MongoClient;
const url_mongodb = "mongodb://localhost:27017/";

/* Persistence dependencies */
const redis = require('redis');
// const AWS = require('aws-sdk');

// Cloud Services Set-up
// Create unique bucket name
const bucketName = 'bennydiep-restaurantfinder-store';

// This section will change for Cloud Services
const redisClient = redis.createClient();

redisClient.on('error', (err) => {
    console.log("Error " + err);
})

/* GET search page. */
router.get('/', function (req, res, next) {
    res.writeHead(200, { 'content-type': 'text/html' });
    fs.readFile('views/html/search.html', 'utf8', (err, data) => {
        if (err) {
            res.end('Could not find or open file for reading\n');
        } else {
            res.end(data);
        }
    });
});

router.get('/full', (req, res) => {
    // --------------------------------------------------------------------------------------------
    // GET request to Zomato API
    // --------------------------------------------------------------------------------------------
    var options = null;
    var q3 = req.query['entity_id'];
    if (req.query['lat'] && req.query['lon']) {
        options = createZomatoOptions(req.query['lat'], req.query['lon'], null);
        redisKey = `location:${req.query['lat']}-${req.query['lon']}`;
    }
    else if (req.query['q']) {
        options = createZomatoOptions(req.query['q'], null, q3)
        redisKey = `restaurant:${req.query['q']}-${q3}`;
    }
    else
        console.log('Error: No match query');
    const url = `https://${options.hostname}${options.path}`;
    /* Search for existing results in Redis */
    return redisClient.get(redisKey, (err, result) => {
        if (result) {
            // Serve from Redis
            console.log("From Redis");
            const resultJSON = JSON.parse(result);
            return res.status(200).json({ source: 'Redis Cache', ...resultJSON, });
        } else {
            console.log("No data in Redis");
            const params = { Bucket: bucketName, Key: redisKey };
            // GET result from mongodb
            // ----------------------------------------------------------------
            MongoClient.connect(url_mongodb, function (err, db) {
                if (err) throw err;
                const dbo = db.db("restaurant");
                return dbo.collection('zomato').findOne({ Key: `${redisKey}`}, function(err, result) { 
                    if (err) throw err;
                    if (result) {
                        const resultJSON = JSON.parse(result.Body);
                        // Save to Redis Cache
                        redisClient.setex(redisKey, 3000, JSON.stringify(resultJSON));
                        return res.status(200).json({ source: 'MongoDB', ...resultJSON, });
                    } else {
                        // Serve from Zomato API and store in S3
                        axios.get(url)
                            .then((response) => {
                                return response.data;
                            })
                            .then((rsp) => {
                                const responseJSON = filter(JSON.stringify(rsp));
                                // Save to Redis Cache
                                redisClient.setex(redisKey, 3600, JSON.stringify(responseJSON));
                                // Save to mongoDB
                                const body = JSON.stringify(responseJSON);
                                const objectParams = { Bucket: bucketName, Key: redisKey, Body: body };
                                MongoClient.connect(url_mongodb, function (err, db) {
                                    if (err) throw err;
                                    var dbo = db.db("restaurant");
                                    dbo.collection("zomato").insertOne(objectParams, function (err, res) {
                                        if (err) throw err;
                                        console.log("1 document inserted");
                                        db.close();
                                    });
                                });
                                return res.status(200).json({ source: 'Zomato API', ...responseJSON, });
                            })
                            .catch((error) => {
                                if (error.message) {
                                    // Request made and server responded
                                    console.log("Error:" + error.message);
                                } else if (error.request) {
                                    // The request was made but no response received
                                    console.log("No repsonse for: " + error.request);
                                    res.sendStatus(204).json({ message: "No response from Zomato API" });
                                } else {
                                    //  Something happenned in setting up the request that trigged an Error
                                    console.log('Error', error.message);
                                    res.sendStatus(400).json({ message: error.message });
                                }
                            });
                    }
                    db.close();
                });
            });
        }
    });
});

const zomato_api = process.env.ZOMATO_API_KEY;
const zomato = {
    user_key: 'd06ef3a90843fc9361dbe4f19e9e7841',
    radius: 1000000,
    count: 10000,
}

function createZomatoOptions(q1, q2, q3) {
    const options = {
        hostname: 'developers.zomato.com',
        port: 443,
        path: '/api/v2.1/search?',
        method: 'GET'
    }
    var str
    if (q2) {
        str =
            'lat=' + q1 +
            '&lon=' + q2 +
            // '&radius=' + zomato.radius +
            '&count=' + zomato.count +
            '&apikey=' + zomato.user_key;
    } else {
        str =
            'q=' + q1 +
            '&count=' + zomato.count +
            '&entity_id=' + q3 +
            '&entity_type=' + 'city' +
            '&apikey=' + zomato.user_key;
        // '&radius=' + zomato.radius;
    }
    options.path += str;
    return options;
}

function filter(res) {
    // --------------------------------------------------------------------------------------------
    // Used to filter unwanted JSON object and complied wanted object into one
    // INPUT:
    //    res - stringtified JSON object with many unwanted/unnecessary information
    // RETURN:
    //    data - filtered/simplified and stringtified JSON object 
    // --------------------------------------------------------------------------------------------
    const content = JSON.parse(res).restaurants;
    var total_results = JSON.parse(res).results_found;
    var data = [];
    for (var x in content) {
        const reviewContent = content[x].restaurant.all_reviews;
        var obj = {
            total: total_results,
            name: content[x].restaurant.name,
            cuisines: content[x].restaurant.cuisines,
            address: content[x].restaurant.location.address,
            zipcode: content[x].restaurant.location.zipcode,
            lat: content[x].restaurant.location.latitude,
            lng: content[x].restaurant.location.longitude,
            timings: content[x].restaurant.timings,
            photos: content[x].restaurant.photos,
            phone_numbers: content[x].restaurant.phone_numbers,
            reviews: reviewContent.reviews
        }
        data.push(obj);
    }
    data = { 'length': data.length, ...data };
    return data;
}
module.exports = router;