var express = require('express');
var router = express.Router();

/* GET the menus page */
router.get('/menus', function (req, res, next){
	start = new Date(2016, 10-1, 3);
	now = new Date();
	week = 7*24*60*60*1000;
	currWeek = (req.query.week) ? parseInt(req.query.week) : Math.floor((now-start)/week) + 1;
	res.render('info/menus', {week: currWeek});
});

module.exports = router;