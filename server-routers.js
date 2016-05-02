var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    server = require('http').Server(app),
    socketio = require('socket.io')(server);

var port = process.env.PORT || 8200,
    host = process.env.HOST || "localhost";

// app.use('/', express.static(path.join(__dirname, 'ui')));
app.use(express.static('ui'));
app.use(express.static('../'));
app.use(express.static('jam'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var ctypes = require("./p4/src/ctypes/ctypes.js"),
    cstore = require("../p4/src/ctypes/cstore.js"),
    csv = require("./p4/src/io/csv.js"),
    db;

function initCStore(numLine) {
    db = cstore({
        size: numLine,
        struct: {
            rank               : "int",
            busytime_local_0    : "float",
            busytime_local_1    : "float",
            busytime_local_2    : "float",
            busytime_local_3    : "float",
            busytime_local_4    : "float",
            busytime_local_5    : "float",
            busytime_local_6    : "float",
            busytime_local_7    : "float",
            busytime_local_8    : "float",
            busytime_local_9    : "float",
            busytime_global_0   : "float",
            busytime_global_1   : "float",
            busytime_global_2   : "float",
            busytime_global_3   : "float",
            busytime_global_4   : "float",
            busytime_terminal_0 : "float",
            busytime_terminal_1 : "float",
            busytime_terminal_2 : "float",
            busytime_terminal_3 : "float",
            busytime_terminal_4 : "float",
            traffic_local_0     : "int",
            traffic_local_1     : "int",
            traffic_local_2     : "int",
            traffic_local_3     : "int",
            traffic_local_4     : "int",
            traffic_local_5     : "int",
            traffic_local_6     : "int",
            traffic_local_7     : "int",
            traffic_local_8     : "int",
            traffic_local_9     : "int",
            traffic_global_0    : "int",
            traffic_global_1    : "int",
            traffic_global_2    : "int",
            traffic_global_3    : "int",
            traffic_global_4    : "int",
            traffic_terminal_0  : "int",
            traffic_terminal_1  : "int",
            traffic_terminal_2  : "int",
            traffic_terminal_3  : "int",
            traffic_terminal_4  : "int",
            timestamp          : "int"
        },
    });
}

var routerInfo = {data: {}, metadata: {}};

csv.read({
    filepath  : "./data/dragonfly-routers-min-full.csv",
    delimiter : ",",
    // bufferSize: 32*1024,
    onopen    : initCStore,
    onload    : function(n) { db.addRows(n) },
    oncomplete: function() {
        var metadata = db.metadata(),
            fields = metadata.names,
            types = metadata.types,
            count = metadata.count,
            data = db.columns(),
            routerData = routerInfo.data,
            attributes = [
                "rank",
                "avg_local_busy_time",
                "avg_global_busy_time",
                "avg_terminal_busy_time",
                "avg_local_traffic",
                "avg_global_traffic",
                "avg_terminal_traffic",
                "timestamp"
            ];

        routerData["rank"] = new Int32Array(count);
        routerData["avg_local_busy_time"] = new Float32Array(count);
        routerData["avg_global_busy_time"] = new Float32Array(count);
        routerData["avg_terminal_busy_time"] = new Float32Array(count);
        routerData["avg_local_traffic"] =  new Float32Array(count);
        routerData["avg_global_traffic"] =  new Float32Array(count);
        routerData["avg_terminal_traffic"] =  new Float32Array(count);
        routerData["timestamp"] = new Int32Array(count);

        for(var i = 0; i < count; i++){
            var avgLB = 0, avgGB = 0, avgTB = 0, avgLT=0, avgGT=0, avgTT=0;
            fields.forEach(function(f) {
                var p = f.split("_");
                if(p[0] == "busytime"){
                    if(p[1]=="local") avgLB += data[f][i];
                    else if(p[1] == "global") avgGB += data[f][i];
                    else if(p[1] == "terminal") avgTB += data[f][i]
                } else if(p[0] == "traffic") {
                    if(p[1]=="local") avgLT += data[f][i];
                    else if(p[1] == "global") avgGT += data[f][i];
                    else if(p[1] == "terminal") avgTT += data[f][i];
                }
            });

            routerData["avg_local_busy_time"][i] = avgLB/10;
            routerData["avg_global_busy_time"][i] = avgGB/5;
            routerData["avg_terminal_busy_time"][i] = avgTB/5;

            routerData["avg_local_traffic"][i] = avgLT/10;
            routerData["avg_global_traffic"][i] = avgGT/5;
            routerData["avg_terminal_traffic"][i] = avgTT/5;

            routerData["rank"][i] = data["rank"][i];
            routerData["timestamp"][i] = data["timestamp"][i];
        }

        var stats = [];
        attributes.forEach(function(attr){
            stats[attr] = {
                min: routerData[attr][0],
                max: routerData[attr][0],
                avg: routerData[attr][0]
            };
        });

        for(var i = 1; i < count; i++) {
            attributes.forEach(function(attr){
                if(routerData[attr][i] > stats[attr].max) stats[attr].max = routerData[attr][i];
                else if(routerData[attr][i] < stats[attr].min) stats[attr].min = routerData[attr][i];
                stats[attr].avg = stats[attr].avg - (stats[attr].avg-routerData[attr][i]) / i;
            });
        }
        routerInfo.metadata = {
            types: ["int", "float", "float", "float", "float", "float", "float", "int"],
            names: attributes,
            count: count,
            size: count,
            stats: stats
        };
    }
});

server.listen(port, host, function(){
    console.log("listening", host, port);
});

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.get('/metadata', function(req, res){
    // res.json(db.metadata());
    res.json(routerInfo.metadata);
})

app.get('/binary', function(req, res){
    // var col = db.columns(),
    //     metadata = db.metadata(),
    //     fields = db.metadata().names,
    //     count = metadata.count,
    //     buffers = [];

    var col = routerInfo.data,
        metadata = routerInfo.metadata,
        fields = metadata.names,
        count = metadata.count,
        buffers = [];

    fields.forEach(function(f) {
        buffers.push(new Buffer(col[f].buffer));
    });

    var buf = Buffer.concat(buffers);
    res.end(buf, 'binary');
})

// socketio.on('connection', function (socket) {
//
//     console.log("new connection: ", socket.id);
//     var buf = new Buffer(db.columns()['timestamp'].buffer);
//     socket.emit('binary-data', { image: true, buffer: buf });
//
//     socket.on('request', function (upload) {
//         console.log(upload);
//     });
//
// });
