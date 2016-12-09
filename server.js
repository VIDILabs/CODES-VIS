var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    //WebSocketServer = require("ws").Server,
    server = require('http').Server(app),
    // socketio = require('socket.io')(server),
    YAML = require('yamljs');

var port = process.env.PORT || 8100,
    host = process.env.HOST || "localhost";

console.log("initializing server ");

// Static files
app.use(express.static('ui'));
app.use(express.static('jam'));
app.use(express.static('data'));
app.use(express.static('testData'));
app.use("/npm", express.static('node_modules'));

// ivastack modules
var srcDir = {
    vui: '../../vui/src',
    i2v: '../../i2v/src',
    p4: '../../p4/src'
};

app.use("/vui", express.static(srcDir.vui));
app.use("/i2v", express.static(srcDir.i2v));
app.use("/p4",  express.static(srcDir.p4));
app.use("/flexgl",  express.static('../../flexgl/src'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var ctypes = require(srcDir.p4 + "/cquery/ctypes.js"),
    cstore = require(srcDir.p4 + "/cquery/cstore.js"),
    csv = require(srcDir.p4 + "/io/node-dsv.js");

var dataDirPath = "./data";
function listDataDirectories() {
    return fs.readdirSync(dataDirPath).filter(function(file) {
        return fs.statSync(path.join(dataDirPath, file)).isDirectory();
    });
}

var datasets = listDataDirectories().map(function(dir){
    var dataset = YAML.load(path.join(dataDirPath, dir, "data.yaml"));
    dataset.directory = dir;
    return dataset;
});

var entities = ["terminal", "router"],
    granularities = ["group", "router", "node"];

var cache = {};

function loadDataFromFiles(datasetID, callback) {
    if(cache.hasOwnProperty(datasetID)){
        callback(cache[datasetID]);
        return 0;
    }
    var dataset = datasets[datasetID],
        terminalFile = "./data/" + path.join(dataset.directory, dataset.results.sampling.terminal),
        routerFile =  "./data/" + path.join(dataset.directory, dataset.results.sampling.router),
        terminalData,
        routerRawData,
        routerData,
        terminalStats,
        routerStats,
        metadata;

    console.log(terminalFile, routerFile);

    var SAMPLE_RATE,
        STEP_TOTAL,
        NUM_TERMINAL = dataset.model.num_node,
        NUM_ROUTER = dataset.model.num_router,
        NUM_GROUP = dataset.model.num_group,
        ROUTER_RADIX = dataset.model.router_radix,
        ROUTER_LOCAL_LINKS = dataset.model.local_link,
        ROUTER_GLOBAL_LINKS = dataset.model.global_link,
        ROUTER_PER_GROUP = NUM_ROUTER / NUM_GROUP,
        TERMINAL_PER_ROUTER = NUM_TERMINAL / NUM_ROUTER,
        TERMINAL_PER_GROUP = TERMINAL_PER_ROUTER * ROUTER_PER_GROUP;

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
                packets_finished : "float",
                data_size       : "float",
                avg_hops   : "float",
                avg_packet_latency      : "float",
                busy_time       : "float",
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
                local_busy_time    : "float",
                global_busy_time   : "float",
                terminal_busy_time : "float",
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
                        rank = data.get("rank")[i*STEP_TOTAL+t] * ROUTER_RADIX + ptr + j;
                    port.push(rank );
                    port.push(1);
                    port.push(data.get("busytime_local"+j)[i*STEP_TOTAL+t]);
                    port.push(data.get("traffic_local"+j)[i*STEP_TOTAL+t]);
                    port.push(data.get("timestamp")[i*STEP_TOTAL+t]);
                    ports[rank*STEP_TOTAL+t] = port;
                }
                ptr += ROUTER_LOCAL_LINKS;
                for(var j = 0; j < ROUTER_GLOBAL_LINKS; j++) {
                    var port = [],
                        rank = data.get("rank")[i*STEP_TOTAL+t] * ROUTER_RADIX + ptr + j;
                    port.push(rank);
                    port.push(2);
                    port.push(data.get("busytime_global"+j)[i*STEP_TOTAL+t]);
                    port.push(data.get("traffic_global"+j)[i*STEP_TOTAL+t]);
                    port.push(data.get("timestamp")[i*STEP_TOTAL+t]);
                    ports[rank*STEP_TOTAL+t] = port;
                }
                ptr += ROUTER_GLOBAL_LINKS;
                for(var j = 0; j < TERMINAL_PER_ROUTER; j++) {
                    var port = [],
                        rank = data.get("rank")[i*STEP_TOTAL+t] * ROUTER_RADIX + ptr + j;
                    port.push(rank);
                    port.push(3);
                    port.push(data.get("busytime_terminal"+j)[i*STEP_TOTAL+t]);
                    port.push(data.get("traffic_terminal"+j)[i*STEP_TOTAL+t]);
                    port.push(data.get("timestamp")[i*STEP_TOTAL+t]);
                    ports[rank*STEP_TOTAL+t] = port;
                }
            }
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
            group_id[i] = Math.floor(data.get("rank")[i] / NUM_GROUP);
            router_id[i] = Math.floor(data.get("rank")[i] /  NUM_ROUTER);
            port[i]= data.get("rank")[i] % TERMINAL_PER_ROUTER;
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
            group_id[i] = Math.floor(data.get("rank")[i] / ROUTER_PER_GROUP);
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
        console.log(metadata);
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
                var aggr = [i, data.get("timestamp")[i*STEP_TOTAL*binSize+j]];
                attributes.forEach(function(a){
                    aggr.push(0);
                });
                for(var k = 0; k < binSize; k ++){
                    attributes.forEach(function(a, ai){
                        aggr[ai+2] += data.get(a)[i*STEP_TOTAL*binSize+k*STEP_TOTAL+j];
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
            size = data.get("rank").length,
            // attributes = Object.keys(data).filter(function(a){return a != "timestamp" && a!="rank";});
            attributes = Object.keys(data);
        attributes.forEach(function(attr){
            timeStats[attr] = [];
            timeStats[attr].push({min: 0, max: 0, avg: 0, count: 1});
            for(var i = 0; i < size; i++){
                var t = Math.floor(data.get("timestamp")[i] / SAMPLE_RATE);

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

            SAMPLE_RATE = terminalData.columns().get("timestamp")[0];
            STEP_TOTAL = Math.floor(stats["timestamp"].max / SAMPLE_RATE);
            // NUM_TERMINAL = stats.get("rank").max + 1;
            // NUM_TERMINAL = terminalData.columns().get("rank")[size-1] + 1;

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
                    // NUM_ROUTER = stats.get("rank").max+1;
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

                    metadata.timeStats = timeStats;
                    console.log("... done (" + size + ").");
                    dataset.metadata = metadata;
                    cache[datasetID] = DataStore;
                    callback(DataStore);
                }
            });
        }
    });
}

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.get('/datasets', function(req, res){
    res.json(datasets);
});

app.get('/metadata/:dataID', function(req, res){
    var dataID = parseInt(req.params.dataID);
    res.json(datasets[dataID].metadata);
});

app.get('/meta/:dataID/:entity/:granu', function(req, res){
    var dataID = parseInt(req.params.dataID),
        entity = req.params.entity,
        granu = req.params.granu;

    var md = datasets[dataID].metadata[entity][granu];

    md.stepTotal = datasets[dataID].metadata[entity].stepTotal;
    md.sampleRate = datasets[dataID].metadata.sampleRate;

    res.json(md);
});

app.get('/data/:dataID', function(req, res){
    var dataID = parseInt(req.params.dataID);
    loadDataFromFiles(dataID, function(DataStore){
        var buffers = [];
        entities.forEach(function(e){
            granularities.forEach(function(g) {
                var col = DataStore[e][g].columns(),
                    names = DataStore[e][g].metadata().names;

                names.forEach(function(f) {
                    buffers.push(new Buffer(col.get(f).buffer));
                });
            });
        });
        var buf = Buffer.concat(buffers);
        res.end(buf, 'binary');
    });
});

app.get('/binary/:dataID/:entity/:granu', function(req, res){
    var dataID = parseInt(req.params.dataID),
        entity = req.params.entity,
        granu = req.params.granu;

    loadDataFromFiles(dataID, function(DataStore){
        var buffers = [],
            col = DataStore[entity][granu].columns(),
            names = DataStore[entity][granu].metadata().names;

        names.forEach(function(f) {
            buffers.push(new Buffer(col.get(f).buffer));
        });

        var buf = Buffer.concat(buffers);
        res.end(buf, 'binary');
    });
});

app.get('/datastats/:entity', function(req, res){
    var db;
    if(req.params.entity == "router")
        db = routerData;
    else
        db = terminalData;
    res.json(db.stats());
});

app.get('/timestats/:dataID', function(req, res){
    var dataID = parseInt(req.params.dataID);
    res.json(datasets[dataID].metadata.timeStats);
});

app.get('/timeseries', function(req, res){
    var datasetID = parseInt(req.query.datasetID) || 0,
        entity = req.query.entity || "terminal",
        granu = req.query.granu || req.query.granularity || "group",
        start = parseInt(req.query.start) || 0,
        end = parseInt(req.query.end) || 1;

    loadDataFromFiles(datasetID, function(db){
        var sampleRate = datasets[datasetID].metadata.sampleRate,
            metadata = db[entity][granu].metadata(),
            types = metadata.types,
            size =  metadata.count,
            col = db[entity][granu].columns(),
            fields = metadata.names,
            buffers = [],
            timestampStart = start * sampleRate,
            timestampEnd = end * sampleRate,
            result = {},
            count = 0;

        console.log("time step range:", start, end, size);
        fields.forEach(function(f) {
            result[f] = [];
        });

        for(var i = 0; i < size; i++){
            if(col["timestamp"][i] >= timestampStart && col["timestamp"][i] <= timestampEnd ){
                fields.forEach(function(f) {
                    result[f].push(col[f][i]);
                });
                count++;
            }
        }

        fields.forEach(function(f, i) {
            var data = new ctypes[types[i]](result[f]);
            buffers.push(new Buffer(data.buffer));
        });

        var buf = Buffer.concat(buffers);
        res.end(buf, 'binary');
    });
})

app.get('/timerange/:datasetID/:start/:end', function(req, res){
    var datasetID = parseInt(req.params.datasetID),
        start = parseInt(req.params.start),
        end = parseInt(req.params.end),
        // end = req.params.end * SAMPLE_RATE,
        result = {
            terminal: { group: [], router: [], node: [] },
            router: { group: [], router: [], node: [] }
        };

    loadDataFromFiles(datasetID, function(DataStore){
        for(var e in DataStore){

            for(var g in DataStore[e]){
                var md = datasets[datasetID].metadata[e][g],
                    size =  md.rankTotal * (end-start),
                    names = md.names,
                    stepTotal = datasets[datasetID].metadata[e].stepTotal,
                    col = DataStore[e][g].columns();

                console.log(md.rankTotal, stepTotal, size);
                for(var i = 0; i<md.rankTotal; i++){
                    result[e][g][i] = {};
                    names.forEach(function(n){
                        result[e][g][i][n] = 0;
                        for(var t = start; t < end; t++){
                            result[e][g][i][n] += col[n][i* stepTotal + t];
                        }
                        result[e][g][i][n] /= (end-start);
                    });
                }
            }
        }
        res.json(result);
    });
});

server.listen(port, host, function(){
    console.log("server started, listening", host, port);
});
