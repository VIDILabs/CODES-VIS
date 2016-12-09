var dependencies = [
    'vui/panel',
    'vui/dropdown',
    'model',
    'js/linechart',
    'views/multivariateTimeseries',
    // 'views/networkDragonfly',
    'views/circularHierarchy',
    'js/colorLegend',

];

define(dependencies,
function(Panel,
     DropDownMenu,
     Model,
     linechart,
     MultivariateTimelineView,
      dragonflyView,
      colorLegend
  ) {
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

        var entities = ["terminal","router", "local_link", "global_link"],
            granularities = ["group", "router", "node/port"],
            entity = "terminal",
            granularity = "node";


        var partitionAttr = "workload",
            numPartition = 10,
            compareMode = false;

        function linearColor(c) {
            var colors = i2v.colors(c).colors;
            return [colors[1], colors[colors.length-1]];
        }

        var jobs = [],
            jobNames = ["AMG", "AMR Boxlib", "MiniFE", "idle"];

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

        var viewRight = "Structural",
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
                content: "Structural View: Shows the topological structure of the network.Each wedge is lable with the groop id. Mouse over each wedge will result in highlighting of the corresponding line(s) in the Time Range View " +
                    "<br />Statistical View: Shows the statistical value of each attribute selected from the Time Range View. The histogram shows the average values."
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
            info: {float: "left",  placement: "right", content: "This view contains three time series plots. Users can select different attributes, granularities, and entities."},
        });

        var summaryPanel = Panel({
            container: layoutID,
            width: window.innerWidth - 40,
            // width: 920,
            height: window.innerHeight * 0.2,
            header: true,
            header: true,
            info: {float: "left",  placement: "right", content: "This timeline plot shows the normalized mean of each attributes of the data.<br />"+
                  "The sliding window on this plot is for selecting the time range for the Time Range and Network/Statistial view." +
                  "The drop down menus can be used to select the overview for terminal or router attributes"},
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
            options: ["Structural", "Statistical"],
            selected: 0,
            label: "View",
            float: "left"
        }).onchange = function(d){
            networkView.change(d);
        };


        var structs = [
            {
                entity: "router",
                vmap: {color: "global_busy_time", size: "global_traffic"},
                partitionAttr: partitionAttr,
                numPartition: jobNames,
                groupLabel: true,
                colors: ["white", "purple"]
            },
            {
                entity: "router",

                vmap: {
                    color: "local_busy_time",
                    // size: "global_traffic"
                },
                aggregate: "router_rank",
                colors: ["#eee", "steelblue"],
                size: 1,
            },
            {
                entity: "terminal",
                level: "router",
                vmap: { color: "workload", size: "data_size"},
                size: 1,
                colors: nodeColor,
                aggregate: ["router_port"]
                // aggregate: true
            },
            // {
            //     entity: "terminal",
            //     level: "group",
            //     vmap: {y: "data_size", x: "router_rank", color: "avg_packet_latency", size: "avg_hops"},
            //     size: 3,
            //     type: 'bar',
            //     aggregate: false,
            //     colors: linearColor("Purples"),
            //     border: 1,
            //     // axis: 1,
            // },
            // {
            //     entity: "terminal",
            //     level: "group",
            //     vmap: {color: "data_size"},
            //     size: 1,
            //     type: 'bar',
            //     aggregate: true,
            //     colors: i2v.colors("PuBuGn").colors
            // },
        ];

        $("#aggregateDataBy").on("change", function(d){
            partitionAttr = $(this).val().toLowerCase().split(" ").join("_");
            visualizeData(cache);
            structs[0].partitionAttr = partitionAttr;
        });

        function visualizeData(data) {

        }

        var entityAttributes = {
            router: ["local_busy_time", "global_busy_time", "local_traffic", "global_traffic"],
            terminal: ["router_port", "router_rank", "data_size", "avg_packet_latency", "packets_finished", "avg_hops", "busy_time"],
            global_link: ["traffic", "busy_time"],
            local_link: ["traffic", "busy_time"]
        }


        $("#networkViewSetting").html("");
        function getAttr(e) {
            var a = entityAttributes[e].filter(function(n){
                return (["timestamp", "rank", "port", "router_id", "group_id", "type"].indexOf(n)===-1);
            })

            return ['----'].concat(a);
        }

        structs.forEach(function(struct, si){
            var tr = $("<tr/>"), td = $("<td/>");

            var attributes = getAttr(struct.entity, struct.level),
                e = DropDownMenu({options: entities, selected: entities.indexOf(struct.entity)}),
                g = DropDownMenu({options: granularities, selected: granularities.indexOf(struct.level)}),
                vmapSelectors = [];

            ["color", "size", "x", "y"].forEach(function(a){
                var selector = DropDownMenu({float: "none", label: a, options: attributes, selected: attributes.indexOf(struct.vmap[a])});

                selector.onchange = function(d) {
                    if(d == '----') {
                        delete struct.vmap[a];
                    } else {
                        struct.vmap[a] = d;
                    }
                    visualizeData(cache);
                }

                vmapSelectors.push(selector);
            });

            if(si===0) {
                vmapSelectors.pop();
                vmapSelectors.pop();
                // e.changeOptions(["link"], 0)
            }

            e.onchange = function(_) {
                if(_=='----') return;
                struct.entity = _;
                vmapSelectors.forEach(function(sel){
                    sel.changeOptions(getAttr(struct.entity), 0);
                });
            };

            g.onchange = function(_) {
                if(_=='----') return;
                if(_ == "node/port") _ = "node";
                struct.level = _;
                vmapSelectors.forEach(function(sel){
                    sel.changeOptions(getAttr(struct.entity, struct.level), 0);
                });
            }
            var colorCol = $("<p/>");
            if('color' in struct.vmap) {
                var colorMap = colorLegend({width: 200, height: 20, colors: [], domain: [0, 1] }),
                    colorPicks = [];

                struct.colorLegend = colorMap;

                // struct.colors.forEach(function(c, ci){
                //     var colorPick = $("<a/>")
                //         .addClass("btn btn-default")
                //         .css({
                //             width: "22px",
                //             padding: 2,
                //             marginRight: "10px"
                //             // border: "none",
                //         })
                //         .append($("<span/>")
                //             .addClass("input-group-addon")
                //             .css({width: "16px", padding: 0})
                //             .append("<i/>"));
                //
                //     colorPick.colorpicker({color: c}).on("hidePicker", function(e){
                //         struct.colors[ci] = e.color.toHex();
                //         visualizeData(cache);
                //     });
                //
                //     colorPicks.push(colorPick);
                // })
                //
                // colorCol.append(colorPicks);
            }

            var aggrCheckBox = $("<input/>").attr("type", "checkbox");

            if(struct.aggregate) aggrCheckBox.attr("checked", "checked");

            aggrCheckBox.click(function(e){
                struct.aggregate = $(this).is(":checked") ? true : false;
                visualizeData(cache);
            })

            tr.append([
                $("<td/>").text(si),
                $("<td/>").append([e, aggrCheckBox, $("<span/>").text("aggreate")]),
                $("<td/>").append(vmapSelectors),
                $("<td/>").append(colorMap),
                $("<td/>").append(colorCol),
            ]);

            $("#networkViewSetting").append(tr);
        });

        var database, binaryData;



        function nodeColor(d) {
            if(d == "AMG") return "orange";
            else if(d == "AMR Boxlib") return "#0A0";
            else if(d == "MiniFE") return "brown";
            else  return "#000";
            // return "teal";
        }

        p4.io.ajax.get({
            url: "/data/" + datasetID,
            dataType: "arraybuffer"
        }).then(function(binary){
            binaryData = binary;
            return p4.io.ajax.get(
                {url: "workloads.conf", dataType: "text"}
            )
        }).then(function(text){
            jobs = text.split("\n").map(function(j){return j.split(" ")});
            jobs.pop();
            return p4.io.ajax.get(
                {url: "/metadata/" + datasetID, dataType: "json"}
            )
        }).then(function(md){
            // console.log(jobs);
            md.datasetID = datasetID;
            database = Model({
                metadata: md,
                data: binaryData,
                datasetID: datasetID,
                cache: false
            });
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
            console.log(timeStats);
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
                    width: window.innerWidth - window.innerHeight * 0.65 - 80,
                    height: window.innerHeight * 0.2 - 45,
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
                attributes.forEach(function(attr,ai){
                    var stats = meta[entity][granularity].stats[attr];
                    // console.log(attr,timeStats[entity][granularity]);
                    timeSeries[attr] = timeStats[entity][granularity][ai].map(function(d){return (d.avg - stats.min) / (stats.max - stats.min);});
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
                    numStep = Math.min(STEP_TOTAL-1, Math.floor(newTimeRange[1]/SAMPLE_RATE)) - stepStart;

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

                    if(viewRight == "Structural") {
                        database.aggregateByTimeRange(stepStart, (stepStart+numStep), function(result){
                            networkView.update(result);
                            // networkPreview.update(result);
                        })

                    }
                    panels.forEach(function(p, i){
                        updateVis(p);
                    });
                }
            }


            showOverview(entity, granularity);

            database.aggregateByTimeRange(stepStart, (stepStart+numStep), function(result){
                networkView = dragonflyView({
                    width: window.innerHeight * 0.65,
                    // height: window.innerHeight * 0.65,
                    stats: meta,
                    container: panelRight.body,
                    stepStart: stepStart,
                    numStep: numStep,
                    numGroup: NUM_GROUP,
                    numRouter: NUM_ROUTER,
                    numTerminal: NUM_TERMINAL,
                    routerRadix: ROUTER_RADIX,
                    workload: jobs,
                    struct: structs,
                    data: result,
                    statCharts: statCharts,
                    onhover: function(Ids){
                        panels.forEach(function(panel){
                            panel.highlight(Ids[panel.granularity()]);
                        })
                    }
                });

                var previewContainer = document.getElementById("networkGraph");
                // previewContainer.innerHTML = "";
                // networkPreview = dragonflyView({
                //     width: window.innerHeight * 0.65,
                //     height: window.innerHeight * 0.65,
                //     stats: meta,
                //     container: previewContainer,
                //     stepStart: stepStart,
                //     numStep: numStep,
                //     numGroup: NUM_GROUP,
                //     numRouter: NUM_ROUTER,
                //     numTerminal: NUM_TERMINAL,
                //     routerRadix: ROUTER_RADIX,
                //     struct: structs,
                //     data: result
                // });
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
