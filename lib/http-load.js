var sys = require("sys"),
  http = require("http"),
  url = require("url"),
  path = require("path"),
  crypto = require("crypto"),
  fs = require("fs");

var inc = function(v, s, i) {
  if (i === undefined) {
    i = 1;
  }
  v[s] = v[s] !== undefined ? v[s] + i : i;
};

var hashFile = function(filename, cb) {
  path.exists(filename, function(exists) {
    if(exists) {
      fs.readFile(filename, function(err, data) {
	var hash = crypto.createHash('md5');
	hash.update(data);
	cb(hash.digest('base64'));
      });
    } else {
      throw 'File ' + filename + ' does not exist or can not be read';
    }
  });
}


exports.HttpLoad = function(filename, requestsToPerform, concurrent, debug, recordHeaders, cacheDir, initCache) {
  this.filename = filename;
  this.requestsToPerform = requestsToPerform;
  this.concurrent = concurrent;
  this.debug = debug ? function(m) { sys.log(m); } : function() {};
  this.recordHeaders = recordHeaders;
  this.cacheDir = cacheDir;
  this.initCache = initCache;

  this.uris = [];
  this.cachedHashes = {};
  this.requests = [];
  this.requestCount = 0;
  this.agents = [];
};

exports.HttpLoad.prototype = {

  filenameFromUri: function(uri) {
    var filepart = uri.match('http://.*/(.*)')[1];
    return path.join(this.cacheDir, filepart);
  },

  start: function() {
    var debug = this.debug;
    var that = this;
    var count = this.uris.length;
    debug('Starting load test: ' + this.requestsToPerform + ' requests total, ' + this.concurrent + ' concurrent');
    path.exists(this.filename, function(exists) {
      if(exists) {
	debug('reading uris from ' + that.filename);
	that.uris = fs.readFileSync(that.filename, 'utf8').split('\n');
	that.uris.pop();

	that.initializeCache(function () {
	  if (that.cacheDir) {
	    debug('Using cache, directory: ' + that.cacheDir);
	    var count = that.uris.length;
	    that.uris.forEach(function(uri) {
	      hashFile(that.filenameFromUri(uri), function(hash) {
		that.cachedHashes[uri] = hash;
		if (--count === 0) {
		  that.performRequests();
		}
	      });
	    });
	  } else {
	    that.performRequests();
	  }
	});
      } else {
	sys.log('File not found: ' + filename);
      }
    });
  },

  initializeCache: function(cb) {
    var that = this;
    if (this.initCache) {
      var debug = this.debug, count = this.uris.length;
      sys.log('Initializing cache dir ' + this.cacheDir);
      path.exists(this.cacheDir, function(exists) {
	if (!exists) {
	  fs.mkdirSync(this.cacheDir, 0755);
	}
	that.uris.forEach(function(uri) {
	  var filename = that.filenameFromUri(uri);
	  var dst = url.parse(uri);
	  
	  var options = {
	    host: dst.hostname,
	    port: dst.port || 80,
	    path: dst.pathname,
	    method: 'GET'
	  };
	  var req = http.request(options, function(response) {
	    var output = fs.createWriteStream(filename);
	    response.on('data', function (data) {
	      output.write(data);
	    });
	    
	    response.on('end', function () {
	      if (--count === 0) {
		output.end();
		sys.log('done');
		cb();
	      }
	    });
	  });
	  req.on('error', function(e) {
	    console.log("Got error: " + e.message);
	  });
	  req.end();
	});
      });
    } else {
      cb();
    }
  },    

  randomizeRequests: function() {
    var debug = this.debug;
    var i, request;
    for (i = 0; i < this.requestsToPerform; i++) {
      request = {};
      var randomIndex = Math.floor(Math.random() * this.uris.length);
      request.uri = this.uris[randomIndex];
      this.requests.push(request);
    }
    this.totalRequestCount = this.requests.length;
  },

  performRequests: function() {
    this.randomizeRequests();
    var debug = this.debug;
    debug('Performing requests');
    
    var count = this.totalRequestCount;
    var that = this;
    startTime = Date.now();
    this.requests.forEach(function(request) {
      that.requestCount++;
      var dst = url.parse(request.uri);
      
      var options = {
	host: dst.hostname,
	port: dst.port || 80,
	path: dst.pathname,
	method: 'GET'
      };
      options.agent = new http.Agent(options);
      options.agent.on('connect', function() {
	request.startTime = Date.now();
      });
      var req = http._requestFromAgent(options, function(response) {
	request.response = {
	  status: response.statusCode,
	  bytes: 0
	};
	
	if (that.recordHeaders) {
	  request.response.headers = response.headers;
	}

	var hash = crypto.createHash('md5');
	
	response.on('data', function (data) {
	  hash.update(data);
	  var bytes = data.length;
	  inc(request.response, 'bytes', bytes);
	  inc(that, 'totalBytes', bytes);
	});
	
	response.on('end', function () {
	  request.endTime = Date.now();
	  request.requestTime = request.endTime - request.startTime;
	  request.response.hash = hash.digest('base64');
	  if (--count === 0) {
	    var endTime = Date.now();
	    that.totalTime = endTime - startTime;
	    debug('Requests done');
	    that.buildResults();
	  }
	});
      });
      req.on('error', function(e) {
	console.log("Got error: " + e.message);
      });
      req.end();
    });
  },    
		       
  buildResults: function() {
    var debug = this.debug;
    debug('Preparing results');

    this.statusCodes = {};
    this.successes = 0;
    this.failures = 0;
    this.failedRequests = [];
    this.totalTime = Math.round(this.totalTime / 100) / 10;
    var that = this;
    this.requests.forEach(function(request) {
      inc(that.statusCodes, request.response.status);
      if (that.minRequestTime === undefined || that.minRequestTime > request.requestTime) {
	that.minRequestTime = request.requestTime;
      }
      if (that.maxRequestTime === undefined || that.maxRequestTime < request.requestTime) {
	that.maxRequestTime = request.requestTime;
      }
      if (that.cacheDir) {
	if (request.response.hash === that.cachedHashes[request.uri]) {
	  that.successes++;
	} else {
	  that.failures++;
	  that.failedRequests.push(request);
	}      
      }
    });
    this.requestsPerSecond = Math.floor(this.requestCount / this.totalTime);
    this.bytesAverage = Math.floor(this.totalBytes / this.totalTime / 1024);
    this.reportResults();
  },

  reportResults: function() {
    var i;
    function p() {
      var args = Array.prototype.slice.call(arguments), formatted = args.shift();
      for (arg in args) {
	formatted = formatted.replace("{" + arg + "}", args[arg]);
      }
      console.log(formatted);
    }

    p('{0} requests in {1} s ({2} requests/s); min: {3} ms; max: {4} ms', 
      this.requestCount, 
      this.totalTime, 
      this.requestsPerSecond, 
      this.minRequestTime, 
      this.maxRequestTime);
    p('{0} total bytes (avg {1}kB/s)', 
      this.totalBytes,
      this.bytesAverage);
    if (this.cacheDir) {
      p('{0} successful requests, {1} hash mismatches', 
	this.successes,
	this.failures);
    }
    p('\nStatus codes:');
    for (status in this.statusCodes) {
      p('{0}:\t {1}', status, this.statusCodes[status]);
    }
    if (this.failures) {
      p('Details on failed requests:');
      console.log(this.failedRequests);
    }
  }

};
