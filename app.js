var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();
var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://davidnap2:01010101@ds163397.mlab.com:63397/davidnap2';
//var mongourl = 'mongodb://localhost:27017/test';
var fileUpload = require('express-fileupload');

app = express();

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app.set('view engine','ejs');

//
app.use(session({
  userid: 'session',
  keys: [SECRETKEY1,SECRETKEY2],
  maxAge: 5 * 60 * 1000
}));
//
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.use(fileUpload());
app.use(bodyParser.json());
//
app.get('/',function(req,res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	res.redirect('/read');
});

app.get('/login',function(req,res) {
	res.sendFile(__dirname + '/public/login.html');
});

app.get('/register', function(req, res) {
	res.sendfile(__dirname +  '/public/register.html');
});

app.get('/logout',function(req,res) {
	req.session = null;
	res.redirect('/');
});

app.get('/display', function(req, res) {
if (!req.session.authenticated) {
		res.redirect('/login');
	}
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var objectId = {_id: ObjectId(req.query._id)};
		findNRestaurants(db,objectId,function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB\n');
			console.log(JSON.stringify(restaurants));
			res.render('display',{dr:restaurants[0]});
			//res.end();
		});
	});
});
function findNRestaurants(db,criteria,callback) {
		var restaurants = [];
		db.collection('rest2').find(criteria,function(err,result) {
			assert.equal(err,null);
			result.each(function(err,doc) {
				if (doc != null) {
					restaurants.push(doc);
				} else {
					callback(restaurants);
				}
			});
		})
}


function find1Cafe(db,criteria,callback) {
    db.collection('rest2').findOne(criteria,function(err,result) {
        assert.equal(err,null);
        callback(result);
    });
}

app.get('/remove', function(req, res){
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	var resultArray = [];
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB');
		
		var cursor = db.collection('rest2').find({_id:ObjectId(req.query._id)});
			cursor.forEach(function(doc, err){
				assert.equal(null, err);
				resultArray.push(doc);	
			}, function(){
				console.log('useird='+resultArray[0].userid);
				if(resultArray[0].userid == req.session.userid){
					db.collection('rest2').remove({_id:ObjectId(req.query._id)});
					db.close();
					res.redirect('/');
				}
				res.sendfile(__dirname +  '/public/removeerr.html');
			});
	});
});

app.get('/read', function(req,res) {
	if(!req.session.authenticated){
		res.redirect('/');
	}
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		findNrest(db,req.query,function(rest) {
			db.close();
			console.log('Disconnected MongoDB\n');
			res.render('read',{r:rest, userid:req.session.userid, criteria: JSON.stringify(req.query)});
			//res.end();
		});
	});
});
function findNrest(db,criteria, callback) {
	var restaurants = [];
		db.collection('rest2').find(criteria,function(err,result) {
			assert.equal(err,null);
			result.each(function(err,doc) {
				if (doc != null) {
					restaurants.push(doc);
				} else {
					callback(restaurants);
				}
			});
		})
}

app.get('/create',function(req,res) {
	if(!req.session.authenticated){
		res.redirect('/read');
	}
	res.render('create',{userid:req.session.userid});
});

app.get('/rate', function(req,res){
	if(!req.session.authenticated){
		res.redirect('/');
	}
	res.render('rate',{userid:req.session.userid});
});

//login
app.post('/login',function(req,res) {
	var resultArray = [];
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB');

		var cursor = db.collection('account').find({'userid': req.body.userid});
			cursor.forEach(function(doc, err){
				assert.equal(null, err);
				resultArray.push(doc);		
			}, function(){
				db.close();
				for (var i=0; i<resultArray.length; i++) {
					if (resultArray[0].userid == req.body.userid && resultArray[0].password == req.body.password) {
						req.session.authenticated = true;
						req.session.userid = resultArray[0].userid;
					}
				}
					res.redirect('/');	
		});
	});	
});
//register
app.post('/register', function(req, res){
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB');
		
		db.collection('account').findOne({'userid': req.body.userid}, function(err,doc) {
			console.log(doc);
		
			if(doc == null && req.body.password == req.body.conpassword && req.body.conpassword != '' && req.body.password != '' && req.body.conpassword !=''){
				db.collection('account').insert({'userid': req.body.userid, 'password': req.body.password});
				res.redirect('/login');
			}else{
				res.redirect('/register');
			}
		db.close();
		});
	});
});
	
//
app.post('/create',function(req,res) {	
	
 var sampleFile;

    if (!req.files) {
        res.send('No files were uploaded.');
        return;
    }

    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
      create(db,req.files.sampleFile,req.body,res,req,function(result) {
          db.close();
          if (result.insertedId != null) {
            res.status(200);
			res.redirect('/read');
          } else {
            res.status(500);
            res.end(JSON.stringify(result));
          }
      });
    });
});
//
function create(db,bfile,queryAsObject,res, req, callback) {
	//
	var r = {};  // new restaurant to be inserted
	r['address'] = {};
	r.address.street = (queryAsObject.street != null) ? queryAsObject.street : null;
	r.address.zipcode = (queryAsObject.zipcode != null) ? queryAsObject.zipcode : null;
	r.address.building = (queryAsObject.building != null) ? queryAsObject.building : null;
	r.address['coord'] = [];
	r.address.coord.push(queryAsObject.lon);
	r.address.coord.push(queryAsObject.lat);
	r['borough'] = (queryAsObject.borough != null) ? queryAsObject.borough : null;
	r['cuisine'] = (queryAsObject.cuisine != null) ? queryAsObject.cuisine : null;
	r['name'] = (queryAsObject.name != null) ? queryAsObject.name : null;
	r['restaurant_id'] = (queryAsObject.restaurant_id != null) ? queryAsObject.restaurant_id : null;
	r['userid'] = (queryAsObject.userid != null) ? queryAsObject.userid : null;
	r['grades'] = [];
    r['data'] = (bfile !=null) ? new Buffer(bfile.data).toString('base64') : null;
    r['mimetype'] = (bfile!=null) ? bfile.mimetype :null;
	  // new restaurant to be inserted
//console.log(req.body.sampleFile);
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		db.collection('rest2').insertOne(r,
			function(err,result) {
				assert.equal(err,null);
				console.log("insertOne() was successful _id = " +
					JSON.stringify(result.insertedId));
				db.close();
				console.log('Disconnected from MongoDB\n');
				//res.writeHead(200, {"Content-Type": "text/plain"});
				//res.end('Insert was successful ' + JSON.stringify(r));
				 callback(result);
			});
		
	});
}
app.get('/change', function(req, res){	
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		
		var objectId = {_id: ObjectId(req.query._id)};
		findNRestaurants(db,objectId,function(restaurants) {
			db.close();
			console.log
			if(restaurants[0].userid == req.session.userid){
				console.log('Disconnected MongoDB\n');
				console.log(JSON.stringify(restaurants));
				res.render('change',{dr:restaurants[0], userid:req.session.userid});
			}else{res.sendfile(__dirname +  '/public/changeerr.html');}
			
		});
	});
});
app.post('/change', function(req, res) {
 var sampleFile;

    if (!req.files) {
        res.send('No files were uploaded.');
        return;
    }

    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
      change(db,req.files.sampleFile,req.body,res,req,function(result) {
          db.close();
			//res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
			res.redirect('/display?_id=' + ObjectId(req.body._id));
      });
    });
});

function change(db,bfile,queryAsObject, res, req, callback) {
	//
	var r = {};  // new restaurant to be inserted
	r['address'] = {};
	r.address.street = (queryAsObject.street != null) ? queryAsObject.street : null;
	r.address.zipcode = (queryAsObject.zipcode != null) ? queryAsObject.zipcode : null;
	r.address.building = (queryAsObject.building != null) ? queryAsObject.building : null;
	r.address['coord'] = [];
	r.address.coord.push(queryAsObject.lon);
	r.address.coord.push(queryAsObject.lat);
	r['borough'] = (queryAsObject.borough != null) ? queryAsObject.borough : null;
	r['cuisine'] = (queryAsObject.cuisine != null) ? queryAsObject.cuisine : null;
	r['name'] = (queryAsObject.name != null) ? queryAsObject.name : null;
	r['restaurant_id'] = (queryAsObject.restaurant_id != null) ? queryAsObject.restaurant_id : null;
	r['userid'] = (queryAsObject.userid != null) ? queryAsObject.userid : null;
	r['grades'] = [];
    r['data'] = (bfile !=null) ? new Buffer(bfile.data).toString('base64') : null;
    r['mimetype'] = (bfile!=null) ? bfile.mimetype :null;
	console.log('queryAsObject._id='+queryAsObject._id);
	  // new restaurant to be inserted
//console.log(req.body.sampleFile);
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		db.collection('rest2').updateOne({_id:ObjectId(queryAsObject._id)}, {$set:r},
			function(err,result) {
				assert.equal(err,null);
				console.log(JSON.stringify(result));
				
				console.log("insertOne() was successful _id = " + result.insertedId );
				db.close();
				console.log('Disconnected from MongoDB\n');
				callback(result);
			});
		
	});
}
//
app.post('/rate', function(req, res){
	var resultArray = [];
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		
		db.collection('rest2').aggregate({$match:{_id:ObjectId(req.query._id)}}, {$unwind:'$grades'}, {$match:{'grades.userid':req.body.userid}}, function(err, doc) {
			console.log('doc:'+doc);
			if(doc.length == 0){
				db.collection('rest2').update({_id:ObjectId(req.query._id)},{$push:{'grades':{$each:[{'userid':req.body.userid, 'score':req.body.score}]}}});
				db.close();
				console.log('Disconnected from MongoDB\n');
				res.redirect('/');
			}
			res.sendFile(__dirname + '/public/rateerr.html');		
		});
	});
});

app.get("/showonmap", function(req,res) {
	MongoClient.connect(mongourl, function(err, db) {
    assert.equal(err,null);
    console.log('Connected to MongoDB\n');
	var criteria = {'_id':ObjectId(req.query._id)};
    findRest(db,criteria,function(rest) {
      db.close();
      console.log(rest);
			res.render('gmap',{lat:rest.address.coord[0],lon:rest.address.coord[1],zoom:18, name:rest.name});
			res.end();
		});
	});
});

function findRest(db,criteria,callback) {
	db.collection('rest2').findOne(criteria,function(err,result) {
		assert.equal(err,null);
		callback(result);
	});
}

app.get('/api/read/:key/:value', function (req, res) {
  MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		console.log('Connected to MongoDB\n');
		var asd = req.params.key;
                var asd2 = req.params.value;
                var v = {};
                v[req.params.key] =  req.params.value;
                console.log(JSON.stringify(v));
console.log(asd);
		findNRestaurants(db,v,function(restaurants) {
			db.close();
			console.log(restaurants);
			res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"}); 
			res.write(JSON.stringify(restaurants));
			res.end();
			//res.end();
		});
	});
});

  app.post('/api/create', function(req, res) {
	  var sampleFile;
	  console.log('Connected to mlab.com2222222222222222');
	if(req.body.name !="" && req.body.name != null ){
		console.log("asdasdasdasdasd")
    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to mlab.com');
      assert.equal(null,err);
	 
	  if(req.files){
      create(db,req.files.sampleFile,req.body,res,req,function(result) {
          db.close();
          if (result.insertedId != null) {
            res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"}); 
            res.end(JSON.stringify({status:"ok", _id: result.insertedId}));
          } else {
            res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"}); 
            res.end(JSON.stringify({status:"fail"}));
          }
      });
	  }else{
		  create(db,null,req.body,res,req,function(result) {
          db.close();
          if (result.insertedId != null) {
            res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"}); 
            res.end(JSON.stringify({status:"ok", _id: result.insertedId}));
           } else {
            res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"}); 
            res.end(JSON.stringify({status:"fail"}));
          }
		 
        });
	  }
	});
	  
	   }else{
		  res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"}); 
            res.end(JSON.stringify({status:"fail"}));
	  }


	});


app.listen(process.env.PORT || 8090);
