define(["p4/core/pipeline", "d3"], function(pipeline, d3) {
    return function hierCircles(option) {

        var data = option.data,
            width = option.width || 900,
            height = option.height || width,
            container = option.container || "body",
            vmap = option.vmap,
            structs = option.structs || [],
            outerRadius = option.outerRadius || Math.min(width/2, height/2),
            innerRadius = option.innerRadius || outerRadius * 0.4,
            numPartition = option.numPartition || 3;

        var matrix = data.map(function(d){
            // return d.busytimes;
            // return d.traffics;

            return structs[0].vmap.hasOwnProperty("size") ? d[structs[0].vmap.size] : d.counts;
            //
        });

        var chord = d3.layout.chord()
            .padding(0.8/numPartition)
            .sortSubgroups(d3.descending)
            .matrix(matrix);

        var values = [];
        data.forEach(function(d){
            values = values.concat(d[structs[0].vmap.color]);
        });

        var colorScale = d3.scale.linear().domain([ d3.min(values), d3.max(values) ]).range(structs[0].colors);

        var svg = d3.select("#"+container).append("svg")
            .attr("width", width)
            .attr("height", height)
          .append("g")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        function coord(r, d){
            return [
                 r*Math.cos(d- Math.PI / 2),
                 r*Math.sin(d- Math.PI / 2)
            ];
        }

        function vectorAdd(a, b){
            var c = [];
            a.forEach(function(v, i){
                c[i] = v + b[i];
            });

            return c;
        }

        function vectorSum(vectors){
            var result = vectors[0],
                len = vectors[0].length;

            for(var i = 1; i < len; i++){
                result = vectorAdd(result, vectors[i]);
            }

            return result;
        }

        var routers = [], vectorSet = [], terminals = [];

        structs.slice(1).forEach(function(s){
            s.data = [];
        })
        var chordGroups = chord.groups();
        chordGroups.forEach(function(d, di){


            structs.slice(1).forEach(function(s){
                if(s.entity == "router"){
                    if(s.aggregate){
                        var entry = {};
                        Object.keys(s.vmap).forEach(function(m){
                            entry[s.vmap[m]] = vectorSum(data[d.index].data.map(function(a){return a[s.vmap[m]];}));
                        });
                        var delta = (d.endAngle - d.startAngle ) / entry[Object.keys(entry)[0]].length;
                        entry[Object.keys(entry)[0]].forEach(function(e, ei){
                            var start =  d.startAngle + ei*delta;
                            var col = {startAngle: start, endAngle: start + delta, index: ei, pid: d.index};
                            Object.keys(s.vmap).forEach(function(m){
                                col[s.vmap[m]] = entry[s.vmap[m]][ei];
                            });
                            s.data.push(col);
                        });

                    } else {
                        var delta = (d.endAngle - d.startAngle ) / data[d.index].data.length;
                        data[d.index].data.forEach(function(r, ri){
                            var start =  d.startAngle + ri*delta;
                            var entry = {startAngle: start, endAngle: start+delta , pid: d.index};
                            Object.keys(s.vmap).forEach(function(m){
                                var key  = "total_" + s.vmap[m];
                                entry[key] = r[key];
                            });
                            s.data.push(entry);
                        });
                    }

                } else {
                    if(s.aggregate) {
                        var entries = pipeline().group({
                            $by: ['router_rank', 'router_port'],
                            avg_hops: "$avg",
                            busy_time: "$avg",
                            data_size: "$avg",
                            packets_finished: "$avg",
                            avg_packet_latency: "$avg"
                        }).sortBy({router_rank: 1, router_port: 1})(data[d.index].terminals);
                        var delta = (d.endAngle - d.startAngle ) / entries.length;

                        entries.forEach(function(td, ti){
                            var start =  d.startAngle + ti*delta;
                            td.startAngle = start;
                            td.endAngle = start + delta;
                            td.pid = d.index;
                        });

                        s.data = s.data.concat(entries);

                    } else {
                        // data[d.index].terminals.forEach(function(td){ td.startAngle = d.startAngle; td.endAngle = d.endAngle; });

                        var delta = (d.endAngle - d.startAngle ) / data[d.index].terminals.length;
                        data[d.index].terminals.forEach(function(td, ti){
                            var start =  d.startAngle + ti*delta;
                            td.startAngle = start;
                            td.endAngle = start + delta;
                            td.pid = d.index;
                        });
                        s.data = s.data.concat(data[d.index].terminals);
                    }
                }
            });
        });


        svg.append("g")
            .attr("class", "chord")
          .selectAll("path")
            .data(chord.chords)
          .enter().append("path")
            .attr("d", d3.svg.chord().radius(innerRadius))
            // .style("fill", function(d) { return fill(d.target.index); })
            .style("fill", function(d){return colorScale(data[d.source.index][structs[0].vmap.color][d.target.index]); })
            .style("stroke", function(d){return colorScale(data[d.source.index][structs[0].vmap.color][d.target.index]); })
            .style("opacity", 1);

        var cirRange = outerRadius - innerRadius,
            cirSize = structs.slice(1).map(function(s){ return s.size; }).reduce(function(a,b){return a+b;}),
            cirOffset = innerRadius;

        structs.slice(1).forEach(function(s){
            var sectionRadiusRange =  cirOffset + s.size / cirSize * cirRange,
                cirPadding = 0.05 * sectionRadiusRange,
                sectionRadius = 0.95 * sectionRadiusRange,
                getSize = function() { return (sectionRadius); },
                getColor = function() { return s.colors[0]; },
                stats = p4.stats(s.data, Object.keys(s.vmap).map(function(k){
                    return (!s.aggregate && s.entity=="router" ) ? "total_" + s.vmap[k] : s.vmap[k];
                }));
            console.log(cirRange, cirOffset, sectionRadius);
            // console.log(s.data, stats);
            if("size" in s.vmap) {
                var sizeAttr = (!s.aggregate && s.entity=="router" ) ? "total_" + s.vmap.size : s.vmap.size;
                if(stats[sizeAttr].max == stats[sizeAttr].min) stats[sizeAttr].max+=0.000001;
                getSize = d3.scale.linear()
                    .domain([stats[sizeAttr].min, stats[sizeAttr].max])
                    .range([cirOffset, sectionRadius]);
            }

            if("color" in s.vmap) {
                var colorAttr = (!s.aggregate && s.entity=="router" ) ?  "total_" + s.vmap.color : s.vmap.color;
                if(stats[colorAttr].max == stats[colorAttr].min) stats[colorAttr].max+=0.000001;
                getColor =  d3.scale.linear()
                    .domain([stats[colorAttr].min, stats[colorAttr].max])
                    .range(s.colors);
            }

            if("x" in s.vmap && "y" in s.vmap){
                var xAttr = (!s.aggregate && s.entity=="router" ) ?  "total_" + s.vmap.x : s.vmap.x,
                    yAttr = (!s.aggregate && s.entity=="router" ) ?  "total_" + s.vmap.y : s.vmap.y;

                getSize = d3.scale.linear()
                    .domain([stats[sizeAttr].min, stats[sizeAttr].max])
                    .range([0.5, 5]);

                var domainX = [stats[xAttr].min, stats[xAttr].max],
                    domainY = [stats[yAttr].min, stats[yAttr].max];

                var radiusDiff = sectionRadius - cirOffset,
                    paddingY = radiusDiff * 0.04;

                var getPosY = d3.scale.linear()
                    .domain(domainY)
                    .range([cirOffset + paddingY/2, sectionRadius - paddingY/2]);

                s.data.forEach(function(d, di){
                    var angleRange = chordGroups[d.pid].endAngle - chordGroups[d.pid].startAngle,
                        paddingX = 0.04 * angleRange;

                    var getPosX = d3.scale.linear()
                        .domain(domainX)
                        .range([chordGroups[d.pid].startAngle + paddingX/2, chordGroups[d.pid].endAngle- paddingX/2]);

                    var pos = coord(getPosY(d[yAttr]), getPosX(d[xAttr]));

                    d.cx = pos[0];
                    d.cy = pos[1];
                });

                svg.selectAll(".dot")
                      .data(s.data)
                    .enter().append("circle")
                      .attr("class", "dot")
                      .attr("r", function(d){return getSize(d[sizeAttr])})
                      .attr("cx", function(d){return d.cx})
                      .attr("cy",function(d){return d.cy})
                      .style("fill", function(d){return getColor(d[colorAttr])})
                      .style("fill-opacity", 0.5);

                var group = svg.append("g").selectAll("path")
                  .data(chord.groups)
                .enter().append("g");

                group.append("path")
                  .style("fill", "transparent")
                  .style("stroke", "#aaa")
                  .attr("d", d3.svg.arc().innerRadius(cirOffset).outerRadius(sectionRadius))
                  .on("click", fade(0.1))
                  .on("mouseout", fade(1));


                if(s.border) {
                    var groupTick = group.selectAll(".group-tick")
                        .data(function(d) { console.log(groupTicks(d, domainX)); return groupTicks(d, domainX); })
                        .enter().append("g")
                          .attr("class", "group-tick")
                          .attr("transform", function(d) { return "rotate(" + (d.angle * 180 / Math.PI - 90) + ") translate(" + sectionRadius + ",0)"; });

                      groupTick.append("line")
                          .attr("x2", 4)
                          .style("stroke", "#000");

                    groupTick
                    .append("text")
                      .attr("x", 6)
                      .attr("dy", ".35em")
                      .attr("transform", function(d) { return d.angle > Math.PI ? "rotate(180) translate(-16)" : null; })
                      .style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
                      .style("font-size", ".65em")
                      .text(function(d) { return p4.io.printformat(".2s")(d.value); });

                    // Returns an array of tick angles and values for a given group and step.
                    function groupTicks(d, domain) {
                        var range = domain[1] - domain[0];
                        // if(domain[1] === domain[0]) {
                        //     domain[0] -= 0.01;
                        //     domain[1] += 0.01;
                        // } else {
                        //     range = domain[1] * 1.001 - domain[0];
                        // }

                        var k = (d.endAngle - d.startAngle) * 0.90 / range,
                            step = Math.ceil((domain[1] - domain[0]) / (20/Math.pow(numPartition,0.5)));

                        console.log(range, step, d3.range(0, range, step));
                        // if(step <= 0) step =  Math.floor((domain[1] - domain[0]) /2 );
                        return d3.range(0, range, step).map(function(value) {
                            return {value: value, angle: value * k + d.startAngle + (d.endAngle - d.startAngle) * 0.05};
                        });
                    }
                }
            } else {
                var visualElement = svg.append("g").selectAll("path")
                    .data(s.data)
                  .enter().append("path")
                    .style("fill", function(d) { return getColor(d[colorAttr]); })
                    .style("stroke", function(d) { return getColor(d[colorAttr]); })
                    .attr("d",function(d) { return d3.svg.arc().innerRadius(cirOffset).outerRadius(getSize(d[sizeAttr]))(d) });

                if(s.aggregate) {
                    visualElement
                        .style("stroke", '#fff')
                        .style("stroke-width", 0.5);
                }
            }
            cirOffset = sectionRadius + cirPadding;
        });

        svg.append("g").selectAll("path")
            .data(chord.groups)
          .enter().append("path")
            .style("fill", "transparent")
            .style("stroke", "none")
            .attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(innerRadius+20))
            .on("mouseover", fade(0.1))
            .on("mouseout", fade(1));

        // Returns an event handler for fading a given chord group.
        function fade(opacity) {
          return function(g, i) {
            svg.selectAll(".chord path")
                .filter(function(d) { return d.source.index != i && d.target.index != i; })
              .transition()
                .style("opacity", opacity);
          };
        }
    }

});
