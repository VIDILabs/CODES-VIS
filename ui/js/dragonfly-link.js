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
        color = option.color || 'purple',
        colors = option.colors || ["white","brown"],
        threshold = option.threshold || {traffic: [0.5, 1.0], busy_time: [0.0, 1.0]},
        dataRange = option.dataRange || {min: 0, max: 1};

    var num_routers = arg.numRouter || 510,
        num_groups = arg.numGroup || 51,
        num_links = arg.numLink ||  5,
        radix = arg.routerRadix || 16;

    function coord(r, rad){
        var x = width/2 + r * Math.cos(rad - Math.PI / 2),
            y = height/2 + r * Math.sin(rad - Math.PI / 2);
        return {x: x, y: y};
    }

    var ring = container.append("g"),
        links = [];

    var getSize = function() { return 0.5; },
        getColor = function() { return color; },
        getIntensity = function() {return 1.0};

    var stats = {},
        features = Object.keys(vmap).map(function(k){return vmap[k];});

    function config() {
        stats = p4.stats(data, features);
        features.forEach(function(f){
            if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
            stats[f].slope = 1 / (stats[f].max - stats[f].min);
            stats[f].const = -stats[f].min / (stats[f].max - stats[f].min);

            if(!threshold.hasOwnProperty(f)) threshold[f] = [0, 1];
        });

    // for(var f in dataRange) {
    //     stats[f] = {min: dataRange[f].min, max: dataRange[f].max};
    //     if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
    //     stats[f].slope = 1 / (stats[f].max - stats[f].min);
    //     stats[f].const = -1 / (stats[f].max - stats[f].min);
    // }
    //

        if("size" in vmap) {
            getSize = d3.scale.pow().exponent(3).domain([stats[vmap.size].min, stats[vmap.size].max]).range([0 , 3]);
        }

        if("color" in vmap) {

            if(colors.length){
                getColor = d3.scale.linear().domain([stats[vmap.color].min, stats[vmap.color].max]).range(["white", "blue"]);

                // getColor = function(d) {
                //     var colorMap = d3.scale.linear().domain([stats[vmap.color].min, stats[vmap.color].max]).range([0,colors.length-1]);
                //     return colors[Math.floor(colorMap(d))];
                // }
            }

        }
    }

    // console.log(data);

    ring.init = function() {
        config();
        var start = 0,
            router_per_group = num_routers / num_groups,
            n = num_routers,
            r = d3.scale.linear().domain([n, n/2, 0]).range([radius*0.9, 0, radius*0.9]);

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

                var diff = (target_pos - i);
                var ca = (i+diff/2) / n * 2 * Math.PI;
                if(Math.abs(diff) >= n/2) { ca -= Math.PI; }

                var cp = coord(r(Math.abs(diff)), ca);
                var path = ["M", src.x, src.y, "Q", cp.x, cp.y, dest.x, dest.y].join(' ');

                var colorValue = 1,
                    sizeValue = 1,
                    opacity = 1;

                if(vmap.hasOwnProperty("color")) {
                    colorValue = data[i*num_links + j][vmap.color] * stats[vmap.color].slope + stats[vmap.color].const;
                    if(colorValue < threshold[vmap.color][0] || colorValue > threshold[vmap.color][1]) opacity = 0;
                }

                if(vmap.hasOwnProperty("size")) {
                    sizeValue = data[i*num_links + j][vmap.size] * stats[vmap.size].slope + stats[vmap.size].const;
                        if(sizeValue < threshold[vmap.size][0] || sizeValue > threshold[vmap.size][1] ) opacity = 0;
                }

                var link = ring.append("path")
                    .attr("d", path)
                    .css("fill", "transparent")
                    .css("stroke-width", getSize(data[i*num_links + j][vmap.size]))
                    // .css("stroke", color)
                    .css("stroke", getColor(data[i*num_links + j][vmap.color]) )
                    .css("stroke-opacity", opacity);

                // console.log(getColor(data[i*num_links + j][vmap.color]),getSize(data[i*num_links + j][vmap.size]) );

                link.width = getSize(data[i*num_links + j][vmap.size]);
                links.push(link);
            }
        }

        ring.select = function(selectGroup) {
            links.forEach(function(link, i){
                if(selectGroup >= 0 && selectGroup != Math.floor(i/(num_links*num_routers/num_groups))) {
                    link.css("stroke-width", 0);
                } else {
                    link.css("stroke-width", link.width);
                }
            });
        }

        ring.update = function(newData, newThreshold) {
            config();
            if(typeof(newData) != 'undefined' && newData.length) data = newData;
            links.forEach(function(link, i){
                var colorValue = 1,
                    sizeValue = 1,
                    opacity = 1;

                if(typeof(newThreshold) != "undefined") {
                    threshold = newThreshold;
                }

                if(vmap.hasOwnProperty("color")) {
                    colorValue = data[i][vmap.color] * stats[vmap.color].slope + stats[vmap.color].const;
                    if(colorValue < threshold[vmap.color][0] || colorValue > threshold[vmap.color][1]) opacity = 0;
                }

                if(vmap.hasOwnProperty("size")) {
                    sizeValue = data[i][vmap.size] * stats[vmap.size].slope + stats[vmap.size].const;
                        if(sizeValue < threshold[vmap.size][0] || sizeValue > threshold[vmap.size][1] ) opacity = 0;
                }

                link.css("stroke-opacity", opacity)
                    .css("stroke-width", getSize(data[i][vmap.size]))
                // .css("stroke", color)
                    .css("stroke", getColor(data[i][vmap.color]) );
            })
        }
        return ring;
    }

    return ring.init();
}
