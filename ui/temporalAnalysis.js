var dependencies = [
    'vui/panel',
    'vui/dropdown',
    'model',
    'js/linechart',
    'views/multivariateTimeseries',
    'views/networkDragonfly',
    'js/colorLegend',
];

define(dependencies, function(Panel, DropDownMenu, Model, linechart, MultivariateTimelineView, dragonflyView, colorLegend) {
    'use strict';
    return function main(datasetID, layoutID){
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

        var entities = ["terminal","router"],
            granularities = ["group", "router", "node/port"],
            entity = "terminal",
            granularity = "node";


        function getRankPerGroup(e, g) {
            var rg = {
                router: {"group": 1, "router": NUM_ROUTER / NUM_GROUP, "node":  ROUTER_RADIX * NUM_ROUTER / NUM_GROUP},
                terminal: {"group": 1, "router": NUM_ROUTER / NUM_GROUP, "node":  NUM_TERMINAL / NUM_GROUP}
            };
            return rg[e][g];
        }

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
            networkView,
            networkPreview,
            viewRightWidth = window.innerHeight * 0.65,
            statCharts = [];

        var panelRight = Panel({
            container: layoutID,
            width: window.innerHeight * 0.65,
            height: window.innerHeight * 0.65,
            header: true,
            info: {
                float: "left",
                placement: "left",
                content: "Network View: Show the topological structure of the network.Each wedge is lable with the groop id. Mouse over each wedge will result in highlighting of the corresponding line(s) in the Time Range View " +
                    "<br />Statistical View: Show the statistical value of each attribute selected from the Time Range View. The histogram shows the average values."
            },
            external: {
                title: "setting",
                target: "#mainModal",
                float: "left",

            }
            // loadIndicator: "/style/img/loading-indicator.gif"
        });

        var panelLeft = Panel({
            container: layoutID,
            width: window.innerWidth - 50 - window.innerHeight * 0.65,
            height: window.innerHeight * 0.65 - 30,
            header: true,
            title: " Time Range View",
            info: {float: "left",  placement: "right", content: "This view contains three visualization pannels. Each pannel is independent of one another. User can select the attribute, granularity, and entity. There are two types of visualization: time series and heatmap."},
        });

        var summaryPanel = Panel({
            container: layoutID,
            width: window.innerWidth - 40,
            // width: 920,
            height: window.innerHeight * 0.2,
            header: true,
            header: true,
            info: {float: "left",  placement: "right", content: "A timeline graph that shows the normalized mean of each attributes of the data.<br />"+
                  "Serves as a time range selection for the Time Range and Network/Statistial view." +
                  "The drop down menu is use to select the terminal and router property"},
            loadIndicator: "/style/img/loading-indicator.gif",
        });

        panelLeft.body.style.padding = "10px";
        panelRight.header.style.position = "absolute";
        panelRight.header.style.zIndex = "999999";
        panelRight.style.position = "absolute";
        panelRight.style.left = window.innerWidth - 40 - window.innerHeight * 0.65 + "px";
        panelRight.top = 0;
        panelRight.style.float = "none";

        var selectViewRight = DropDownMenu({
            container: panelRight.header,
            options: ["Network", "Statistical"],
            selected: 0,
            label: "View",
            float: "left"
        }).onchange = function(d){
            networkView.change(d);
        };

        var database, binaryData;

        p4.io.ajax.get({
            url: "/data/" + datasetID,
            dataType: "arraybuffer"
        }).then(function(binary){
            binaryData = binary;
            return p4.io.ajax.get({
                url: "/metadata/" + datasetID,
                dataType: "json"
            })
        }).then(function(md){
            md.datasetID = datasetID;
            database = Model({metadata: md, data: binaryData, datasetID: datasetID, cache: true});
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

            timeStats = md.timeStats;
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
                var granus = ['group', 'router', 'node'];
                panels[i] = MultivariateTimelineView({
                    width: window.innerWidth - 130 - window.innerHeight * 0.65,
                    height: window.innerHeight * 0.2 - 86 ,
                    container: panelLeft.body,
                    attributes: attributes,
                    selectedAttribute: 0,
                    entity: "terminal",
                    granularity: granus[i],
                    onchange: updateVis
                });
                panels[i].rank = i;
                updateVis(panels[i]);
            }

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
                    width: window.innerWidth - 100,
                    height: window.innerHeight * 0.2-50,
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
                    // temporalData = {
                    //     terminal: {group: null,router: null,node: null},
                    //     router: {group: null,router: null,node: null}
                    // };

                    if(viewRight == "Network") {
                        database.aggregateByTimeRange(stepStart, (stepStart+numStep), function(result){
                            networkView.update(result);
                            networkPreview.update(result);
                        })

                    }
                    panels.forEach(function(p, i){
                        updateVis(p);
                    });
                }
            }

            var structs = [
                {entity: "router", level: "router", vmap: {color: "global_traffic"}, circle: false, radius: viewRightWidth/4, type: 'links', colors: ['white', 'orange'], config: false},
                {entity: "router", level: "router", vmap: {color: "global_busytime"}, circle: false, radius: viewRightWidth/4, thick: 10, type: 'bar', config: true},
                {entity: "router", level: "router", vmap: {size: "local_traffic", color: "local_busytime"}, circle: false, radius: viewRightWidth/4+20, thick: 50, type: 'bar', config: true},
                // {entity: "terminal", level: "group", vmap: {color: "busy_time", size: "data_size (Byte)"}, circle: false, radius: 210 + 10*TERMINAL_PER_ROUTER, thick: 40},
                {entity: "router", level: "group", vmap: {color: "terminal_busytime", size: "terminal_traffic"}, circle: false, radius: viewRightWidth/4+70, thick: 40, type: 'bar', config: true},
            ];

            showOverview(entity, granularity);

            database.aggregateByTimeRange(stepStart, (stepStart+numStep), function(result){
                networkView = dragonflyView({
                    width: window.innerHeight * 0.65,
                    height: window.innerHeight * 0.65,
                    stats: meta,
                    container: panelRight.body,
                    stepStart: stepStart,
                    numStep: numStep,
                    numGroup: NUM_GROUP,
                    numRouter: NUM_ROUTER,
                    numTerminal: NUM_TERMINAL,
                    routerRadix: ROUTER_RADIX,
                    struct: structs,
                    data: result,
                    statCharts: statCharts,
                    onhover: function(groupId){
                        panels.forEach(function(panel){
                            panel.highlight(groupId, getRankPerGroup(panel.entity(), panel.granularity()));
                        })
                    }
                });
                function getAttr(e, g) {
                    var a = md[e][g].names.filter(function(n){
                        return (["timestamp", "rank", "port", "router_id", "group_id", "type"].indexOf(n)===-1);
                    })

                    return ['----'].concat(a);
                }
                $("#networkViewSetting").html("");
                structs.forEach(function(struct, si){
                    var tr = $("<tr/>"), td = $("<td/>");

                    var attributes = getAttr(struct.entity, struct.level),
                        e = DropDownMenu({options: entities, selected: entities.indexOf(struct.entity)}),
                        g = DropDownMenu({options: granularities, selected: granularities.indexOf(struct.level)}),
                        sizeAttr = DropDownMenu({options: attributes, selected: attributes.indexOf(struct.vmap.size)}),
                        colorAttr = DropDownMenu({options: attributes, selected: attributes.indexOf(struct.vmap.color)});

                    e.onchange = function(_) {
                        if(_=='----') return;
                        struct.entity = _;
                        sizeAttr.changeOptions(getAttr(struct.entity, struct.level), 0);
                        colorAttr.changeOptions(getAttr(struct.entity, struct.level), 0);
                    };

                    g.onchange = function(_) {
                        if(_=='----') return;
                        if(_ == "node/port") _ = "node";
                        struct.level = _;
                        sizeAttr.changeOptions(getAttr(struct.entity, struct.level));
                        colorAttr.changeOptions(getAttr(struct.entity, struct.level));
                    }

                    var colorDomain = p4.stats(result[struct.entity][struct.level], [struct.vmap.color])[struct.vmap.color];

                    console.log(colorDomain);

                    if(struct.config){
                        tr.append([
                            $("<td/>").text(si),
                            $("<td/>").append(e),
                            $("<td/>").append(g),
                            $("<td/>").append(sizeAttr),
                            $("<td/>").append(colorAttr),
                            $("<td/>").css({width: 250}).append(colorLegend({width: 200, height: 20, colors: struct.colors, domain: [colorDomain.min, colorDomain.max] }))
                        ]);
                    } else {
                        tr.append([
                            $("<td/>").text(si),
                            $("<td/>").append(struct.entity),
                            $("<td/>").append(struct.level),
                            $("<td/>").append(struct.vmap.size),
                            $("<td/>").append(struct.vmap.color),
                            $("<td/>").css({width: 250}).append(colorLegend({width: 200, height: 20, colors: struct.colors, domain: [colorDomain.min, colorDomain.max] }))
                        ]);
                    }
                    $("#networkViewSetting").append(tr);
                });
                var previewContainer = document.getElementById("networkGraph");
                previewContainer.innerHTML = "";
                networkPreview = dragonflyView({
                    width: window.innerHeight * 0.65,
                    height: window.innerHeight * 0.65,
                    stats: meta,
                    container: previewContainer,
                    stepStart: stepStart,
                    numStep: numStep,
                    numGroup: NUM_GROUP,
                    numRouter: NUM_ROUTER,
                    numTerminal: NUM_TERMINAL,
                    routerRadix: ROUTER_RADIX,
                    struct: structs,
                    data: result
                });
            }),

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

            var attributes = meta[e][g].names.filter(function(n){
                return (["timestamp", "rank", "port", "router_id", "group_id", "type"].indexOf(n)===-1);
            })

            a = panel.changeAttributes(attributes);

            statCharts[panel.rank] = {
                entity: e,
                granularity: g,
                attribute: attributes[0]
            };

            if(networkView) networkView.updateHistogram(panel.rank, e, g, a);

            database.select({
                entity: e,
                granularity: g,
                start: stepStart,
                end: stepStart+numStep,
                succeed: function(result) {
                    // console.log(e, g, temporalData);
                    panel.clear();
                    panel.visualize({
                        data: result,
                        // stats: stats,
                        steps: ts.length,
                        ts: ts,
                        formatX: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; },
                        formatY: p4.io.printformat(".2s")
                    });
                }
            });
        }
    }
});
