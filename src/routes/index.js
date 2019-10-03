var express = require('express');
var router = express.Router();
const fs = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.writeHead(200, {'content-type': 'text/html'});
  fs.readFile('views/html/index.html', 'utf8', (err, data) => {
    if(err){
      res.end('Could not find or open file for reading\n');
    } else {
      res.end(data);
    }
  });
});

module.exports = router;
