var express = require('express');
var router = express.Router();
const axios = require('axios');

/* Persistence dependencies */
const redis = require('redis');
const AWS = require('aws-sdk');

// Cloud Services Set-up
// Create unique bucket name
const bucketName = 'bennydiep-openweather-store';

// Create a promise on S3 service object
const bucketPromise = new AWS.S3({ apiVersion: '2006-03-01' }).createBucket({ Bucket: bucketName }).promise();
bucketPromise.then(function (data) {
    console.log("Successfully created " + bucketName);
})
    .catch(function (err) {
        console.error(err, err.stack);
    });

// This section will change for Cloud Services
const redisClient = redis.createClient();

redisClient.on('error', (err) => {
    console.log("Error " + err);
})

router.get('/full', (req, res) => {
    // --------------------------------------------------------------------------------------------
    // GET request to OpenWeather API
    // --------------------------------------------------------------------------------------------
    const options = createOWOptions(req.query['lat'], req.query['lon']);
    const url = `https://${options.hostname}${options.path}`;
    const redisKey = `weather:${req.query['lat']}-${req.query['lon']}`;
    /* Search for existing results in Redis */
    return redisClient.get(redisKey, (err, result) => {
        if (result) {
            // Serve from Redis
            const resultJSON = JSON.parse(result);
            return res.status(200).json({source: 'Redis Cache', ...resultJSON,});
        } else {
            const params = { Bucket: bucketName, Key: redisKey };
            return new AWS.S3({ apiVersion: '2006-03-01' }).getObject(params, (err, result) => {
                if (result) {
                    //Serve from S3
                    const resultJSON = JSON.parse(result.Body);
                    //Save to Redis Cache
                    redisClient.setex(redisKey, 3600, JSON.stringify(resultJSON));
                    return res.status(200).json({source: 'S3 Storage', ...resultJSON,});
                } else {
                    // Serve from Zomato API and store in S3
                    axios.get(url)
                        .then((response) => {
                            // res.writeHead(response.status, { 'content-type': 'application/json' });
                            return response.data;
                        })
                        .then((rsp) => {
                            const responseJSON = filter(JSON.stringify(rsp));
                            // Save to Redis Cache
                            redisClient.setex(redisKey, 3600, JSON.stringify(responseJSON));
                            // Save to S3 
                            const body = JSON.stringify(responseJSON);
                            const objectParams = { Bucket: bucketName, Key: redisKey, Body: body };
                            const uploadPromise = new AWS.S3({ apiVersion: '2006-03-01' }).putObject(objectParams).promise();
                            uploadPromise.then(function (data) {
                                console.log("Successfully uploaded data to " + bucketName + "/" + redisKey);
                            });
                            return res.status(200).json({ source: 'OpenWeather API', ...responseJSON, });
                        })
                        .catch((error) => {
                            if (error.message) {
                                // Request made and server responded
                                console.log("Error:" + error.message);
                            } else if (error.request) {
                                // The request was made but no response received
                                console.log("No repsonse for: " + error.request);
                                res.sendStatus(204).json({ message: "No response from OpenWeather API" });
                            } else {
                                //  Something happenned in setting up the request that trigged an Error
                                console.log('Error', error.message);
                                res.sendStatus(400).json({ message: error.message });
                            }
                        });
                }
            });
        }
    });
});


const openWeather = {
    user_key: 'c17209fc211ed03b332022bd87d8933b',
    unit: 'metric'
}

function createOWOptions(lat, long) {
    const options = {
        hostname: 'api.openweathermap.org',
        port: 443,
        path: '/data/2.5/weather?',
        method: 'GET'
    }

    const str =
        'lat=' + lat +
        '&lon=' + long +
        '&appid=' + openWeather.user_key +
        '&units=' + openWeather.unit;

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
    const content = JSON.parse(res);
    var data = [];
    var obj = {
        weather: content.weather[0].main,
        temp: content.main.temp,
        pressure: content.main.pressure,
        humidity: content.main.humidity,
        wind_speed: content.wind.speed,
        name: content.name,
        icon: content.weather[0].icon,
    }
    data.push(obj);
    return data;
}

module.exports = router;