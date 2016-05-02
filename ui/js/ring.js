function ringPlot(option){

    var option = option || {},
        data = option.data || {},
        width = option.width || 500,
        height = option.height || width,
        vmap = option.vmap || {},
        container = option.container || null,
        innerRadius = option.innerRadius || width/2 * 0.8,
        outerRadius = option.outerRadius || width/2,
        dataRange = option.dataRange || {min: 0, max: 1},
        color = option.color || 120,
        circle = option.circle || false;

    var stats = {},
        features = Object.keys(vmap).map(function(k){return vmap[k];});
        // stats = p4.stats(data,features);

    var ring = container.append("g");
    // if(container) {
    //     container = (typeof(container) == "string") ? document.getElementById(container) : container;
    //     container.appendChild(ring);
    // }

    for(var f in dataRange) {
        stats[f] = {min: dataRange[f].min, max: dataRange[f].max};
        if(stats[f].max == stats[f].min) stats[f].max += 0.0001;
        stats[f].slope = 1 / (stats[f].max - stats[f].min);
        stats[f].const = -1 / (stats[f].max - stats[f].min);
    }
    // console.log(vmap, stats);
    function coord(r, rad){
        var x = width/2 + r * Math.cos(rad),
            y = height/2 + r * Math.sin(rad);
        return {x: x, y: y};
    }

    var getSize = function() { return (outerRadius - innerRadius); },
        getColor = function() { return color; },
        getIntensity = function() {return 1.0};

    if("size" in vmap) {
        getSize = i2v.Metric({domain: [stats[vmap.size].min, stats[vmap.size].max], range: [0 , outerRadius-innerRadius]});
    }

    if("color" in vmap) {
        getColor =  function(d){
            var value = 120 - (d * stats[vmap.color].slope + stats[vmap.color].const) * 120;

            if(value < 0) value = -value;
            if(value > 360) value = Math.abs(color);
            return  "hsl("+(Math.floor(value))+", 100%, 38%)";
        };
    }

    ring.init = function() {
        var start = 0,
            end =  2 * Math.PI,
            n = data.length,
            interval = (end - start) / n;

        var items = [];
        for(var i = 0; i<n; i++) {
            if(circle){
                var cirSize = 0.5 * (outerRadius - innerRadius),
                    pos = coord(innerRadius + cirSize, start + 0.5*interval);

                var vi = ring.append("circle")
                    .attr('cx', pos.x)
                    .attr('cy', pos.y)
                    .attr('r', Math.max(1, 0.5*getSize(data[i][vmap.size])))
                    .attr("fill", getColor(data[i][vmap.color]));

                items.push(vi);
                    // .attr("fill", "blue");
            } else {
                var size  = getSize(data[i][vmap.size]);
                var vi = 0;
                if(size>0){
                    var arc = i2v.SvgArc({
                        outerRadius: innerRadius + size,
                        innerRadius: innerRadius,
                        width: width,
                        height: height,
                        radianStart: start,
                        radianEnd: start + interval,
                    });

                    vi = ring.append("path")
                        .attr("class", "arc")
                        .attr("d", arc)
                        .attr("stroke-width", 0)
                        // .attr("fill", color)
                        .attr("fill", getColor(data[i][vmap.color]));
                        // .attr("fill-opacity", (data[i][feature] * c1 + c0) * 0.95 + 0.05);
                    // if(!vmap.color && nodeType0.indexOf(data[i]["terminal_id"])>0) vi.attr("fill", "purple");
                }
                // items.push(vi);
            }
            start += interval;
        }
        // ring.items = items;
        return ring;
    };

    return ring.init();
};
function ringGrid(option){
    var option = option || {},
        width = option.width || 600,
        height = option.height || width*0.5,
        padding = option.padding || {top:20, bottom: 20, left: 40, right: 20},
        count = option.count || 8,
        container = option.container || null,
        innerRadius = option.innerRadius || 50,
        outerRadius = option.outerRadius || 100;

    var ring =  container.append("g");
    // if(container) {
    //     container = (typeof(container) == "string") ? document.getElementById(container) : container;
    //     container.appendChild(ring);
    // }


    ring.init = function() {

        function coord(r, rad){
            var x = width/2 + r * Math.cos(rad),
                y = height/2 + r * Math.sin(rad);
            return {x: x, y: y};
        }

        var start = 0,
            end =  2 * Math.PI,
            interval = (end - start) / count;

        for(var i = 0; i<count; i++) {
            var p1 = coord(innerRadius, start),
                p2 = coord(outerRadius, start);

            var lines = ring.append("line")
                .attr("x1", p1.x)
                .attr("y1", p1.y)
                .attr("x2", p2.x)
                .attr("y2", p2.y)
                .attr("stroke-width", 0.5)
                .attr("stroke", "#222");

            var tc = coord(outerRadius-10, start + interval/2);

            ring.append("text")
                .attr("x", tc.x-9)
                .attr("y", tc.y+5)
                .text(i);

            start += interval;
        }

        return ring;
    }

    return ring.init()
};


// int first = r->router_id % p->num_routers;
// for(int i=0; i < p->num_global_channels; i++)
// {
//     int target_grp = first;
//     if(target_grp == r->group_id) {
//         target_grp = p->num_groups - 1;
//     }
//     int my_pos = r->group_id % p->num_routers;
//     if(r->group_id == p->num_groups - 1) {
//         my_pos = target_grp % p->num_routers;
//     }
//     r->global_channel[i] = target_grp * p->num_routers + my_pos;
//     first += p->num_routers;
// }

function interLinks(arg){

    var option = arg || {},
        data = option.data || {},
        width = option.width || 500,
        height = option.height || width,
        vmap = option.vmap || {},
        container = option.container || null,
        radius = option.radius || width/2,
        dataRange = option.dataRange || {min: 0, max: 1};

        function coord(r, rad){
            var x = width/2 + r * Math.cos(rad),
                y = height/2 + r * Math.sin(rad);
            return {x: x, y: y};
        }
    var ring = container.append("g");

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

        var num_routers = NUM_ROUTER || 510,
            num_groups = NUM_GROUP || 51,
            num_links = TERMINAL_PER_ROUTER || 5,
            radix = ROUTER_RADIX || 16,
            start = 0,
            router_per_group = num_routers/ num_groups,
            n= num_routers,
            r = i2v.Metric().domain([n, 0]).range([0,radius*0.9]);
        // console.log(num_routers, num_groups, num_links);
        for(var i = 0; i<num_routers; i++){
            var router_id = i,
                group_id = Math.floor(router_id / router_per_group);

                router_id = i % router_per_group;
            var first = router_id % num_routers;
            for(var j=0; j < num_links; j++)
            {

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
                // var color = "hsl(" + (120-Math.floor(c*120)) + ",100%, 40%)";
                // console.log(c);

                // var lines = ring.append("line")
                //     .attr("x1", src.x)
                //     .attr("y1", src.y)
                //     .attr("x2", dest.x)
                //     .attr("y2", dest.y)
                //     .attr("stroke-width", c*0.8 + 0.2)
                //     .attr("stroke-opacity",c*2)
                //     .attr("stroke", "orange");

                //
                var diff = (target_pos - i)  / 2,
                    cp;

                var ca = (i+diff) / n * 2 * Math.PI;
                if(diff >= n/4) { ca += Math.PI; diff = diff+n/2; }
                if(diff<0) diff += n;

                var cp = coord(Math.pow(r((diff*2)%n),0.9), ca);

                var path = ["M", src.x, src.y, "Q", cp.x, cp.y, dest.x, dest.y].join(' ');

                var lines = ring.append("path")
                    .attr("d", path)
                    .attr("fill", "transparent")
                    .attr("stroke-width",  c*0.7 + 0.3)
                    .attr("stroke","orange")
                    .attr("stroke-opacity", c*2);

            }

        }

        //
        // for(var i = 0; i<count; i++) {
        //     for(var j = 0; j<dist; j++){
        //         var src = coord(radius, (i*dist+j) / n *  2 * Math.PI);
        //         for(var k = 0; k < dist/2; k++) {
        //             var di = (( (k+1) * dist) + j*5*dist + i*dist + j ) % n;
        //             var dest = coord(radius, di/n *  2 * Math.PI);
        //             // console.log(i*dist+j, dd);
        //             //
        //             var c = (data[i*dist+j][k] - dataRange.min) / (dataRange.max - dataRange.min),
        //                 color = "hsl(" + (50-Math.floor(c*50)) + ",100%, 40%)";
        //
        //             // if(c > 0.7) {
        //                 // var lines = ring.append("line")
        //                 //     .attr("x1", src.x)
        //                 //     .attr("y1", src.y)
        //                 //     .attr("x2", dest.x)
        //                 //     .attr("y2", dest.y)
        //                 //     .attr("stroke-width", Math.max(0.2, c))
        //                 //     .attr("stroke-opacity", c*2)
        //                 //     .attr("stroke", color);
        //
        //                 var r = i2v.Metric.domain([n, 0]).range([0,radius*0.9]),
        //                     diff = (di - (i*dist+j))  / 2,
        //                     cp;
        //
        //                 var ca = ((i*dist+j)+diff) / n * 2 * Math.PI;
        //                 if(diff >= n/4) { ca += Math.PI; diff = diff+n/2; }
        //                 if(diff<0) diff += n;
        //
        //                 var cp = coord(r((diff*2)%n), ca);
        //
        //                 var path = ["M", src.x, src.y, "Q", cp.x, cp.y, dest.x, dest.y].join(' ');
        //
        //                 var lines = ring.append("path")
        //                     .attr("d", path)
        //                     .attr("fill", "transparent")
        //                     .attr("stroke-width",  Math.max(0.2, c))
        //                     .attr("stroke", "#2CA02C")
        //                     .attr("stroke-opacity", c);
        //             }
        //     }
        // }
        return ring;
    }

    return ring.init();

}
