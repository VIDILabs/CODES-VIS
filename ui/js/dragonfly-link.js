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
        stats[f].slope = 1 / (stats[f].max - stats[f].min);
        stats[f].const = -1 / (stats[f].max - stats[f].min);
    }

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
            r = i2v.Metric().domain([n, 0]).range([0,radius*0.9]);

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

                var diff = (target_pos - i)  / 2,
                    cp;

                var ca = (i+diff) / n * 2 * Math.PI;
                if(diff >= n/4) { ca += Math.PI; diff = diff+n/2; }
                if(diff<0) diff += n;

                var cp = coord(Math.pow(r((diff*2)%n),0.9), ca);

                var path = ["M", src.x, src.y, "Q", cp.x, cp.y, dest.x, dest.y].join(' ');

                var link = ring.append("path")
                    .attr("d", path)
                    .css("fill", "transparent")
                    .css("stroke-width",  0.5)
                    .css("stroke","orange")
                    .css("stroke-opacity", c);

                links.push(link);
            }
        }

        ring.update = function(data) {
            links.forEach(function(link, i){
                var c = data[i][vmap.color] * stats[vmap.color].slope + stats[vmap.color].const;
                link.css("stroke-opacity", c);
            })
        }

        return ring;
    }

    return ring.init();

}
