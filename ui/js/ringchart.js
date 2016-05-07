if(typeof(define) == "function") define(function(){return ringChart;})

function ringChart(option){
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
