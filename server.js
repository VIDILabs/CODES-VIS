var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    server = require('http').Server(app),
    socketio = require('socket.io')(server);

var port = process.env.PORT || 8100,
    host = process.env.HOST || "localhost";

console.log("initializing server ");

// Static files
app.use(express.static('ui'));
app.use(express.static('jam'));
app.use(express.static('data'));

// ivastack modules
app.use("/vui", express.static('../../vui/src'));
app.use("/p4", express.static('../../p4/src'));
app.use("/i2v", express.static('../../i2v/src'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var ctypes = require("../../p4/src/ctypes/ctypes.js"),
    cstore = require("../../p4/src/ctypes/cstore.js"),
    csv = require("../../p4/src/io/node-dsv.js");
//
var terminalFile = "./data/dragonfly-terminals-nonmin.csv",
    routerFile = "./data/dragonfly-routers-nonmin-full.csv",
    terminalData,
    routerRawData,
    routerData,
    terminalStats,
    routerStats;

var SAMPLE_RATE,
    STEP_TOTAL,
    NUM_TERMINAL = 2550,
    NUM_ROUTER = 510,
    NUM_GROUP = 51,
    ROUTER_RADIX = 20,
    ROUTER_LOCAL_LINKS = 10,
    ROUTER_GLOBAL_LINKS = 5,
    ROUTER_PER_GROUP = NUM_ROUTER / NUM_GROUP,
    TERMINAL_PER_ROUTER = NUM_TERMINAL / NUM_ROUTER,
    TERMINAL_PER_GROUP = TERMINAL_PER_ROUTER * ROUTER_PER_GROUP;

// var terminalFile = "./data/dragonfly-adaptive-cr-terminals.csv",
//     routerFile = "./data/dragonfly-adaptive-cr-router.csv",
//     terminalData,
//     routerRawData,
//     routerData,
//     terminalStats,
//     routerStats,
//     metadata;
//
// var SAMPLE_RATE,
//     STEP_TOTAL,
//     NUM_TERMINAL = 1055,
//     NUM_ROUTER = 264,
//     NUM_GROUP = 33,
//     ROUTER_PER_GROUP = 8,
//     ROUTER_RADIX = 16,
//     ROUTER_LOCAL_LINKS = 8,
//     ROUTER_GLOBAL_LINKS = 4,
//     TERMINAL_PER_ROUTER = 4,
//     TERMINAL_PER_GROUP = TERMINAL_PER_ROUTER * ROUTER_PER_GROUP;


var DataStore = {
    terminal: { group: {}, router: {}, node: {} },
    router: { group: {}, router: {}, node: {} }
};

var Granularity = {
    terminal: { group: NUM_GROUP, router: NUM_ROUTER, node: NUM_TERMINAL },
    router: { group: NUM_GROUP, router: NUM_ROUTER, node: ROUTER_RADIX * NUM_ROUTER }
};

var timeStats = {
    terminal: { group: {}, router: {}, node: {} },
    router: { group: {}, router: {}, node: {} }
};

function setupTerminalDataStore(size) {
    process.stdout.write("Loading data for terminals ...");
    terminalData = cstore({
        size: size,
        struct: {
            rank            : "int",
            chunks_finished : "float",
            "data_size (Byte)"       : "float",
            hops_finished         : "float",
            "time_spent (ns)"      : "float",
            "busy_time (ns)"       : "float",
            timestamp       : "float"
        },
    });
}

function setupRouterDataStore(size) {
    process.stdout.write("Loading data for routers ...");
    var routerStruct = {rank: "int"};

    for(var j = 0; j < ROUTER_LOCAL_LINKS; j++)
        routerStruct["busytime_local"+j] = "float";

    for(var j = 0; j < ROUTER_GLOBAL_LINKS; j++)
        routerStruct["busytime_global"+j] = "float";

    for(var j = 0; j < TERMINAL_PER_ROUTER; j++)
        routerStruct["busytime_terminal"+j] = "float";

    for(var j = 0; j < ROUTER_LOCAL_LINKS; j++)
        routerStruct["traffic_local"+j] = "float";

    for(var j = 0; j < ROUTER_GLOBAL_LINKS; j++)
        routerStruct["traffic_global"+j] = "float";

    for(var j = 0; j < TERMINAL_PER_ROUTER; j++)
        routerStruct["traffic_terminal"+j] = "float";

    routerStruct["timestamp"] = "float";

    routerRawData = cstore({
        size: size,
        struct: routerStruct,
    });

    routerData = cstore({
        size: size,
        struct: {
            rank              : "int",
            local_busytime    : "float",
            global_busytime   : "float",
            terminal_busytime : "float",
            local_traffic     : "float",
            global_traffic    : "float",
            terminal_traffic  : "float",
            timestamp         : "float"
        },
    });
}

function processRouterData(rows) {
    var results = [];
    rows.forEach(function(row){
        var i = 1,
            ptr = 1,
            result = [];

        result[0] = row[0];
        result[i] = 0;
        for(var j = i; j < ptr+ROUTER_LOCAL_LINKS; j++)
            result[i] += row[j];

        result[++i] = 0; ptr += ROUTER_LOCAL_LINKS;
        for(var j = i; j < ptr+ROUTER_GLOBAL_LINKS; j++)
            result[i] = row[j];

        result[++i] = 0;ptr += ROUTER_GLOBAL_LINKS;
        for(var j = i; j < ptr+TERMINAL_PER_ROUTER; j++)
            result[i] = row[j];

        result[++i] = 0; ptr += TERMINAL_PER_ROUTER;
        for(var j = i; j < ptr+ROUTER_LOCAL_LINKS; j++)
            result[i] = row[j];

        result[++i] = 0; ptr += ROUTER_LOCAL_LINKS;
        for(var j = i; j < ptr+ROUTER_GLOBAL_LINKS; j++)
            result[i] = row[j];

        result[++i] = 0; ptr += ROUTER_GLOBAL_LINKS;
        for(var j = i; j < ptr+TERMINAL_PER_ROUTER; j++)
            result[i] = row[j];

        result[++i] = row[ptr+TERMINAL_PER_ROUTER];
        results.push(result);
    })

    routerData.addRows(results);
}

function getPortData(){
    var metadata = routerRawData.metadata(),
        data = routerRawData.columns(),
        size = metadata.size,
        portData;

    portData = cstore({
        size: size * ROUTER_RADIX,
        struct: {
            rank         : "int",
            type         : "short",
            busy_time    : "float",
            traffic      : "float",
            timestamp    : "float"
        },
    });

    var ports = new Array(ROUTER_RADIX * STEP_TOTAL);
    for(var i = 0; i < NUM_ROUTER; i++){
        for(var t = 0; t < STEP_TOTAL; t++){
            var ptr = 0;
            for(var j = 0; j < ROUTER_LOCAL_LINKS; j++) {
                var port = [],
                    rank = data["rank"][i*STEP_TOTAL+t] * ROUTER_RADIX + ptr + j;
                port.push(rank );
                port.push(1);
                port.push(data["busytime_local"+j][i*STEP_TOTAL+t]);
                port.push(data["traffic_local"+j][i*STEP_TOTAL+t]);
                port.push(data["timestamp"][i*STEP_TOTAL+t]);
                ports[rank*STEP_TOTAL+t] = port;
            }
            ptr += ROUTER_LOCAL_LINKS;
            for(var j = 0; j < ROUTER_GLOBAL_LINKS; j++) {
                var port = [],
                    rank = data["rank"][i*STEP_TOTAL+t] * ROUTER_RADIX + ptr + j;
                port.push(rank);
                port.push(2);
                port.push(data["busytime_global"+j][i*STEP_TOTAL+t]);
                port.push(data["traffic_global"+j][i*STEP_TOTAL+t]);
                port.push(data["timestamp"][i*STEP_TOTAL+t]);
                ports[rank*STEP_TOTAL+t] = port;
            }
            ptr += ROUTER_GLOBAL_LINKS;
            for(var j = 0; j < TERMINAL_PER_ROUTER; j++) {
                var port = [],
                    rank = data["rank"][i*STEP_TOTAL+t] * ROUTER_RADIX + ptr + j;
                port.push(rank);
                port.push(3);
                port.push(data["busytime_terminal"+j][i*STEP_TOTAL+t]);
                port.push(data["traffic_terminal"+j][i*STEP_TOTAL+t]);
                port.push(data["timestamp"][i*STEP_TOTAL+t]);
                ports[rank*STEP_TOTAL+t] = port;
            }
        }
        // ports.forEach(function(port){
        //     // console.log(port);
        //     portData.addRows(port);
        // })
    }
     portData.addRows(ports);


    return portData;
}

function assignTerminalRank(ds){
    var metadata = ds.metadata(),
        data = ds.columns(),
        size = metadata.size;

    var group_id = new Int16Array(size),
        router_id = new Int32Array(size),
        port = new Int16Array(size);

    for(var i = 0; i < size; i++){
        group_id[i] = Math.floor(data["rank"][i] / NUM_GROUP);
        router_id[i] = Math.floor(data["rank"][i] /  NUM_ROUTER);
        port[i]= data["rank"][i] % TERMINAL_PER_ROUTER;
    }
    ds.addColumns(group_id, "group_id", "short");
    ds.addColumns(router_id, "router_id", "int");
    ds.addColumns(port, "port", "short");
}

function assignRouterRank(){
    var metadata = routerData.metadata(),
        data = routerData.columns(),
        size = metadata.size;

    var group_id = new Int16Array(size);

    for(var i = 0; i < size; i++){
        group_id[i] = Math.floor(data["rank"][i] / NUM_GROUP);
    }
    routerData.addColumns(group_id, "group_id", "short");
}

function aggregate(ds, key, entity_type){
    var entity = entity_type || "terminal",
        metadata = ds.metadata(),
        size = metadata.size,
        data = ds.columns(),
        attributes = [],
        results = {};

    var aggrData,
        struct = {rank :"int", timestamp :"float"};

    metadata.names.forEach(function(name){
        if([key, "timestamp", "rank", "group_id", "router_id", "port"].indexOf(name) == -1) {
            attributes.push(name);
            struct[name] = "float";
        }
    });

    var numBins, binSize;
    if(key == "group_id") {
        aggrData = cstore({
            size: NUM_GROUP * STEP_TOTAL,
            struct: struct
        });
        numBins = NUM_GROUP;
        binSize = (entity == "terminal") ? TERMINAL_PER_GROUP : ROUTER_PER_GROUP;
    } else if(key == "router_id") {
        aggrData = cstore({
            size: NUM_ROUTER * STEP_TOTAL,
            struct: struct
        });
        numBins = NUM_ROUTER;
        binSize = (entity == "terminal") ? TERMINAL_PER_ROUTER : ROUTER_RADIX;
    }

    for(var i = 0; i < numBins; i++) {
        var rows = []
        for(var j = 0; j < STEP_TOTAL; j++){
            var aggr = [i, data.timestamp[i*STEP_TOTAL*binSize+j]];
            attributes.forEach(function(a){
                aggr.push(0);
            });
            for(var k = 0; k < binSize; k ++){
                attributes.forEach(function(a, ai){
                    aggr[ai+2] += data[a][i*STEP_TOTAL*binSize+k*STEP_TOTAL+j];
                });
            }
            rows.push(aggr);
        }
        aggrData.addRows(rows);
    }
    return aggrData;
}

function getTemporalStats(ds, debug) {
    var timeStats = {},
        data = ds.columns(),
        size = data['rank'].length,
        // attributes = Object.keys(data).filter(function(a){return a != "timestamp" && a!="rank";});
        attributes = Object.keys(data);
    attributes.forEach(function(attr){
        timeStats[attr] = [];
        timeStats[attr].push({min: 0, max: 0, avg: 0, count: 1});
        for(var i = 0; i < size; i++){
            var t = Math.floor(data["timestamp"][i] / SAMPLE_RATE);

            if(timeStats[attr][t]) {
                if(data[attr][i] > timeStats[attr][t].max)
                    timeStats[attr][t].max = data[attr][i];
                if(data[attr][i] < timeStats[attr][t].min)
                    timeStats[attr][t].min = data[attr][i];

                timeStats[attr][t].avg -= (timeStats[attr][t].avg - data[attr][i]) / timeStats[attr][t].count;
                timeStats[attr][t].count++;
            } else {
                timeStats[attr][t] = {
                    min: data[attr][i],
                    max: data[attr][i],
                    avg: data[attr][i],
                    count: 1
                };
            }
        }
    });
    // console.log(timeStats);
    return timeStats;
}

csv.read({
    filepath  : terminalFile,
    delimiter : ",",
    onopen    : setupTerminalDataStore,
    onload    : function(n) { terminalData.addRows(n) },
    oncomplete: function() {
        var size = terminalData.metadata().count,
            stats = terminalData.stats();

        SAMPLE_RATE = terminalData.columns()["timestamp"][0];
        STEP_TOTAL = Math.floor(stats["timestamp"].max / SAMPLE_RATE);
        // NUM_TERMINAL = stats["rank"].max + 1;
        // NUM_TERMINAL = terminalData.columns()["rank"][size-1] + 1;

        assignTerminalRank(terminalData);
        DataStore.terminal.group = aggregate(terminalData, "group_id");
        DataStore.terminal.router = aggregate(terminalData, "router_id");
        DataStore.terminal.node = terminalData;


        terminalStats = getTemporalStats(terminalData);
        timeStats.terminal.node = getTemporalStats(terminalData);
        timeStats.terminal.router = getTemporalStats(DataStore.terminal.router);
        timeStats.terminal.group = getTemporalStats(DataStore.terminal.group);

        console.log("... done (" + size + ").");

        csv.read({
            filepath  : routerFile,
            delimiter : ",",
            onopen    : setupRouterDataStore,
            onload    : function(rows) {
                routerRawData.addRows(rows);
                processRouterData(rows)
            },
            oncomplete: function() {
                var size = routerRawData.metadata().count,
                    stats = routerRawData.metadata().stats;
                // SAMPLE_RATE = routerData["timestamp"][0];
                STEP_TOTAL = Math.floor(stats["timestamp"].max / SAMPLE_RATE);
                // NUM_ROUTER = stats["rank"].max+1;
                // SAMPLE_RATE = routerData.columns()["timestamp"][0];
                // STEP_TOTAL = Math.floor(stats["timestamp"].max / SAMPLE_RATE);

                DataStore.router.router = routerData;
                assignRouterRank();
                DataStore.router.node = getPortData();
                DataStore.router.group = aggregate(routerData, "group_id", "router");
                // console.log(DataStore.router.group.columns()['timestamp']);

                timeStats.router.router = getTemporalStats(routerData);
                timeStats.router.node = getTemporalStats(DataStore.router.node);
                timeStats.router.group = getTemporalStats(DataStore.router.group);

                console.log("... done (" + size + ").");
                server.listen(port, host, function(){
                    console.log("server started, listening", host, port);
                });
            }
        });
    }
});

app.get('/timeseries/:start/:end/:entity/:granu', function(req, res){
    var entity = req.params.entity,
        granu = req.params.granu,
        db = DataStore[entity][granu];

    console.log(entity);

    var metadata = db.metadata(),
        types = metadata.types,
        size =  metadata.count,
        col = db.columns(),
        fields = metadata.names,
        buffers = [],
        start = req.params.start * SAMPLE_RATE,
        end = req.params.end * SAMPLE_RATE,
        result = {},
        count = 0;

    console.log("time step range:", start, end, size);
    fields.forEach(function(f) {
        result[f] = [];
    });

    for(var i = 0; i < size; i++){
        if(col["timestamp"][i] >= start && col["timestamp"][i] <= end ){
            fields.forEach(function(f) {
                result[f].push(col[f][i]);
            });
            count++;
        }
    }

    // console.log("result count ", count, result.timestamp[0], result.timestamp[count-1]);
    fields.forEach(function(f, i) {
        var data = new ctypes[types[i]](result[f]);
        buffers.push(new Buffer(data.buffer));
    });

    var buf = Buffer.concat(buffers);
    res.end(buf, 'binary');
})

app.get('/topologydata/:timestamp', function(req, res){
    var ts = req.params.timestamp * SAMPLE_RATE,
        result = {};

    for(var e in DataStore){
        result[e] = {};
        for(var g in DataStore[e]){
            var metadata = DataStore[e][g].metadata(),
                size =  metadata.count,
                names = metadata.names,
                col = DataStore[e][g].columns();

            result[e][g] = [];
            for(var i = 0; i < size; i++){
                if(col["timestamp"][i] == ts){
                    var item = {};
                    names.forEach(function(n){
                        item[n] = col[n][i];
                    });
                    result[e][g].push(item);
                }
            }
        }
    }
    res.json(result);
});

app.get('/timerange/:start/:end', function(req, res){
    var start = parseInt(req.params.start),
        end = parseInt(req.params.end),
        // end = req.params.end * SAMPLE_RATE,
        result = {
            terminal: { group: [], router: [], node: [] },
            router: { group: [], router: [], node: [] }
        };
        console.log("timerange select", start, end);
    for(var e in DataStore){

        for(var g in DataStore[e]){
            var md = metadata[e][g],
                size =  md.rankTotal * (end-start),
                names = md.names,
                col = DataStore[e][g].columns();

            console.log(md.rankTotal, metadata[e].stepTotal, size, names);
            for(var i = 0; i<md.rankTotal; i++){
                result[e][g][i] = {};
                names.forEach(function(n){
                    result[e][g][i][n] = 0;
                    for(var t = start; t < end; t++){
                        result[e][g][i][n] += col[n][i* metadata[e].stepTotal + t];
                        // if(result[e][g][col["rank"][i]][n] < col[n][i])
                        //     result[e][g][col["rank"][i]][n] = col[n][i];

                    }
                    result[e][g][i][n] /= (end-start);
                });

            }

        }
    }
    res.json(result);
});

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.get('/metadata', function(req, res){
    metadata = {
        terminal: {
            group: DataStore.terminal.group.metadata(),
            router: DataStore.terminal.router.metadata(),
            node: DataStore.terminal.node.metadata(),
        },
        router: {
            group: DataStore.router.group.metadata(),
            router: DataStore.router.router.metadata(),
            node: DataStore.router.node.metadata()
        }
    };

    //in case terminal data and router data have different time steps
    var stepTotal = Math.floor(metadata.router.router.stats.timestamp.max / SAMPLE_RATE);
    metadata.sampleRate = SAMPLE_RATE;
    metadata.router.stepTotal = stepTotal;
    metadata.router.group.rankTotal = NUM_GROUP;
    metadata.router.router.rankTotal = NUM_ROUTER;
    metadata.router.node.rankTotal = NUM_ROUTER * ROUTER_RADIX;

    var stepTotal = Math.floor(metadata.terminal.node.stats.timestamp.max / SAMPLE_RATE);
    metadata.terminal.stepTotal = stepTotal;
    metadata.terminal.group.rankTotal = NUM_GROUP;
    metadata.terminal.router.rankTotal = NUM_ROUTER;
    metadata.terminal.node.rankTotal = NUM_TERMINAL;

    metadata.numGroup = NUM_GROUP;
    metadata.numRouter = NUM_ROUTER;
    metadata.numTerminal = NUM_TERMINAL;
    metadata.routerRadix = ROUTER_RADIX;

    res.json(metadata);
});

app.get('/datastats/:entity', function(req, res){
    var db;
    if(req.params.entity == "router")
        db = routerData;
    else
        db = terminalData;
    res.json(db.stats());
});

// app.get('/timestats/:entity/:granu', function(req, res){
//     var entity = req.params.entity,
//         granu = req.params.granu,
//
//     res.json(timeStats[entity][granu]);
// });

app.get('/timestats', function(req, res){
    res.json(timeStats);
});

app.get('/binary/:entity', function(req, res){
    var db;
    if(req.params.entity == "router")
        db = routerData;
    else
        db = terminalData;

    var col = db.columns(),
        fields = db.metadata().names,
        buffers = [];

    fields.forEach(function(f) {
        buffers.push(new Buffer(col[f].buffer));
    });

    var buf = Buffer.concat(buffers);
    res.end(buf, 'binary');
});

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
