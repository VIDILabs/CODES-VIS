var dependencies = [
    'vui/panel',
    'vui/dropdown',
    'js/sankey',
    'js/mmts',
];

define(dependencies, function(Panel, DropDownMenu, Sankey, Mmts) {
    'use strict';
    return function main(datasetID, layoutID){

        var metadata,
            data = {},
            ctypes = p4.ctypes.ctypes,
            timestamps = [],
            width = window.innerWidth - 80,
            height = window.innerHeight - 200,
            vh = 0.22,
            padding = {left: 60, right: 100, top: 5, bottom: 30},
            alpha = {group: 0.5, router: 0.25, node: 0.1};

        var sankeyCursors = [],
            bins = {a: [1.0, 0.25, 0.05, 0.0], b:[1.0, 0.25, 0.05, 0]},
            gamma = 1.0,
            timeRelative = false,
            timeSteps,
            showAggregation;

        var container = Panel({
                container: layoutID,
                width: width + 40,
                height: height,
                header: true,
            });

        container.title = "Correlation Analysis";

        DropDownMenu({
            container: container.header,
            options: ["terminal", "router"],
            selected: 0,
            label: "Entity",
            float: "right"
        });

        DropDownMenu({
            container: container.header,
            options: ["group", "router", "node/port"],
            selected: 0,
            label: "Granularity",
            float: "right"
        });

        var panelTop = Panel({
                container: container.body,
                width: width,
                height: height*vh ,
                header: true,
            }),
            panelMid = Panel({
                container: container.body,
                width: width,
                height: height*vh*2,
                // header: true,

            }),
            panelBottom = Panel({
                container: container.body,
                width: width,
                height: height*vh,
                header: true,
            });

        container.body.style.margin = "20px";

        var binary,
            entity = "terminal",
            granularity = "node";

        p4.io.ajax.get({
            url: "/binary/" + [datasetID, entity, granularity].join("/"),
            dataType: "arraybuffer"
        }).then(function(binaryData){
            binary = binaryData;
            // Get binary data via AJAX
            return p4.io.ajax.get({
                url: "/meta/" + [datasetID, entity, granularity].join("/"),
                dataType: "json"
            })

        }).then(function(md){
            metadata = md;
            console.log(md);
            var size = metadata.size,
                offset = 0,
                STEP_TOTAL = md.stepTotal,
                SAMPLE_RATE = md.sampleRate,
                types = md.types,
                attributes = md.names.filter(function(n){ return (["timestamp", "rank", "group_id", "router_id", "port", "type"].indexOf(n)==-1)});

            metadata.names.forEach(function(n, i){
                data[n] = new ctypes[types[i]](binary.slice(offset, offset+size*ctypes[types[i]].BYTES_PER_ELEMENT));
                offset += size * ctypes[types[i]].BYTES_PER_ELEMENT;
            });



            console.log(attributes);
            timestamps = [];
            for(var i = 0; i<STEP_TOTAL; i++){
                timestamps.push( (i+1)*SAMPLE_RATE );
            }

            var ts = timestamps;

            var vmap =  {x: "timestamp", y: attributes[0]};

            vmap.a = attributes[0];
            vmap.b = attributes[1];
            // var stats = p4.ctypes.query.stats(binary, attributes);
            console.log(data);
            Mmts({
                data: data,
                stats: md.stats,
                width: width,
                height: height*vh,
                padding: padding,
                // exponent: exponent,
                vmap: vmap,
                container: panelTop.body,
                timesteps: md.stepTotal,
                ts: timestamps,
                alpha: alpha[granularity],
                // color: tsColor(attributes[0]),
                // aggregation: binAggregatedData,
                formatX: function(d) { return p4.io.printformat(".3s")(d / 1000000) + "ms"; },
                formatY: p4.io.printformat(".2s")
            });

            Mmts({
                data: data,
                stats: md.stats,
                width: width,
                height: height*vh,
                padding: padding,
                // exponent: exponent,
                vmap: vmap,
                container: panelBottom.body,
                timesteps: md.stepTotal,
                ts: timestamps,
                alpha: alpha[granularity],
                // color: tsColor(attributes[0]),
                // aggregation: binAggregatedData,
                formatX: function(d) { return p4.io.printformat(".3s")(d / 1000000) + "ms"; },
                formatY: p4.io.printformat(".2s")
            });

            var stats = md.stats;

            timeSteps = [
                ts[0],
                ts[Math.floor(ts.length*0.3-1)],
                ts[Math.floor(ts.length*0.6-1)],
                ts[Math.floor(ts.length*0.9-1)]
            ];
            showAggregation = function showAggregation() {

                var clusters = [],
                    clinks = [],
                    tag = ['high', 'mid', 'low'],
                    intv0 = 0.25;
                var slopeA = 1 / (stats[vmap.a].max - stats[vmap.a].min),
                    cA = -stats[vmap.a].min / (stats[vmap.a].max - stats[vmap.a].min),
                    slopeB = 1 / (stats[vmap.b].max - stats[vmap.b].min),
                    cB = -stats[vmap.b].min / (stats[vmap.b].max - stats[vmap.b].min);

                var maxA = stats[vmap.a].max,
                    maxB = stats[vmap.b].max;
                    console.log(maxA, maxB);
                timeSteps.forEach(function(t, ti){
                    var cluster = [];
                    var cti = Math.floor(t / ts[0]) - 1;
                    // if(timeRelative) {
                    //     var slopeA = 1 / (timeStats[vmap.a][cti].max - timeStats[vmap.a][cti].min),
                    //         cA = -timeStats[vmap.a][cti].min / (timeStats[vmap.a][cti].max - timeStats[vmap.a][cti].min),
                    //         slopeB = 1 / (timeStats[vmap.b][cti].max - timeStats[vmap.b][cti].min),
                    //         cB = -timeStats[vmap.b][cti].min / (timeStats[vmap.b][cti].max - timeStats[vmap.b][cti].min);
                    //
                    // }
                    //
                    if(timeRelative) {
                        maxA = timeStats[vmap.a][cti].max;
                        maxB = timeStats[vmap.b][cti].max;
                    }
                    for(var i = 0; i<bins.a.length-1; i++){
                        for(var j=0; j<bins.b.length-1; j++){
                            cluster.push({
                                name: [tag[i], vmap.a, "/", tag[j], vmap.b].join(" "),
                                bins: [bins.a[i], bins.b[j]],
                                cob: [i/(bins.b.length-1), j/(bins.b.length-1)],
                                count: 0,
                                threshold: {a: [bins.a[i] * maxA, bins.a[i+1] * maxA], b: [bins.b[j]*maxB, bins.b[j+1]*maxB]},
                                ranks: [],
                                x: xAxis(t)-5,
                            });
                        }
                    }
                    if(ti < timeSteps.length-1){
                        var link = [];
                        cluster.forEach(function(c, ci){
                            cluster.forEach(function(cc, cj){
                                link.push({
                                    source: ci, target: cj, count: 0, ranks: []
                                });
                            });
                        });
                        clinks.push(link);
                    }
                    clusters.push(cluster);
                });

                console.log(clusters);
                var nodeTrace = [];
                for(var r = 0; r<ranks.length; r++) nodeTrace[r] = [];

                for(var i = 0; i<size; i++){
                    for(var ti = 0; ti < timeSteps.length; ti++){
                        if(data['timestamp'][i] == timeSteps[ti]){
                            for(var ci = 0; ci<clusters[ti].length; ci++){
                                if(data[vmap.a][i] <= clusters[ti][ci].threshold.a[0]
                                    && data[vmap.a][i] >= clusters[ti][ci].threshold.a[1]
                                    && data[vmap.b][i] <= clusters[ti][ci].threshold.b[0]
                                    && data[vmap.b][i] >= clusters[ti][ci].threshold.b[1]){
                                    clusters[ti][ci].count++;
                                    clusters[ti][ci].ranks.push(data['rank'][i]);
                                    nodeTrace[data['rank'][i]].push(ci);
                                    break;
                                }
                            }
                        }
                    }
                }

                for(var i = 0; i<nodeTrace.length; i++){
                    for(var j = 0; j<nodeTrace[i].length-1; j++){
                        clinks[j][nodeTrace[i][j] * (bins.a.length-1) * (bins.b.length-1) + nodeTrace[i][j+1]].count++;
                        clinks[j][nodeTrace[i][j] * (bins.a.length-1) * (bins.b.length-1) + nodeTrace[i][j+1]].ranks.push(i);
                    }
                }

                sankey = Sankey({
                    container: panelMid.body,
                    data: {nodes: clusters, links: clinks},
                    width: width,
                    height: height * 2 * vh,
                    nodeWidth: width / ts.length,
                    padding: padding,
                    // padding: {left: 20, top: 5, bottom: 5, right: 0},
                    onSelectLink: function(d) { var startT = new Date(); visualize(d, startT); }
                });

                console.log(bins);

                // for(var b=1; b<bins.a.length-1; b++){
                //     var h = Math.floor(120 * (b/bins.a.length));
                //     addBinCursorTop(bins.a[b], 'hsl(' + h + ', 100%, 40%)');
                // }
                // //
                // for(var b=1; b<bins.b.length-1; b++){
                //     var h = Math.floor(120 * (b/bins.b.length));
                //     addBinCursorBottom(bins.a[b], 'hsl(' + h + ', 100%, 40%)');
                // }

            }

            showAggregation();

        });

    }
});
