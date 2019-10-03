var express = require('express');
var router = express.Router();
const axios = require('axios');


router.get('/full', (req, res) => {
    // --------------------------------------------------------------------------------------------
    // GET request to OpenWeather API
    // --------------------------------------------------------------------------------------------
    const options = createOWOptions(req.query['lat'], req.query['lon']);
    const url = `https://${options.hostname}${options.path}`;
    axios.get(url)
        .then((response) => {
            res.writeHead(response.status, { 'content-type': 'application/json' });
            return response.data;
        })
        .then((rsp) => {
            const result = filter(JSON.stringify(rsp));
            res.end(JSON.stringify(result));
        })
        .catch((error) => {
            if (error.message) {
                // Request made and server responded
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
            } else if (error.request) {
                // The request was made but no response received
                console.log("No repsonse for: " + error.request);
                res.sendStatus(204).json({ message: "No response from OpenWeather API" });
            } else {
                //  Something happenned in setting up the request that trigged an Error
                console.log('Error', error.message);
                res.sendStatus(400).json({ message: error.message });
            }
        })
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