if(typeof(define) == "function") define(function(){return dragonflyLink;});

function dragonflyLink(arg){
    'use strict';
    var option = arg || {},
        data = option.data || {},
        width = option.width || 500,
        height = option.height || width,
        vmap = option.vmap || {},
        container = option.container || null,
        radius = option.radius || width/2,
        color = option.color || 'orange',
        dataRange = option.dataRange || {min: 0, max: 1};

    var num_routers = arg.numRouter || 510,
        num_groups = arg.numGroup || 51,
        num_links = arg.numLink ||  5,
        radix = arg.routerRadix || 16;

    function coord(r, rad){
        var x = width/2 + r * Math.cos(rad),
            y = height/2 + r * Math.sin(rad);
        return {x: x, y: y};
    }

    var ring = container.append("g"),
        links = [];

    var stats = {},
        features = Object.keys(vmap).map(function(k){return vmap[k];});

    for(var f in dataRange) {
        stats[f] = {min: dataRange[f].min, max: dataRange[f].max};
        if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
        stats[f].slope = 1 / (stats[f].max - stats[f].min);
        stats[f].const = -1 / (stats[f].max - stats[f].min);
    }
    //
    // stats = p4.stats(data, features);
    // features.forEach(function(f){
    //     if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
    //     stats[f].slope = 1 / (stats[f].max - stats[f].min);
    //     stats[f].const = -1 / (stats[f].max - stats[f].min);
    // });

    var getSize = function() { return (outerRadius - innerRadius); },
        getColor = function() { return color; },
        getIntensity = function() {return 1.0};

    if("size" in vmap) {
        getSize = i2v.Metric({domain: [stats[vmap.size].min, stats[vmap.size].max], range: [0 , outerRadius-innerRadius]});
    }

    if("color" in vmap) {
        getColor =  function(d){
            var value = color - (d * stats[vmap.color].slope + stats[vmap.color].const) * 120;

            if(value < 0) value = -value;
            return  "hsl("+(Math.floor(value))+", 100%, 50%)";
        };
    }

    // console.log(data);

    ring.init = function() {

        var start = 0,
            router_per_group = num_routers/ num_groups,
            n= num_routers,
            r = d3.scale.linear().domain([n, n/2, 0]).range([radius*0.9, 0, radius*0.9]),
            colorScale = d3.scale.ordinal().range(["#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"]);
            // alphaScale = d3.scale.linear().domain([stats[vmap.color].min, stats[vmap.color].max]);


        for(var i = 0; i<num_routers; i++){
            var router_id = i,
                group_id = Math.floor(router_id / router_per_group);

                router_id = i % router_per_group;
            var first = router_id % num_routers;
            for (var j=0; j < num_links; j++) {
                var target_grp = first;
                if(target_grp == group_id) {
                    target_grp = num_groups - 1;
                }
                var my_pos = group_id % router_per_group;
                if(group_id == num_groups - 1) {
                    my_pos = target_grp % router_per_group;
                }

                var target_pos =  target_grp * router_per_group + my_pos;
                first += router_per_group;
                // console.log(i , target_pos);

                var src = coord(radius,i / n *  2 * Math.PI);
                var dest = coord(radius, target_pos/n *  2 * Math.PI);

                var c = data[i*num_links + j][vmap.color] * stats[vmap.color].slope + stats[vmap.color].const;

                var diff = (target_pos - i);
                var ca = (i+diff/2) / n * 2 * Math.PI;
                if(Math.abs(diff) >= n/2) { ca -= Math.PI; }

                var cp = coord(r(Math.abs(diff)), ca);
                var path = ["M", src.x, src.y, "Q", cp.x, cp.y, dest.x, dest.y].join(' ');


                var link = ring.append("path")
                    .attr("d", path)
                    .css("fill", "transparent")
                    .css("stroke-width", 1)
                    // .css("stroke", colorScale(c));
                    .css("stroke", color)
                    .css("stroke-opacity", c);

                links.push(link);
            }
        }

        // var legendPos = width - 20,
        //     legend = ring.append("g");
        // var grad = container.append("defs")
        //     .append("linearGradient")
        //         .attr("id", "gradlegend")
        //         .attr("x1", "0%")
        //         .attr("x2", "0%")
        //         .attr("y1", "0%")
        //         .attr("y2", "100%");
        //     grad.append("stop")
        //         .attr("offset", "0%" )
        //         .attr("stop-color", 'white');
        //         // .attr("stop-opacity", min/rankTotal);
        //     grad.append("stop")
        //     .attr("offset", "100%" )
        //     .attr("stop-color", 'orange');
        //     // .attr("stop-opacity", 1.0);
        //
        // legend.append("rect")
        //     .attr("x", legendPos)
        //     .attr("y", 10)
        //     .attr("width", 20)
        //     .attr("height", 0.1*height)
        //     .css("fill","url(#gradlegend)");
        //
        // legend.append("text")
        //     .attr("x", legendPos)
        //     .attr("y", 15)
        //     .css("fill", "#222")
        //     .css("font-size", ".9em")
        //     .text(p4.io.printformat(".2s")(stats[vmap.color].min));
        //
        // legend.append("text")
        //     .attr("x", legendPos)
        //     .attr("y", 0.1*height+25)
        //     .css("fill", "#222")
        //     .css("font-size", ".9em")
        //     .text(p4.io.printformat(".2s")(stats[vmap.color].max));

        ring.select = function(selectGroup) {
            links.forEach(function(link, i){
                if(selectGroup >= 0 && selectGroup != Math.floor(i/(num_links*num_routers/num_groups)))
                    link.css("stroke-width", 0);
                else
                    link.css("stroke-width", 1);
            });
        }

        ring.update = function(newData, filterRange) {
            var filter = filterRange || [0, 1];
            if(typeof(newData) != 'undefined' && newData.length) data = newData;
            links.forEach(function(link, i){
                var c = data[i][vmap.color] * stats[vmap.color].slope + stats[vmap.color].const;
                if(c >= filter[0] && c <= filter[1])
                    link.css("stroke-opacity", c);
                else
                    link.css("stroke-opacity", 0);
            })
        }
        return ring;
    }

    return ring.init();

}
