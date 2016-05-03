var deps = [
    'vui/panel',
    'vui/dropdown',
    'js/widget',
    'js/linechart',
    'js/topology',
    'js/histogram',
    'ringPlot',
    'ringGrid',
    'interLinks',
];

define(deps, function(Panel, DropDownMenu, Widget, linechart, topologyGraph, histogram, ringPlot, ringGrid, interLinks) {
    'use strict';
    return function main(){
        var SAMPLE_RATE, STEP_TOTAL;

        var TERMINAL_PER_ROUTER = 5,
            NUM_GROUP = 51,
            NUM_ROUTER = 510,
            ROUTER_RADIX = 20,
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

        var statsView = true,
            viewRight = "Network";

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

        // DropDownMenu({
        //     container: panelRight.header,
        //     options: ["max", "min", "avg", "std"],
        //     selected: 0,
        //     label: "measure",
        //     float: "right"
        // });

        panelRight.style.position = "absolute";
        panelRight.body.style.padding = "20px";
        panelRight.style.left = "940px";
        panelRight.top = 0;
        panelRight.style.float = "none";
        // panelRight.title = "Statistical View";

        var topoView = i2v.Svg({width: 640, height: 640, container: panelRight.body, id: "topoView"}),
            topoViewSVG = [];

        topoView.setAttribute("id", "topoView");
        topoView.style.position = "absolute"
        topoView.style.margin = "20px 0 0 0"

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

            showOverview(entity, granularity);
            // visualize();
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
                    // data: data,
                    stats: stats,
                    brush: true,
                    width: 1560,
                    // width: 860,
                    height: 150,
                    container: summaryPanel.body,
                    timestamps: timestamps,
                    series: timeSeries,
                    onchange: function(d) {

                        stepStart = Math.max(1,Math.floor(d[0]/SAMPLE_RATE)-1);
                        // console.log(stepStart);
                        numStep = Math.floor(d[1]/SAMPLE_RATE) - stepStart;
                        dataSize = metadata.rankTotal * (numStep+1);
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
                        console.log("time range", stepStart, numStep);

                        if(viewRight == "Network") {
                            topoView.innerHTML = "";
                            circularView({stats: meta, step: stepStart});
                        } else {
                            panels.forEach(function(p, i){
                                updateVis(p);
                            });
                        }
                        // panelRight.clear();

                    },
                    formatX: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; },
                    formatY: function(d) { return p4.io.printformat(".2s")(d * 100) + "%"; },
                    lineWidth: 2,
                });


            }
            // summaryPanel.title = "Overview";
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

                if(viewRight != "Network")
                    stackedView({
                        vmap: {color: a},
                        entity: e,
                        granularity: g,
                        radius: 100 + 60 * panel.rank,
                        id: panel.rank
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

        function getTemporalStats(entity, granularity) {
            var attributes = meta[entity][granularity].names.filter(function(n){ return n != "rank"}),
                stats = {};
            attributes.forEach(function(attr){
                // console.log(attr, timeStats[entity][granularity]);
                var max = timeStats[entity][granularity][attr][stepStart].max,
                    min = timeStats[entity][granularity][attr][stepStart].min;

                for(var i = stepStart+1; i < numStep; i++) {
                    if(timeStats[entity][granularity][attr][i].max > max)
                        max = timeStats[entity][granularity][attr][i].max;
                    else if(timeStats[entity][granularity][attr][i].min < min)
                        min = timeStats[entity][granularity][attr][i].min;
                }
                stats[attr] = {min: min, max: max};
            });
            return stats;
        }

        function circularView(arg){
            var option = arg || {},
                stats = option.stats || {},
                width = option.width || 620,
                height = option.height || width,
                radius = option.radius || 100,
                step = option.step || 0;
                // console.log(stats);

            var struct = [
                {entity: "router", level: "router", vmap: {color: "global_traffic"}, circle: false, radius: 160, thick: 10},
                {entity: "router", level: "router", vmap: {size: "local_traffic", color: "local_busytime"}, circle: false, radius: 180 + 13*TERMINAL_PER_ROUTER, thick: 25},
                // {entity: "terminal", level: "group", vmap: {color: "busy_time (ns)", size: "data_size (Byte)"}, circle: false, radius: 210 + 10*TERMINAL_PER_ROUTER, thick: 40},
                {entity: "router", level: "group", vmap: {color: "terminal_busytime", size: "terminal_traffic"}, circle: false, radius: 220 + 10*TERMINAL_PER_ROUTER, thick: 25},
            ];

            function _render(data){
                for(var i = 0; i < TERMINAL_PER_ROUTER; i++ ){
                    var query = new p4.pipeline(data.terminal.node)
                            .match({port: 0}).result();
                    struct.push({entity: "terminal", level: "node", vmap: {color: "busy_time (ns)", size: "hops_finished"}, circle: true, color: -240, radius: 180 + i*12, thick: 10, data: query});
                }
                struct.forEach(function(s){
                    var result = (s.data) ? s.data : data[s.entity][s.level];
                    // console.log(result.length);
                    var ring = ringPlot({
                        data: result,
                        vmap: s.vmap,
                        width: width,
                        height: height,
                        outerRadius: s.radius + s.thick,
                        innerRadius: s.radius,
                        color: s.color || 120,
                        circle: s.circle,
                        container: topoView,
                        dataRange: stats[s.entity][s.level].stats

                    });
                })

                var links = new p4.pipeline(data.router.node)
                        .match({type: 2}).result();

                // console.log(links);

                var ring = interLinks({
                    data: links,
                    vmap: {color: "traffic"},
                    width: width,
                    height: height,
                    radius: 160,
                    // color: s.color || 120,
                    // circle: s.circle,
                    container: topoView,
                    dataRange: stats.router.node.stats

                });
                var gg = ringGrid({
                    width: 620,
                    height: 620,
                    innerRadius: 160,
                    outerRadius: 310,
                    count: meta.num_group,
                    container: topoView
                });

                panZoomInstance = svgPanZoom("#topoView", {
                     zoomEnabled: true,
                     controlIconsEnabled: true,
                     fit: true,
                     center: true,
                     minZoom: 0.1
                 });
            }
            p4.io.ajax.get({
                url: "/topologydata/" + (step),
                // url: "/timerange/" + stepStart + "/" + (stepStart+numStep),
                dataType: "json"
            }).then(function(json){
                _render(json);


            });
        }

        function structView(arg) {
            var option = arg || {},
                stats = option.stats || {},
                width = option.width;

            p4.io.ajax.get({
                // url: "/topologydata/" + (step+2),
                url: "/timerange/" + (step) + "/" + "",
                dataType: "json"
            }).then(function(json){
                console.log(stats);
                topologyGraph({
                    data: json,
                    stats: stats,
                    container: topoView
                })
            });
        }

        function stackedView(arg) {
            var option = arg || {},
                container = panelRight.body,
                e = option.entity || "terminal",
                g = option.granularity || "group",
                vis = option.vis || "circle",
                id = option.id || 0,
                width = option.width || 620,
                height = option.height || width,
                timeStep = option.timeStep || 0,
                vmap = option.vmap || {};


            var size = meta[e][g].count,
                names = meta[e][g].names,
                rankTotal = meta[e][g].rankTotal,
                data = temporalData[e][g],
                // stats = meta[e][g].stats,
                stats = getTemporalStats(e,g),
                result = [];

            for(var i = 0; i < rankTotal; i++) {
                result[i] = {};
                    names.forEach(function(n){
                        result[i][n] = data[n][i*numStep+1];
                    });
            }

            var hist = histogram({
                data: result,
                vmap: vmap,
                width: width,
                height: height * 0.25,
                position: {x: 0, y: id * 220},
                // color: 360,
                // circle: true,
                // color: "steelblue",
                container: topoView,
                // circle: true,
                dataRange: stats,
                entity: e,
                granu: g
            });

            // hist.setAttribute("id", "svgHist"+id);

            if(id > topoViewSVG.length-1) {
                topoViewSVG.push(hist);
            } else {
                topoViewSVG[id].remove();
                topoViewSVG[id] = hist;
            }
            // if(id == 2) {
            //  panZoomInstance = svgPanZoom("#stackedSVG", {
            //       zoomEnabled: true,
            //       controlIconsEnabled: true,
            //       fit: true,
            //       center: true,
            //       minZoom: 0.1
            //   });
            // }

        }
    }
});
