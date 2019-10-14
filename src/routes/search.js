var express = require('express');
var router = express.Router();
const fs = require('fs');
const axios = require('axios');

/* GET search page. */
router.get('/', function(req, res, next) {
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
    if (req.query['lat'] && req.query['lon'])
        options = createZomatoOptions(req.query['lat'], req.query['lon']);
    else if (req.query['q'])
        options = createZomatoOptions(req.query['q'], null)
    else
        console.log('Error: No match query');

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
                res.sendStatus(204).json({ message: "No response from Zomato API" });
            } else {
                //  Something happenned in setting up the request that trigged an Error
                console.log('Error', error.message);
                res.sendStatus(400).json({ message: error.message });
            }
        })
});

const zomato_api = process.env.ZOMATO_API_KEY;
const zomato = {
    user_key: 'd06ef3a90843fc9361dbe4f19e9e7841',
    radius: 1000000,
    count: 10000,
}

function createZomatoOptions(q1, q2) {
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
            total : total_results,
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
    return data;
}
module.exports = router;