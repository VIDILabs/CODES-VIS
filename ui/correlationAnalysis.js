var dependencies = [
    'vui/panel',
    'vui/dropdown',
    'js/sankey'
];

define(dependencies, function(Panel, DropDownMenu, Sankey) {

    return function main(datasetID, layoutID){

        var metadata,
            data = {},
            ctypes = p4.ctypes.ctypes,
            width = 1000,
            height = 830,
            vh = 0.20,
            padding = {left: 60, right: 30, top: 35, bottom: 30};

        var container = Panel({
                container: layoutID,
                width: width + padding.left + padding.right + 40,
                height: height + padding.top + padding.bottom + 10,
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
                width: width + padding.left + padding.right,
                height: height*vh + padding.bottom,
                header: true,
                headerHeight: padding.top
            }),
            panelMid = Panel({
                container: container.body,
                width: width + padding.left + padding.right,
                height: height*vh*2 + padding.bottom + padding.top,
                // header: true,
                headerHeight: padding.top
            }),
            panelBottom = Panel({
                container: container.body,
                width: width + padding.left + padding.right,
                height: height*vh + padding.bottom,
                header: true,
                headerHeight: padding.top
            });

            container.body.style.margin = "20px";

            // var webgl = i2v.WebGL({
            //     container: container.body,
            //     height: height,
            //     width: width,
            //     // margin: {left: padding.left+20, right: padding.right+20, top: padding.top+20, bottom: padding.bottom+20}
            // });

            panelTop.header.style.height = padding.top - 5 + "px";
            panelBottom.header.style.height = padding.top -5 + "px";
            // panelMid.header.style.height = padding.top -5 + "px";
            panelMid.style.top = height * (vh+0.1) + "px";
            panelBottom.style.top = height * (vh*3+0.2) + "px";

        var svgTop = i2v.Svg({width: width, height: height*vh, padding: padding}),
            svgBottom = i2v.Svg({width: width, height: height*vh, padding: padding}),
            svgMid = i2v.Svg({width: width, height: height*vh*2, padding: padding}),
            sankey,
            xAxis1,
            xAxis2,
            xAxis3,
            yAxis1,
            yAxis2,
            yAxis3,
            timeSteps;

        var sankeyCursors = [],
            bins = {a: [1.0, 0.25, 0.05, 0.0], b:[1.0, 0.25, 0.05, 0]},
            gamma = 1.0,
            timeRelative = false,
            showAggregation;

        svgTop.style.top = 0;
        svgMid.style.top = height * (vh+0.1) + "px";
        svgBottom.style.top = height * (vh*3+0.2) + "px";

        container.append(svgTop);
        container.append(svgMid);
        container.append(svgBottom);
        // svgMid.appendChild();

        var vmap = {x:"timestamp", y: "rank"},
            analyticModel = 3;
        // var vmap = {x:"timestamp", y: "rank", a: "traffic_global0", b: "traffic_local5"};

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
            var size = metadata.size,
                offset = 0,
                types = metadata.types,
                attributes = metadata.names.filter(function(n){ return (["timestamp", "rank", "group_id", "router_id", "port", "type"].indexOf(n)==-1)});

            metadata.names.forEach(function(n, i){
                data[n] = new ctypes[types[i]](binary.slice(offset, offset+size*ctypes[types[i]].BYTES_PER_ELEMENT));
                offset += size * ctypes[types[i]].BYTES_PER_ELEMENT;
            });

            var ts = [],
                ranks = [],
                start;

            for(var i = 0; i < size; i++)
                if(data.rank[i] === 0) ts.push(data.timestamp[i]);

            console.log(ts[0]);
            for(var i = 0; i < size; i++){
                if(data.timestamp[i] === ts[0]) ranks.push(data.rank[i]);
            }

            var stats = p4.ctypes.query.stats(data, metadata.names);

            // attributes = [];
            // metadata.names.forEach(function(n, i){
            //     if(n != vmap.x && n != vmap.y) attributes.push(n);
            // });

            vmap.a = attributes[0];
            vmap.b = attributes[1];


            var attrTop = DropDownMenu({
                container: panelTop.header,
                options: attributes,
                selected: attributes.indexOf(vmap.a),
                label: "Attribute"
            }).onchange = function(d) {
                vmap.a = d;
                svgTop.removeChild(yAxis1.show());
                yAxis1 = svgTop.axis({
                    dim: "y",
                    domain: [stats[vmap.a].min, stats[vmap.a].max],
                    align: "left",
                    labelPos: {x: -20, y: -5},
                    ticks: 7,
                    scale: "power",
                    exponent: gamma,
                    format: p4.io.printformat(".2s")
                });
                svgTop.appendChild(yAxis1.show());
                if(analyticModel==3) showAggregation();
                visualize();
            };

            var attrBottom = DropDownMenu({
                container: panelBottom.header,
                options: attributes,
                selected: attributes.indexOf(vmap.b),
                label: "Attribute"
            }).onchange = function(d) {
                vmap.b = d;
                svgBottom.removeChild(yAxis2.show());
                yAxis2 = svgBottom.axis({
                    dim: "y",
                    domain: [stats[vmap.b].min, stats[vmap.b].max],
                    align: "left",
                    labelPos: {x: -20, y: -5},
                    ticks: 7,
                    scale: "power",
                    exponent: gamma,
                    format: p4.io.printformat(".2s")
                });
                svgBottom.appendChild(yAxis2.show());
                if(analyticModel==3) showAggregation();
                visualize();
            }

            // var selectModel = DropDownMenu({
            //         container: panelMid.header,
            //         options: ["Linear Comination", "Force Directed", "Aggregation"],
            //         selected: 0,
            //         label: "Statistical Model",
            // }).onchange = function(d){
            //     analyticModel = ["Linear Comination", "Force Directed", "Aggregation"].indexOf(d)+1;
            //     try {svgMid.removeChild(sankey) } catch(e){}
            //     if(analyticModel==3) showAggregation();
            //     visualize();
            // };
            console.log(attributes);
            var timeStats = {};
            attributes.forEach(function(attr){
                timeStats[attr] = [];
                for(var t = 0; t<ts.length; t++){
                    timeStats[attr][t] = {min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, avg: 0};
                }

                for(var i = 0; i < size; i++){
                    var ti = Math.floor(data["timestamp"][i] / ts[0] - 1);
                    if(data[attr][i] > timeStats[attr][ti].max) timeStats[attr][ti].max = data[attr][i];
                    else if(data[attr][i] < timeStats[attr][ti].min) timeStats[attr][ti].min = data[attr][i];

                    timeStats[attr][ti].avg += data[attr][i];
                }

                for(var t = 0; t<ts.length; t++){
                    timeStats[attr][t].avg = timeStats[attr][t].avg / ranks.length;
                }
            });
            // console.log(timeStats);

            //console.log("preprocessing time: ", new Date() - start);
            // console.log(ts, ranks);
            // showAggregation();
            //

            xAxis1 = svgTop.axis({
                dim: "x",
                domain: [stats[vmap.x].min, stats[vmap.x].max],
                align: "bottom",
                ticks: 10,
                //tickInterval: 10000000,
                labelPos: {x: 0, y: -20},
                format: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; }
            });
            yAxis1 = svgTop.axis({
                dim: "y",
                domain: [stats[vmap.a].min, stats[vmap.a].max],
                align: "left",
                scale: "power",
                exponent: gamma,
                labelPos: {x: -20, y: -5},
                ticks: 6,
                format: p4.io.printformat(".2s")
            });


            xAxis2 = svgTop.axis({
                dim: "x",
                domain: [stats[vmap.x].min, stats[vmap.x].max],
                align: "bottom",
                ticks: 10,
                //tickInterval: 10000000,
                labelPos: {x: 0, y: -20},
                format: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; }
            });

            yAxis2 = svgTop.axis({
                dim: "y",
                domain: [stats[vmap.b].min, stats[vmap.b].max],
                align: "left",
                labelPos: {x: -20, y: -5},
                ticks: 7,
                scale: "power",
                exponent: gamma,
                format: p4.io.printformat(".2s")
            });

            xAxis3 = svgTop.axis({
                dim: "x",
                domain: [stats[vmap.x].min, stats[vmap.x].max],
                range : [0, width],
                // align: "bottom",
                position: svgMid.clientHeight - padding.top- padding.bottom,
                ticks: 10,
                //tickInterval: 10000000,
                labelPos: {x: 0, y: -20},
                format: function(d) { return p4.io.printformat(".2s")(d / 1000000) + "ms"; }
            });

            yAxis3 = i2v.Metric({
                domain: [0, 1],
                range: [height*vh*2, 0],
            });

            svgTop.appendChild(xAxis1.show());
            svgTop.appendChild(yAxis1.show());
            svgBottom.appendChild(xAxis2.show());
            svgBottom.appendChild(yAxis2.show());
            svgBottom.cursorLines = [];
            svgTop.cursorLines = [];
            var sankeyAxis = xAxis3.show();
            svgMid.appendChild(sankeyAxis);

            // var statsLines = svgMid.append("g");
            //
            // attributes.forEach(function(attr, ai){
            //     var min = p4.arrays.min(timeStats[attr].map(function(d){return d.min;})),
            //         max = p4.arrays.max(timeStats[attr].map(function(d){return d.max;}));
            //     var curve = i2v.svgTop.line({
            //         x: ts.map(function(d){return xAxis2(d); }),
            //         y: timeStats[attr].map(function(d){return yAxis3((d.avg - min)/(max-min));})
            //     });
            //
            //     statsLines.append("path")
            //        .attr("d", curve())
            //        .attr("fill", 'none')
            //        .css("fill-opacity", ai*0.2+0.2)
            //        .css("stroke-width", 1.0)
            //        .css("stroke", '#');
            // })

            timeSteps = [ts[0], ts[Math.floor(ts.length*0.3-1)], ts[Math.floor(ts.length*0.6-1)], ts[Math.floor(ts.length*0.9-1)]];

            showAggregation = function showAggregation() {
                try {svgMid.removeChild(sankey) } catch(e){};
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
                                x: xAxis3(t)-5,
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
                    container: svgMid,
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

            function getTimeFromPosition (pos) {
                return ts[Math.floor(xAxis3.invert( pos - padding.left - 30)/ts[0])-1];
            }


            svgMid.append("rect")
                .attr("x", padding.left)
                .attr("y", height*2*vh+padding.top)
                .attr("width", width)
                .attr("height", 20)
                .css("fill", "#fff")
                .css("fill-opacity", 0.0)
                .onclick = function(evt) {
                evt.preventDefault();
                var cts = getTimeFromPosition(evt.clientX);
                console.log(cts, evt.clientX, setSankeyCursorPosition(cts));
                for(var i=1; i<timeSteps.length; i++){
                    if(cts > timeSteps[i-1] && cts < timeSteps[i]) {
                        timeSteps.splice(i, 0, cts);
                        addSankeyCursor(cts, i);
                        break;
                    }
                }
                showAggregation();
            }

            var cy = svgMid.clientHeight - padding.bottom ;

            function setSankeyCursorPosition(ti){
                return xAxis3(ti)+padding.left+ ","
                    + cy  + " " + (xAxis3(ti)+padding.left-10)
                    + "," + (cy +20) + " " + (xAxis3(ti)+padding.left+10)
                    + "," + (cy+20);
            }

            function addSankeyCursor(ti, id){
                var cursor = svgMid.append("polygon")
                    .attr("points",  setSankeyCursorPosition(ti))
                    .attr("fill", "steelblue")
                    .css("cursor", "move")
                    .attr("fill-opacity", 0.8);

                cursor.moveStart = false;
                cursor.cursorID = id;

                cursor.onmousedown = function(evt){
                    evt.preventDefault();
                    if(evt.button == 0){
                        cursor.moveStart = true;
                        cursor.prevPos = evt.clientX;
                        // showAggregation();
                    } else {
                        // TODO: check remove cursor
                        timeSteps.splice(this.cursorID, 1);
                        for(var ci=this.cursorID; ci<sankeyCursors.length; ci++){
                            sankeyCursors[ci].cursorID--;
                        }
                        svgMid.removeChild(cursor);
                        showAggregation();
                    }
                }

                for(var ci=id; ci<sankeyCursors.length; ci++){
                    sankeyCursors[ci].cursorID++;
                }

                sankeyCursors.splice(id, 0, cursor);
                svgMid.appendChild(cursor);
                return cursor;
            }

            svgMid.onmousemove = function(evt) {
                sankeyCursors.forEach(function(sc){
                    if(sc.moveStart && evt.clientX-padding.left-30 > 0 && evt.clientX-padding.left-30 < width) {
                        sc.translate(evt.clientX - sc.prevPos, 0);
                        sc.prevPos = evt.clientX;
                    }
                });
            }

            svgMid.onmouseup = function(evt) {

                sankeyCursors.forEach(function(sc){
                    if(sc.moveStart) {
                        sc.moveStart = false;
                        var cts = getTimeFromPosition(evt.clientX);
                        sc.setAttribute("points", setSankeyCursorPosition(cts));
                        sc.setAttribute("transform", "");
                        timeSteps[sc.cursorID] = cts;
                        showAggregation();
                    }
                });
            };

            timeSteps.forEach(function(ti, tii){
                addSankeyCursor(ti, tii);
            });

            function addBinCursorTop(thres, color){
                // var cursor = svgTop.append("polygon")
                //    .attr("points",  width+ "," + (thres)*svgTop.clientHeight  + " " + (width+20) + "," + ((thres)*svgTop.clientHeight -10) + " " + (width+20) + "," + ((thres)*svgTop.clientHeight +10) )
                //    .attr("fill", color)
                //    .css("cursor", "move")
                //    .attr("fill-opacity", 0.7);
                // cursor.translate(padding.left, padding.top);

                var cursorLine = {};
                cursorLine.x = ts.map(function(t){
                    return xAxis1(t);
                });

                cursorLine.y = timeStats[vmap.a].map(function(t){
                    return yAxis1(t.max * (1-thres));
                });

                cursorLine.path = i2v.svg.line({
                    x: cursorLine.x,
                    y: cursorLine.y
                });

                cursorLine.svg = svgTop.append("path")
                   .attr("points",  width+padding.left+ "," + (1-thres)*svgTop.clientHeight  + " " + (width+padding.left+20) + "," + ((1-thres)*svgTop.clientHeight -10) + " " + (width+padding.left+20) + "," + ((1-thres)*svgTop.clientHeight +10) )
                   .attr("d", cursorLine.path())
                   .css("fill", "none")
                   .css("stroke", color)
                   .css("stroke-width", 2);

                cursorLine.svg.translate(padding.left, padding.top);
                // var classLegend = svgMid.append("rect")
                //     .attr("x", width)
                //     .attr("y", padding.top + 40)
                //     .attr("width", 15)
                //     .attr("height", height*0.6*vh)
                //     .css("cursor", "move")
                //     .attr("fill", "#888");
                //
                // var classLegend = svgMid.append("polygon")
                //     .attr("points", width+","+(padding.top+10)+" "+width+","+(padding.top+30)+" "+(width+20)+","+(padding.top+10))
                //     .css("fill", "#777");
                //
                //
                // var classLegend = svgMid.append("polygon")
                //     .attr("points", width+","+( padding.top * 2 + 40 + height*0.6 * vh)+" "+width+","+( padding.top * 2 + 40 + height*0.6 * vh)+" "+(width+20)+","+( padding.top * 2 + 20 + height*0.6 * vh))
                //     .css("fill", "red");

                // var classLegend = svgMid.append("rect")
                //     .attr("x", width)
                //     .attr("y", padding.top * 2 + 40 + height*0.6 * vh)
                //     .attr("width", 15)
                //     .attr("height", height*0.6*vh)
                //     .css("cursor", "move")
                //     .attr("fill", "#888");
                // svgTop.appendChild(cursorLine.svg());
                // console.log(cursorLine);
            }

            function addBinCursorBottom(thres, color){
                // svgBottom.append("polygon")
                //    .attr("points",  width+padding.left+ "," + (1-thres)*svgBottom.clientHeight  + " " + (width+padding.left+20) + "," + ((1-thres)*svgBottom.clientHeight-10) + " " + (width+padding.left+20) + "," + ((1-thres)*svgBottom.clientHeight+10) )
                //    .attr("fill", color)
                //    .css("cursor", "move")
                //    .attr("fill-opacity", 0.7);

                   var cursorLine = {};
                   cursorLine.x = ts.map(function(t){
                       return xAxis2(t);
                   });

                   var max = stats[vmap.b].max;
                   cursorLine.y = timeStats[vmap.b].map(function(t){
                       if(timeRelative) max = t.max;
                       return yAxis2(max * thres);
                   });

                   cursorLine.path = i2v.svg.line({
                       x: cursorLine.x,
                       y: cursorLine.y
                   });

                   var cursorLineSvg = svgBottom.append("path")
                      .attr("points",  width+padding.left+ "," + (1-thres)*svgBottom.clientHeight  + " " + (width+padding.left+20) + "," + ((1-thres)*svgBottom.clientHeight -10) + " " + (width+padding.left+20) + "," + ((1-thres)*svgBottom.clientHeight +10) )
                      .attr("d", cursorLine.path())
                      .css("fill", "none")
                      .css("stroke", color)
                      .css("stroke-width", 2);

                   cursorLineSvg.translate(padding.left, padding.top);

                //    svgBottom.cursorLines.push(cursorLineSvg);
            }

            /*-----------------------------------------
                WebGL codes start here
            ------------------------------------------ */
            var webgl = i2v.WebGL({
                container: container.body,
                height: height,
                width: width,
                margin: padding
            });

            //vertex attributes, each vertex is a pair of (rank, timestamp)
            var vArray = new Float32Array(size*2);
            for(var ii = 0; ii<size; ii++){
                vArray[ii*2] = data[vmap.x][ii];
                vArray[ii*2+1] = data[vmap.y][ii];
            }

            //calculate the size of the texture (texture size must be power of 2)
            var texWidth = Math.pow(2, Math.ceil(Math.log2(xAxis1.domain()[1]/ts[0]))),
                texHeight = Math.pow(2, Math.ceil(Math.log2(ranks.length)));
                texArray = {};

            //setup all attributes, uniform, texture, varying needed by all the shaders
            webgl.uniform("vec2", "xDomain", xAxis1.domain())
                .uniform("vec2", "yDomain", [stats[vmap.y].min, stats[vmap.y].max])
                .uniform("vec4", "u_color", [0.25, 0.545, 0.667, 1.0])
                .uniform("float", "u_tw", ts[0]*texWidth)
                .uniform("float", "u_th", texHeight)
                .uniform("int", "numAttr", attributes.length)
                .uniform("int", "analyticModel", 0)
                .uniform("float", "u_highlight", 0.0)
                .varying("float", "v_highlight", 0.0)
                .texture("sampler2D", "ranks", [texHeight, 1], new Float32Array(texHeight))
                .texture("sampler2D", "coefs", [texWidth, attributes.length], new Float32Array(texWidth*5))
                .attribute("vec2", "pos", vArray);

            console.log("texSize", texWidth, texHeight, ts.length, ranks.length);


            //each variable/attribute of the data is stored as a 2D texture
            attributes.forEach(function(attr){
                var min = stats[attr].min,
                    max = stats[attr].max,
                    slope = 1 / (max - min),
                    coef = -min / (max - min);

                texArray[attr] = new Float32Array(texWidth*texHeight)
                for(var i = 0; i < ranks.length ; i++){
                    for(var j = 0; j < ts.length; j++){
                        texArray[attr][i*texWidth+j] =  slope * data[attr][i*ts.length+j] + coef;
                    }
                }
                webgl.uniform("float", "uw_"+attr, 0.0)
                    .texture("sampler2D", attr, [texWidth, texHeight], texArray[attr]);
            })

            // var coef = 1 - stats[vmap.b].min,
            //     min = Math.log2(stats[vmap.b].min+coef),
            //     max = Math.log2(stats[vmap.b].max+coef);
            // for(var i = 0; i < ranks.length ; i++){
            //     for(var j = 0; j < ts.length; j++){
            //         texArray.timeSpent[i*texWidth+j] = (data[vmap.b][i*ts.length+j] - stats[vmap.b].min) / (stats[vmap.b].max - stats[vmap.b].min);
            //         texArray.dataSize[i*texWidth+j] = (data[vmap.t][i*ts.length+j] - stats[vmap.t].min) / (stats[vmap.t].max - stats[vmap.t].min);
            //          //         texArray.busyTime[i*texWidth+j] = Math.log2(data[vmap.b][i*ts.length+j]+1) / Math.log2(stats[vmap.b].max);
                        //         texArray.dataSize[i*texWidth+j] =  (Math.log2(data[vmap.t][i*ts.length+j]+1) - 0.1) / (maxt - 0.1);
            //     }
            // }
            // console.log(mint, maxt, texArray.dataSize);


            /* ====================================================
                Vertex Shander
            ======================================================= */
            function mainVert(){
                $float.x = (pos.x - xDomain.x) / (xDomain.y - xDomain.x) * 2.0 - 1.0;

                $float.s = (pos.x - xDomain.x) / (u_tw - xDomain.x);
                $float.t = (pos.y - yDomain.x) / (u_th - yDomain.x);

                $float.y = 0.0;
                if(analyticModel == 1){
                    $(linearDiscriminant);
                } else if(analyticModel == 2){
                    $(forceDirected);
                } else if(analyticModel == 3){
                    y =  0.0;
                } else {
                    $(weightedAverage);
                }
                y = y * 2.0 - 1.0;
                gl_Position = vec4(x, y, 0.0, 1.0);

                if(u_highlight > 0.0){
                    v_highlight = texture2D(ranks, vec2(t, 0)).a;
                } else {
                    v_highlight = 0.0;
                }
            }

            /* ====================================================
                Fragment Shander
            ======================================================= */
            function mainFrag() {
                if(v_highlight == 1.0) {
                    gl_FragColor = vec4(0.0, 1.0, 0.0, 0.5);
                } else if(v_highlight == 2.0) {
                    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5);
                } else if(v_highlight > 2.0) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else {
                    gl_FragColor = u_color;
                }
            }

            // var weightedAverage = "if(uw_data_size != 0.0) { y += texture2D( data_size, vec2(s, t) ).a; }"
            var weightedAverage = "";
            attributes.forEach(function(attr){
                if(attr != vmap.x && attr != vmap.y ){
                    weightedAverage += "if(uw_" + attr + " != 0.0) { y = y + uw_" + attr + " * texture2D(" + attr + ", vec2(s, t)).a; }\n";
                }
            });

            var forceDirected = "y = 0.5;";
            attributes.forEach(function(attr, ai){
                forceDirected += " y = y + uw_" + attr + " * (texture2D(" + attr + ", vec2(s, t)).a + texture2D(coefs, vec2(s, "+ai/attributes.length+")).a); \n";
            });

            var linearDiscriminant = "";
            attributes.forEach(function(attr, ai){
                linearDiscriminant += "y = y +  texture2D(" + attr + ", vec2(s, t)).a * texture2D(coefs, vec2(s, "+ai/attributes.length+")).a;\n";
            });
            linearDiscriminant += "y = 0.5 * y + 0.5";

            console.log(forceDirected);

            // Setup sharders
            var vs = webgl.shader()
                .vertex()
                // .require(['xDomain', "yDomain", "pos", "u_tw", "u_th", vmap.a])
                // .env({weightedAverage: weightedAverage})
                .env({forceDirected: forceDirected, linearDiscriminant: linearDiscriminant, weightedAverage: weightedAverage})
                .function("void", "main", mainVert)
                .init();

            var fs = webgl.shader().fragment().require(["u_color", "v_highlight", "ranks"]).function("void", "main", mainFrag).init();

            var gl = webgl.program([vs, fs]);

            var selectedRanksHigh = [],
                selectedRanksLow = [],
                tvh = {},
                tvl = {},
                texRanks = new Float32Array(texHeight),
                texCoefs = new Float32Array(texWidth*attributes.length);

            //Draw functions
            function visualize(hl, start) {
                gl.clearColor(1.0,1.0,1.0,1.0);
                // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
                gl.enable( gl.BLEND );
                gl.blendEquation( gl.FUNC_ADD );
                gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

                /*************************************
                    Draw Top
                 *************************************/
                attributes.forEach(function(attr){
                    if(attr != vmap.x && attr != vmap.y )
                        webgl.uniform["uw_"+attr] = 0.0;
                })
                webgl.uniform['analyticModel'] = 0;
                webgl.uniform["uw_"+vmap.a] = 1.0;

                //var start = new Date();
                gl.viewport(0, height*(1-vh), width, height*vh);
                var pointsTotal = vArray.length/2,
                    pointsPerLine = ts.length;

                var a = 0.1;
                webgl.uniform.u_color = [0.25 * a, 0.545*a, 0.667*a, a];

                for(var ii = 0; ii < vArray.length/2; ii += pointsPerLine){
                     gl.drawArrays(gl.LINE_STRIP, ii, pointsPerLine);
                }

                for(var i = 0; i<selectedRanksHigh.length; i++){
                     gl.drawArrays(gl.LINE_STRIP, selectedRanksHigh[i]*pointsPerLine, pointsPerLine);
                }

                if(Array.isArray(hl)){
                    webgl.uniform.u_color = [1.0, 1.0, 0.0, 1.0];
                    for(var i = 0; i<hl.length; i++){
                         gl.drawArrays(gl.LINE_STRIP, hl[i]*pointsPerLine, pointsPerLine);
                    }
                }

                /*************************************
                    Draw Middle
                 *************************************/
                webgl.uniform['analyticModel'] = analyticModel;
                attributes.forEach(function(attr){
                    webgl.uniform["uw_"+attr] = 1 / attributes.length;
                })
                var a = 0.1;
                webgl.uniform.u_color = [0.25 * a, 0.545*a, 0.667*a, a];
                gl.viewport(0, height*(vh+0.1), width, height * 2 * vh);
                for(var ii = 0; ii < vArray.length/2; ii += pointsPerLine){
                     gl.drawArrays(gl.LINE_STRIP, ii, pointsPerLine);
                }

                /*************************************
                    Draw Bottom
                 *************************************/
                attributes.forEach(function(attr){
                    if(attr != vmap.x && attr != vmap.y )
                        webgl.uniform["uw_"+attr] = 0.0;
                })
                webgl.uniform['analyticModel'] = 0;
                webgl.uniform["uw_"+vmap.b] = 1.0;
                var a = 0.1;
                webgl.uniform.u_color = [0.25 * a, 0.545*a, 0.667*a, a];
                gl.viewport(0, 0, width, height * vh);
                for(var ii = 0; ii < vArray.length/2; ii += pointsPerLine){
                     gl.drawArrays(gl.LINE_STRIP, ii, pointsPerLine);
                }

                for(var i = 0; i<selectedRanksLow.length; i++){
                     gl.drawArrays(gl.LINE_STRIP, selectedRanksLow[i]*pointsPerLine, pointsPerLine);
                }
                // for(var i = 0; i<selectedRanksHigh.length; i++){
                //      gl.drawArrays(gl.LINE_STRIP, selectedRanksHigh[i]*pointsPerLine, pointsPerLine);
                // }
                //
                if(Array.isArray(hl)){
                    webgl.uniform.u_color = [1.0, 1.0, 0.0, 1.0];
                    for(var i = 0; i<hl.length; i++){
                         gl.drawArrays(gl.LINE_STRIP, hl[i]*pointsPerLine, pointsPerLine);
                    }
                }

                console.log("render time", new Date() - start);
            }
            visualize();
            /**********************************************
                User Interactions
             **********************************************/
            attributes.forEach(function(attr, ai){
                 tvh[attr] = [];
                 tvl[attr] = [];
                 for(var t = 0, tl = ts.length; t<tl; t++){
                     tvh[attr][t] = 0;
                     tvl[attr][t] = 0;
                 }

            });

             function selectHighNodes(ctr) {
                 var ti = Math.floor(xAxis1.invert((ctr.x)-padding.left)/ ts[0])+1,
                     yh = Math.floor(yAxis1.invert((ctr.y)-padding.top)),
                     yl = Math.floor(yAxis1.invert((ctr.y + ctr.height)-padding.top)),
                     yd = yAxis1.domain();

                 selectedRanksHigh = [];
                 for(var i = 0; i<size; i++){
                     if(ts[ti] == data['timestamp'][i]){
                         if(data[vmap.a][i] <= yh && data[vmap.a][i] >= yl){
                             selectedRanksHigh.push(data['rank'][i]);
                         }
                     }
                 }

                 for(var i = 0; i<texRanks.length; i++){
                        if(texRanks[i] == 1.0 || texRanks[i] == 3.0) texRanks[i] -= 1.0;
                 }

                 for(var i = 0, l=selectedRanksHigh.length; i<l; i++){
                        texRanks[selectedRanksHigh[i]] += 1.0;
                 }

                 webgl.texture['ranks'] = texRanks;
                 webgl.uniform['u_highlight'] = 1.0;
                 visualize();
             }

             function selectLowNodes(ctr) {
                 var ti = Math.floor(xAxis2.invert((ctr.x)-padding.left)/ ts[0])+1,
                     yh = Math.floor(yAxis2.invert((ctr.y)+padding.top)),
                     yl = Math.floor(yAxis2.invert((ctr.y + ctr.height)+padding.top)),
                     yd = yAxis2.domain();

                 selectedRanksLow = [];
                 for(var i = 0; i<size; i++){
                     if(ts[ti] == data['timestamp'][i]){
                         if(data[vmap.b][i] <= yh && data[vmap.b][i] >= yl){
                             selectedRanksLow.push(data['rank'][i]);
                         }
                     }
                 }

                 for(var i = 0; i<texRanks.length; i++){
                     if(texRanks[i] == 2.0 || texRanks[i] == 3.0) texRanks[i] -= 2.0;
                 }

                 for(var i = 0, l=selectedRanksLow.length; i<l; i++){
                     texRanks[selectedRanksLow[i]] += 2.0;
                 }

                 webgl.texture['ranks'] = texRanks;
                 webgl.uniform['u_highlight'] = 1.0;
                 visualize();
             }

        });
    };
});
