var dependencies = [
    'vui/panel',
    'vui/dropdown',
    'js/widget',
    'js/linechart',
    'views/network-dragonfly'
];

define(dependencies, function(Panel, DropDownMenu, Widget, linechart, circularGraph) {
    'use strict';
    return function main(){
        var SAMPLE_RATE,
            STEP_TOTAL,
            NUM_GROUP,
            NUM_ROUTER,
            ROUTER_RADIX,
            TERMINAL_PER_ROUTER,
            NUM_TERMINAL;

        var metadata,
            meta,
            data = {},
            ctypes = p4.ctypes.ctypes;

        var entity = "terminal",
            granularity = "node";

        /******************************
            Data Variables
        *******************************/
        var ts = [],
            ranks = [],
            rankTotal = 0,
            vmap = {r: "rank", t: "timestamp"},
            attributes = [],
            exponent = 1,
            stats,
            timeStats = {},
            bins = {},
            binRanges = [0, 0.2, 0.4, 0.6, 0.8, 1.0],
            timestamps = [],
            binAggregatedData = {};

        var timeStats = [],
            stepStart = 0,
            numStep = 0,
            dataSize = 0,
            temporalData = {
                terminal: { group: null, router: null, node: null },
                router: { group: null, router: null, node: null }
            };

        var ioStart, benchStart;

        var numPanel = 3,
            panels = [];

        var viewRight = "Network",
            networkView;

        var panelRight = Panel({
            container: 'layout-main',
            width: 680,
            height: 680,
            header: true,
        });

        var panelLeft = Panel({
            container: 'layout-main',
            width: 930,
            height: 650,
            header: true,
        });

        panelLeft.body.style.padding = "10px";
        panelRight.header.style.position = "absolute";
        panelRight.header.style.zIndex = "999999";

        var selectViewLeft = DropDownMenu({
            container: panelLeft.header,
            options: ["Range", "Correlation"],
            selected: 0,
            label: "View",
            float: "left"
        });

        panelRight.style.position = "absolute";
        panelRight.body.style.padding = "20px";
        panelRight.style.left = "940px";
        panelRight.top = 0;
        panelRight.style.float = "none";
        // panelRight.title = "Statistical View";

        var topoView = i2v.Svg({width: 640, height: 640, container: panelRight.body, id: "topoView"}),
            topoViewSVG = [];

        topoView.setAttribute("id", "topoView");
        topoView.style.position = "absolute";
        topoView.style.margin = "20px 0 0 0";

        var selectViewRight = DropDownMenu({
            container: panelRight.header,
            options: ["Network", "Statistical"],
            selected: 0,
            label: "View",
            float: "left"
        }).onchange = function(d){
            viewRight = d;
            topoView.innerHTML = "";
        };

        p4.io.ajax.get({
           url: "/metadata",
           dataType: "json"
        }).then(function(md){
            console.log(md);
            meta = md;
            NUM_GROUP = md.numGroup;
            NUM_ROUTER = md.numRouter;
            ROUTER_RADIX = md.routerRadix;
            NUM_TERMINAL = md.numTerminal;
            TERMINAL_PER_ROUTER = NUM_TERMINAL / NUM_ROUTER;
            SAMPLE_RATE = md.sampleRate;
            STEP_TOTAL = md[entity].stepTotal;
            rankTotal = md[entity][granularity].rankTotal;
            dataSize = md[entity][granularity].count;

            metadata = md[entity][granularity];

            return p4.io.ajax.get({
                url: "/timestats",
                dataType: "json"
            });
        }).then(function(json){
            timeStats = json;
            timestamps = [];
            for(var i = 0; i<STEP_TOTAL; i++){
                timestamps.push( (i+1)*SAMPLE_RATE );
            }

            // console.log(timeSeries);
            stepStart = 1;
            numStep = Math.floor(timestamps.length * 0.25)
            ts = [];
            for(var i = stepStart; i <= stepStart+numStep; i++){
                ts.push(timestamps[i]);
            }
            // SAMPLE_RATE = metadata.SAMPLE_RATE;
            for(var i = 0; i < rankTotal; i++){
                ranks.push(i);
            }

            // if(numPanel > attributes.length) numPanel = attributes.length;
            for(var i = 0; i < numPanel; i++){
                panels[i] = Widget({
                    width: 850,
                    height: 122,
                    container: panelLeft.body,
                    attributes: attributes,
                    selectedAttribute: i,
                    entity: "terminal",
                    granularity: "group",
                    onchange: updateVis
                });
                panels[i].rank = i;
                updateVis(panels[i]);
            }

            var summaryPanel = Panel({
                container: 'layout-main',
                width: 1620,
                // width: 920,
                height: 200,
                header: true,
            });

            function showOverview(entity, granularity) {
                var timeSeries = {};
                attributes = [];
                meta[entity][granularity].names.forEach(function(n, i){
                    if(["timestamp", "rank", "group_id", "router_id", "port", "type"].indexOf(n)==-1) attributes.push(n);
                });

                // console.log(attributes, timeStats);
                summaryPanel.clear();
                attributes.forEach(function(attr){
                    var stats = meta[entity][granularity].stats[attr];
                    timeSeries[attr] = timeStats[entity][granularity][attr].map(function(d){return (d.avg - stats.min) / (stats.max - stats.min);});
                });
                var summaryChart = lineChart({
                    stats: stats,
                    brush: true,
                    width: 1560,
                    height: 150,
                    container: summaryPanel.body,
                    timestamps: timestamps,
                    series: timeSeries,
                    formatX: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; },
                    formatY: function(d) { return p4.io.printformat(".2s")(d * 100) + "%"; },
                    lineWidth: 2,
                    onchange: onTimeRangeChange
                });
                // summaryPanel.title = "Overview";

                function onTimeRangeChange(newTimeRange) {
                    stepStart = Math.max(1,Math.floor(newTimeRange[0]/SAMPLE_RATE)-1);
                    numStep = Math.floor(newTimeRange[1]/SAMPLE_RATE) - stepStart;
                    dataSize = metadata.rankTotal * (numStep+1);
                    // console.log("time range", stepStart, numStep);
                    ts = [];
                    for(var i = stepStart; i <= stepStart+numStep; i++){
                        ts.push(timestamps[i]);
                    }
                    for(var i = 0; i < rankTotal; i++){
                        ranks.push(i);
                    }
                    temporalData = {
                        terminal: {group: null,router: null,node: null},
                        router: {group: null,router: null,node: null}
                    };

                    if(viewRight == "Network") {
                        networkView.update(stepStart, numStep);
                    }
                    panels.forEach(function(p, i){
                        updateVis(p);
                    });
                }
            }

            var struct = [
                {entity: "router", level: "router", vmap: {color: "global_busytime"}, circle: false, radius: 160, thick: 10},
                {entity: "router", level: "router", vmap: {size: "local_traffic", color: "local_busytime"}, circle: false, radius: 180, thick: 50},
                // {entity: "terminal", level: "group", vmap: {color: "busy_time (ns)", size: "data_size (Byte)"}, circle: false, radius: 210 + 10*TERMINAL_PER_ROUTER, thick: 40},
                {entity: "router", level: "group", vmap: {color: "terminal_busytime", size: "terminal_traffic"}, circle: false, radius: 245, thick: 40},
            ];

            showOverview(entity, granularity);
            networkView = circularGraph({
                stats: meta,
                container: panelRight.body,
                stepStart: stepStart,
                numStep: numStep,
                numGroup: NUM_GROUP,
                numRouter: NUM_ROUTER,
                numTerminal: NUM_TERMINAL,
                struct: struct
            });

            DropDownMenu({
                container: summaryPanel.header,
                options: ["terminal", "router"],
                selected: 0,
                label: "Overview",
                float: "left"
            }).onchange = function(d) {
                var g = (d == "router") ? "router" : "node";
                showOverview(d, g);
            };
        })

        function updateVis(panel){
            var e = panel.entity(),
                g = panel.granularity(),
                a = panel.attribute();
                ioStart = new Date();
            var dataURL = ["/timeseries", stepStart, (stepStart+numStep), e, g].join("/");

            var attributes = meta[e][g].names.filter(function(n){
                return (["timestamp", "rank", "port", "router_id", "group_id", "type"].indexOf(n)===-1);
            })

            panel.changeAttributes(attributes);

            function _update(data) {
                // var stats = p4.ctypes.query.stats(data, attributes);
                // console.log(stats);
                panel.clear();
                panel.visualize({
                    data: data,
                    stats: stats,
                    steps: ts.length,
                    ts: ts,
                    // vmap: {x: "timestamp", y: attributes[0]},
                    // color: tsColor(attributes[0]),
                    // aggregation: binAggregatedData,
                    formatX: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; },
                    formatY: p4.io.printformat(".2s")
                });

            }

            if(temporalData[e][g] === null) {
                p4.io.ajax.get({
                    url: dataURL,
                    dataType: "arraybuffer"
                }).then(function(binary){
                    var size = meta[e][g].rankTotal * (numStep+1),
                        offset = 0,
                        types = meta[e][g].types,
                        names = meta[e][g].names,
                        data = {};

                    names.forEach(function(n, i){
                        data[n] = new ctypes[types[i]](binary.slice(offset, offset+size*ctypes[types[i]].BYTES_PER_ELEMENT));
                        offset += size * ctypes[types[i]].BYTES_PER_ELEMENT;
                    });

                    temporalData[e][g] = data;
                    _update(temporalData);
                    // console.log( "### Performance Test (IO Latency):", new Date() - ioStart, numStep, panel.rank);
                });
            } else {
                _update(temporalData);
            }
        }

    }
});
