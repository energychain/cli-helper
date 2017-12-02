const vorpal = require('vorpal')();

var cli = new require("../index.js")(vorpal);


vorpal
		.delimiter('stromdao-mp $')
		.show();
